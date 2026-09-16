"""Dedicated weather-alert HTTP handlers for the farmer API."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Callable

from weather_ews.cells import assign_farm_to_cell, forecast_cell_id
from weather_ews.cli import GLOBAL_STORE, run_ingest
from weather_ews.dynamo_store import DynamoWeatherStore
from weather_ews.health import provider_health_snapshot
from weather_ews.ingest import recalculate_farm_alerts
from weather_ews.providers.kmd_cap import KmdCapProvider
from weather_ews.providers.open_meteo import OpenMeteoProvider
from weather_ews.store import utc_now


Respond = Callable[[int, dict | list], dict]


def weather_store(table, msid: str | None = None):
    try:
        return DynamoWeatherStore(table, msid=msid or "SYSTEM")
    except Exception:
        return GLOBAL_STORE


def handle_weather_routes(
    *,
    method: str,
    path: str,
    event: dict[str, Any],
    farmer: dict[str, Any] | None,
    table,
    body: dict[str, Any],
    respond: Respond,
    items: Callable[[str, str], list],
) -> dict | None:
    """Return a response dict if handled, else None."""

    # Ops health — no farmer auth required for staging ops token later; currently farmer-auth or public health.
    if path == "/api/v1/ops/weather/health" and method == "GET":
        store = weather_store(table)
        return respond(200, provider_health_snapshot(store.get_health()))

    if path == "/api/v1/ops/weather/ingest" and method == "POST":
        farms = body.get("farms")
        if not farms and farmer:
            farms = items(farmer["msid"], "FARM#")
        if not farms:
            return respond(400, {"detail": "Provide farms[] with coordinates or authenticate a farmer with farms."})
        store = weather_store(table, farmer["msid"] if farmer else "SYSTEM")
        result = run_ingest(farms, force=bool(body.get("force")), store=store)
        return respond(200, result)

    if not path.startswith("/api/v1/farmer/") and not path.startswith("/api/v1/weather-alerts") and not path.startswith("/api/v1/impact-reports"):
        return None
    if farmer is None and path.startswith("/api/v1/farmer/"):
        return None

    # POST /api/v1/farmer/weather-alerts/{id}/acknowledge
    m = re.fullmatch(r"/api/v1/farmer/weather-alerts/([^/]+)/acknowledge", path)
    if m and method == "POST":
        return _ack(farmer, m.group(1), body, table, respond)

    m = re.fullmatch(r"/api/v1/weather-alerts/([^/]+)/acknowledge", path)
    if m and method == "POST":
        return _ack(farmer, m.group(1), body, table, respond)

    m = re.fullmatch(r"/api/v1/farmer/weather-alerts/([^/]+)/impact-reports", path)
    if m and method == "POST":
        return _impact(farmer, m.group(1), body, table, respond)

    m = re.fullmatch(r"/api/v1/weather-alerts/([^/]+)/impact-reports", path)
    if m and method == "POST":
        return _impact(farmer, m.group(1), body, table, respond)

    m = re.fullmatch(r"/api/v1/farmer/farms/([^/]+)/exposure-observations", path)
    if m and method == "POST":
        return _exposure(farmer, m.group(1), body, table, respond, items)

    m = re.fullmatch(r"/api/v1/farmer/farms/([^/]+)/weather-timeline", path)
    if m and method == "GET":
        return _timeline(farmer, m.group(1), table, respond, items)

    m = re.fullmatch(r"/api/v1/farmer/farms/([^/]+)/preparedness-actions", path)
    if m and method == "GET":
        return _preparedness(farmer, m.group(1), table, respond, items)

    m = re.fullmatch(r"/api/v1/impact-reports/([^/]+)/verify", path)
    if m and method == "POST":
        return respond(501, {
            "detail": "Field verification is handled by MkulimaCollect / ops review — not auto-verified from the farmer app.",
            "impactReportId": m.group(1),
            "provisionalStatus": "PROVISIONAL",
        })

    m = re.fullmatch(r"/api/v1/weather-alerts/([^/]+)/escalate", path)
    if m and method == "POST":
        return _ops_status(farmer, m.group(1), "escalated", body, table, respond)

    m = re.fullmatch(r"/api/v1/weather-alerts/([^/]+)/close", path)
    if m and method == "POST":
        return _ops_status(farmer, m.group(1), "closed", body, table, respond)

    return None


def _ack(farmer, alert_id: str, body: dict, table, respond: Respond):
    store = weather_store(table, farmer["msid"] if farmer else "SYSTEM")
    alert = store.get_alert(alert_id) if hasattr(store, "get_alert") else None
    if alert is None and hasattr(store, "alerts"):
        alert = store.alerts.get(alert_id)
    now = utc_now()
    payload = {
        "id": alert_id,
        "acknowledgedAt": now,
        "selectedActionId": body.get("selectedActionId") or body.get("selected_action_id"),
        "msid": farmer["msid"] if farmer else None,
        "provenance": "FARMER_REPORTED",
    }
    if alert:
        alert = {**alert, "acknowledged_at": now, "acknowledgedAt": now, "status": "acknowledged"}
        store.save_alert(alert)
    table.put_item(Item={
        "pk": f"FARMER#{farmer['msid']}",
        "sk": f"WACK#{alert_id}",
        "entity": "weather_ack",
        "data": payload,
        "updated_at": now,
    })
    return respond(200, {"status": "ACCEPTED", "acknowledgement": payload})


def _impact(farmer, alert_id: str, body: dict, table, respond: Respond):
    now = utc_now()
    impact_id = str(uuid.uuid4())
    impact = {
        "id": impact_id,
        "alertId": alert_id,
        "farmId": body.get("farmId") or body.get("farm_id"),
        "impactType": body.get("impactType") or body.get("impact_type") or "other",
        "narrative": body.get("narrative") or "",
        "safeToAssess": bool(body.get("safeToAssess", True)),
        "provisionalStatus": "PROVISIONAL",
        "createdAt": now,
        "msid": farmer["msid"],
        "provenance": "FARMER_REPORTED",
    }
    table.put_item(Item={
        "pk": f"FARMER#{farmer['msid']}",
        "sk": f"IMPACT#{impact_id}",
        "entity": "impact_case",
        "data": impact,
        "updated_at": now,
    })
    return respond(200, {"status": "ACCEPTED", "impact": impact})


def _exposure(farmer, farm_id: str, body: dict, table, respond: Respond, items):
    farms = items(farmer["msid"], "FARM#")
    farm = next((f for f in farms if f.get("id") == farm_id), None)
    if not farm:
        return respond(404, {"detail": "Farm not found"})
    now = utc_now()
    exposure = {
        "nearWaterway": bool(body.get("nearWaterway")),
        "poorDrainage": bool(body.get("poorDrainage")),
        "steepSlope": bool(body.get("steepSlope")),
        "singleAccessRoad": bool(body.get("singleAccessRoad")),
        "fragileStorage": bool(body.get("fragileStorage")),
        "notedAt": now,
        "provenance": "FARMER_REPORTED",
    }
    farm = {**farm, "exposure": exposure}
    table.put_item(Item={
        "pk": f"FARMER#{farmer['msid']}",
        "sk": f"FARM#{farm_id}",
        "entity": "farm",
        "data": farm,
        "updated_at": now,
    })
    return respond(200, {"status": "ACCEPTED", "farmId": farm_id, "exposure": exposure})


def _timeline(farmer, farm_id: str, table, respond: Respond, items):
    farms = items(farmer["msid"], "FARM#")
    farm = next((f for f in farms if f.get("id") == farm_id), None)
    if not farm:
        return respond(404, {"detail": "Farm not found"})
    store = weather_store(table, farmer["msid"])
    cell_id = None
    if farm.get("latitude") is not None and farm.get("longitude") is not None:
        cell_id = forecast_cell_id(float(farm["latitude"]), float(farm["longitude"]))
    features = store.get_features(cell_id) if cell_id else None
    alerts = store.list_alerts_for_farm(farm_id)
    health = store.get_health()
    age = None
    freshness = "unavailable"
    if features and features.get("updated_at"):
        try:
            updated = datetime.fromisoformat(str(features["updated_at"]).replace("Z", "+00:00"))
            age = round((datetime.now(timezone.utc) - updated).total_seconds() / 60.0, 1)
            freshness = features.get("freshness") or ("fresh" if age <= 360 else "stale")
        except ValueError:
            freshness = features.get("freshness") or "unknown"
    return respond(200, {
        "farmId": farm_id,
        "forecastCellId": cell_id,
        "lanes": {
            "numericalForecast": {
                "provider": "open_meteo",
                "freshness": freshness,
                "ageMinutes": age,
                "features": (features or {}).get("features"),
                "updatedAt": (features or {}).get("updated_at"),
                "disclaimer": "Model-derived farm-place forecast — not a farm sensor and not an official warning.",
            },
            "officialWarnings": KmdCapProvider().health(),
        },
        "alerts": alerts,
        "providerHealth": provider_health_snapshot(health),
    })


def _preparedness(farmer, farm_id: str, table, respond: Respond, items):
    farms = items(farmer["msid"], "FARM#")
    farm = next((f for f in farms if f.get("id") == farm_id), None)
    if not farm:
        return respond(404, {"detail": "Farm not found"})
    store = weather_store(table, farmer["msid"])
    if farm.get("latitude") is None or farm.get("longitude") is None:
        return respond(200, {"farmId": farm_id, "actions": [], "alerts": [], "note": "Mark the farm place first."})
    from dataclasses import asdict
    ctx = assign_farm_to_cell(
        farm_id,
        float(farm["latitude"]),
        float(farm["longitude"]),
        farm_name=str(farm.get("name") or farm_id),
        exposure=farm.get("exposure") or {},
    )
    store.save_context(asdict(ctx))
    # Ensure features exist — light on-demand ingest for this farm only when missing
    cell_id = ctx.forecast_cell_id
    if not store.get_features(cell_id):
        run_ingest([farm], force=True, store=store)
    alerts = recalculate_farm_alerts(ctx, store=store)
    actions = []
    for alert in alerts:
        if alert.get("status") in ("expired", "closed"):
            continue
        for action in alert.get("actions") or []:
            actions.append({**action, "alertId": alert.get("id"), "hazardType": alert.get("hazardType") or alert.get("hazard_type")})
    return respond(200, {
        "farmId": farm_id,
        "forecastCellId": cell_id,
        "alerts": [a for a in alerts if a.get("status") not in ("expired", "closed")],
        "actions": actions,
        "disclaimer": "Preparedness actions from the numerical forecast lane unless labelled Official.",
    })


def _ops_status(farmer, alert_id: str, kind: str, body: dict, table, respond: Respond):
    store = weather_store(table, farmer["msid"] if farmer else "SYSTEM")
    alert = store.get_alert(alert_id) if hasattr(store, "get_alert") else None
    if not alert:
        return respond(404, {"detail": "Alert not found"})
    now = utc_now()
    if kind == "closed":
        alert = {**alert, "status": "expired", "lifecycle_status": "closed", "closed_at": now, "closure_reason": body.get("reason") or "ops_closed"}
    else:
        alert = {**alert, "escalated_at": now, "ops_note": body.get("note")}
    store.save_alert(alert)
    return respond(200, {"status": "ACCEPTED", "alert": alert})
