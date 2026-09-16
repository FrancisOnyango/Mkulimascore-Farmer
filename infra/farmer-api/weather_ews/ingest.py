"""Forecast ingestion pipeline: fetch → validate → retain → normalize → features → alerts."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Protocol

from .cells import unique_locations
from .features import build_agricultural_features, features_as_map
from .lifecycle import AlertLifecycle
from .material_change import is_material, material_changes
from .models import FarmWeatherContext, ForecastPoint, WeatherAlertEvent
from .providers.open_meteo import OpenMeteoProvider
from .providers.kmd_cap import KmdCapProvider
from .store import MemoryWeatherStore, checksum, serialize, utc_now


class WeatherStore(Protocol):
    def save_run(self, run: dict) -> None: ...
    def save_raw(self, record: dict) -> None: ...
    def save_hourly(self, cell_id: str, points: list[dict]) -> None: ...
    def save_features(self, cell_id: str, feature_map: dict, meta: dict) -> None: ...
    def get_features(self, cell_id: str) -> dict | None: ...
    def save_context(self, ctx: dict) -> None: ...
    def list_contexts_for_cells(self, cell_ids: set[str]) -> list[dict]: ...
    def save_alert(self, alert: dict) -> None: ...
    def list_alerts_for_farm(self, farm_id: str) -> list[dict]: ...
    def set_health(self, snapshot: dict) -> None: ...
    def get_health(self) -> dict: ...


def ingest_forecast_run(
    contexts: list[FarmWeatherContext],
    *,
    store: WeatherStore | None = None,
    provider: OpenMeteoProvider | None = None,
    official_provider: KmdCapProvider | None = None,
    force: bool = False,
) -> dict[str, Any]:
    store = store or MemoryWeatherStore()
    provider = provider or OpenMeteoProvider()
    official_provider = official_provider or KmdCapProvider()
    run_id = str(uuid.uuid4())
    started = utc_now()
    locations = unique_locations(contexts)
    for ctx in contexts:
        store.save_context(serialize(ctx))

    run = {
        "id": run_id,
        "provider": provider.provider_name,
        "started_at": started,
        "completed_at": None,
        "status": "running",
        "requested_locations": len(locations),
        "successful_locations": 0,
        "failed_locations": 0,
        "error_summary": None,
    }
    store.save_run(run)

    try:
        points = provider.fetch_sync(locations)
    except Exception as exc:  # noqa: BLE001 — surface provider failure honestly
        run["status"] = "failed"
        run["completed_at"] = utc_now()
        run["failed_locations"] = len(locations)
        run["error_summary"] = str(exc)
        store.save_run(run)
        store.set_health(_health(provider, official_provider, run, ok=False))
        return {"run": run, "alerts": [], "changed_cells": []}

    raw_id = str(uuid.uuid4())
    raw_payload = {
        "run_id": run_id,
        "provider": provider.provider_name,
        "location_count": len(locations),
        "point_count": len(points),
        "received_at": utc_now(),
    }
    store.save_raw({
        "id": raw_id,
        "ingestion_run_id": run_id,
        "checksum": checksum(raw_payload),
        "received_at": raw_payload["received_at"],
        "content_type": "application/json",
        "summary": raw_payload,
        # Full hourly series retained per cell below; S3 URI hook for production.
        "storage_uri": f"memory://weather_raw/{raw_id}",
    })

    by_cell: dict[str, list[ForecastPoint]] = {}
    for point in points:
        by_cell.setdefault(point.cell_id, []).append(point)

    changed_cells: set[str] = set()
    for cell_id, cell_points in by_cell.items():
        store.save_hourly(cell_id, [serialize(p) for p in cell_points])
        features = build_agricultural_features(cell_points, source_run_id=run_id)
        feature_map = features_as_map(features)
        previous = store.get_features(cell_id)
        prev_map = (previous or {}).get("features")
        if force or is_material(prev_map, feature_map):
            changed_cells.add(cell_id)
        store.save_features(cell_id, feature_map, {
            "updated_at": utc_now(),
            "source_run_id": run_id,
            "freshness": features[0].freshness if features else "unknown",
            "changes": material_changes(prev_map, feature_map),
            "feature_records": serialize(features),
        })

    run["status"] = "succeeded"
    run["completed_at"] = utc_now()
    run["successful_locations"] = len(by_cell)
    run["failed_locations"] = max(0, len(locations) - len(by_cell))
    store.save_run(run)

    official: list[dict] = []
    official_error = None
    try:
        official = official_provider.fetch_active_sync()
    except Exception as exc:  # noqa: BLE001
        official_error = str(exc)

    lifecycle = AlertLifecycle()
    all_alerts: list[dict] = []
    affected_contexts = store.list_contexts_for_cells(changed_cells) if changed_cells else []
    # Always refresh farms whose cells succeeded when force=True
    if force:
        affected_contexts = store.list_contexts_for_cells(set(by_cell.keys()))

    for ctx in affected_contexts:
        cell_id = ctx["forecast_cell_id"]
        feat = store.get_features(cell_id) or {}
        feature_map = feat.get("features") or {}
        existing = [
            _alert_from_dict(item)
            for item in store.list_alerts_for_farm(ctx["farm_id"])
        ]
        farm_official = [
            item for item in official
            if _official_covers_farm(item, ctx)
        ]
        events = lifecycle.recalculate(
            farm_id=ctx["farm_id"],
            farm_name=ctx.get("farm_name") or ctx["farm_id"],
            features=feature_map,
            exposure=ctx.get("exposure") or {},
            existing=existing,
            source_run_id=run_id,
            official_events=farm_official,
        )
        events = lifecycle.expire_stale(events)
        for event in events:
            card = serialize(event)
            card.update(event.to_farmer_card())
            store.save_alert(card)
            all_alerts.append(card)

    store.set_health(_health(provider, official_provider, run, ok=True, official_error=official_error))
    return {
        "run": run,
        "changed_cells": sorted(changed_cells),
        "alerts": all_alerts,
        "official_lane": {
            "configured": official_provider.configured,
            "count": len(official),
            "error": official_error,
        },
    }


def recalculate_farm_alerts(
    ctx: FarmWeatherContext,
    *,
    store: WeatherStore,
    language: str = "en",
) -> list[dict]:
    feat = store.get_features(ctx.forecast_cell_id) or {}
    lifecycle = AlertLifecycle(language=language)
    existing = [_alert_from_dict(item) for item in store.list_alerts_for_farm(ctx.farm_id)]
    events = lifecycle.recalculate(
        farm_id=ctx.farm_id,
        farm_name=ctx.farm_name or ctx.farm_id,
        features=feat.get("features") or {},
        exposure=ctx.exposure,
        existing=existing,
        source_run_id=str(feat.get("source_run_id") or "manual"),
    )
    events = lifecycle.expire_stale(events)
    cards = []
    for event in events:
        card = serialize(event)
        card.update(event.to_farmer_card())
        store.save_alert(card)
        cards.append(card)
    return cards


def _alert_from_dict(item: dict) -> WeatherAlertEvent:
    from .models import AlertOrigin, AlertStatus

    raw_status = str(item.get("lifecycle_status") or item.get("status") or "watch")
    # Farmer card uses active/acknowledged/expired — map back to lifecycle when needed.
    status_map = {
        "active": AlertStatus.WATCH,
        "acknowledged": AlertStatus.WATCH,
        "cancelled": AlertStatus.CLOSED,
    }
    if raw_status in AlertStatus._value2member_map_:
        status = AlertStatus(raw_status)
    else:
        status = status_map.get(raw_status, AlertStatus.WATCH)

    origin_raw = item.get("alert_origin") or item.get("alertOrigin") or AlertOrigin.MODEL_DERIVED_WATCH.value
    try:
        origin = AlertOrigin(origin_raw)
    except ValueError:
        origin = AlertOrigin.MODEL_DERIVED_WATCH

    official = bool(item.get("official_warning") if "official_warning" in item else item.get("officialWarning"))
    return WeatherAlertEvent(
        id=item["id"],
        farm_id=item.get("farm_id") or item.get("farmId"),
        farm_name=item.get("farm_name") or item.get("farmName") or "",
        hazard_type=item.get("hazard_type") or item.get("hazardType") or "heavy_rain",
        alert_origin=origin,
        official_authority=(item.get("official_authority") or item.get("source")) if official else None,
        level=item.get("level") or "outlook",
        status=status,
        first_detected_at=item.get("first_detected_at") or item.get("issuedAt") or utc_now(),
        issued_at=item.get("issued_at") or item.get("issuedAt") or utc_now(),
        valid_from=item.get("valid_from") or item.get("issuedAt") or utc_now(),
        valid_until=item.get("valid_until") or item.get("validUntil") or utc_now(),
        last_evaluated_at=item.get("last_evaluated_at") or utc_now(),
        supersedes_alert_id=item.get("supersedes_alert_id"),
        trigger_summary=item.get("trigger_summary") or item.get("title") or "",
        confidence=item.get("confidence") or "medium",
        recommended_action_set_id=item.get("recommended_action_set_id") or "rain_preparedness_v1",
        source_run_ids=item.get("source_run_ids") or [],
        acknowledged_at=item.get("acknowledged_at") or item.get("acknowledgedAt"),
        closed_at=item.get("closed_at"),
        closure_reason=item.get("closure_reason"),
        title=item.get("title") or "",
        plain_language_message=item.get("plain_language_message") or item.get("plainLanguageMessage") or "",
        official_warning=official,
        actions=item.get("actions") or [],
        language=item.get("language") or "en",
    )


def _official_covers_farm(official: dict, ctx: dict) -> bool:
    # Minimal hook: if CAP area lists are absent, do not auto-attach (never invent coverage).
    areas = official.get("areas") or official.get("area_codes") or []
    if not areas:
        return False
    return True  # Real geometry match lands with PostGIS later.


def _health(provider, official_provider, run: dict, *, ok: bool, official_error: str | None = None) -> dict:
    return {
        "status": "healthy" if ok else "degraded",
        "checkedAt": utc_now(),
        "numericalForecast": {
            "provider": provider.provider_name,
            "baseUrlConfigured": True,
            "lastRunId": run.get("id"),
            "lastRunStatus": run.get("status"),
            "lastCompletedAt": run.get("completed_at"),
            "requestedLocations": run.get("requested_locations"),
            "successfulLocations": run.get("successful_locations"),
            "failedLocations": run.get("failed_locations"),
            "errorSummary": run.get("error_summary"),
            "licenceNote": "Use commercial Open-Meteo or self-host for production; public API is non-commercial.",
        },
        "officialWarnings": {
            **official_provider.health(),
            "lastError": official_error,
        },
        "lanes": {
            "model_derived_watch": "active",
            "official_warning": "active" if official_provider.configured else "inactive",
        },
    }
