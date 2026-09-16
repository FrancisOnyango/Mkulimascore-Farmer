"""Dynamic alert lifecycle — transitions from evaluation, not hard-coded calendars alone."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from .models import AlertOrigin, AlertStatus, WeatherAlertEvent
from .rules import evaluate_rules


LEVEL_RANK = {
    "outlook": 1,
    "advisory": 2,
    "watch": 3,
    "warning": 4,
    "observed_impact": 5,
}

VALID_HOURS = {
    "outlook": 72,
    "advisory": 48,
    "watch": 36,
    "warning": 24,
}


class AlertLifecycle:
    def __init__(self, language: str = "en"):
        self.language = language

    def recalculate(
        self,
        *,
        farm_id: str,
        farm_name: str,
        features: dict[str, float | None],
        exposure: dict[str, Any] | None,
        existing: list[WeatherAlertEvent],
        source_run_id: str,
        now: datetime | None = None,
        official_events: list[dict[str, Any]] | None = None,
    ) -> list[WeatherAlertEvent]:
        now = now or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        active = [
            a for a in existing
            if a.status not in (AlertStatus.CLOSED, AlertStatus.EXPIRED)
            and a.farm_id == farm_id
        ]
        by_hazard = {a.hazard_type: a for a in active if a.alert_origin == AlertOrigin.MODEL_DERIVED_WATCH}

        hits = evaluate_rules(features, exposure)
        updated: list[WeatherAlertEvent] = []
        seen_hazards: set[str] = set()

        for hit in hits:
            hazard = hit["hazard"]
            seen_hazards.add(hazard)
            level = hit["level"]
            prev = by_hazard.get(hazard)
            title, message = self._copy(hazard, level, features, hit.get("boosted", False))
            if prev is None:
                updated.append(self._create(
                    farm_id=farm_id,
                    farm_name=farm_name,
                    hazard=hazard,
                    level=level,
                    title=title,
                    message=message,
                    actions=hit["actions"],
                    action_set=hit["action_set"],
                    source_run_id=source_run_id,
                    now=now,
                ))
                continue
            prev_rank = LEVEL_RANK.get(prev.level, 0)
            next_rank = LEVEL_RANK.get(level, 0)
            if next_rank > prev_rank:
                updated.append(self._transition(prev, level, AlertStatus(level if level != "advisory" else "advisory"), title, message, hit["actions"], source_run_id, now, escalate=True))
            elif next_rank < prev_rank:
                updated.append(self._transition(prev, level, AlertStatus.DOWNGRADED, title, message, hit["actions"], source_run_id, now, escalate=False))
            else:
                # Refresh validity / evaluation timestamp
                refreshed = WeatherAlertEvent(**{**prev.__dict__})
                refreshed.last_evaluated_at = now.isoformat()
                refreshed.valid_until = (now + timedelta(hours=VALID_HOURS.get(level, 36))).isoformat()
                refreshed.trigger_summary = title
                refreshed.title = title
                refreshed.plain_language_message = message
                refreshed.actions = hit["actions"]
                refreshed.source_run_ids = list(dict.fromkeys([*(prev.source_run_ids or []), source_run_id]))
                if refreshed.status == AlertStatus.DOWNGRADED:
                    refreshed.status = AlertStatus(level if level in AlertStatus.__members__ else "watch")
                    if level == "outlook":
                        refreshed.status = AlertStatus.OUTLOOK
                updated.append(refreshed)

        for hazard, prev in by_hazard.items():
            if hazard in seen_hazards:
                continue
            # Hazard no longer meets thresholds → expire
            closed = WeatherAlertEvent(**{**prev.__dict__})
            closed.status = AlertStatus.EXPIRED
            closed.closed_at = now.isoformat()
            closed.closure_reason = "conditions_no_longer_met"
            closed.last_evaluated_at = now.isoformat()
            updated.append(closed)

        # Official lane — never fabricate; only attach provided CAP-derived events
        for official in official_events or []:
            updated.append(self._from_official(farm_id, farm_name, official, source_run_id, now))

        return updated

    def expire_stale(self, alerts: list[WeatherAlertEvent], now: datetime | None = None) -> list[WeatherAlertEvent]:
        now = now or datetime.now(timezone.utc)
        out: list[WeatherAlertEvent] = []
        for alert in alerts:
            if alert.status in (AlertStatus.CLOSED, AlertStatus.EXPIRED):
                out.append(alert)
                continue
            until = datetime.fromisoformat(alert.valid_until.replace("Z", "+00:00"))
            if until.tzinfo is None:
                until = until.replace(tzinfo=timezone.utc)
            if until <= now:
                expired = WeatherAlertEvent(**{**alert.__dict__})
                expired.status = AlertStatus.EXPIRED
                expired.closed_at = now.isoformat()
                expired.closure_reason = "validity_elapsed"
                expired.last_evaluated_at = now.isoformat()
                out.append(expired)
            else:
                out.append(alert)
        return out

    def _create(self, **kwargs) -> WeatherAlertEvent:
        now: datetime = kwargs["now"]
        level = kwargs["level"]
        status = {
            "outlook": AlertStatus.OUTLOOK,
            "advisory": AlertStatus.ADVISORY,
            "watch": AlertStatus.WATCH,
            "warning": AlertStatus.WARNING,
        }.get(level, AlertStatus.WATCH)
        return WeatherAlertEvent(
            id=str(uuid.uuid4()),
            farm_id=kwargs["farm_id"],
            farm_name=kwargs["farm_name"],
            hazard_type=kwargs["hazard"],
            alert_origin=AlertOrigin.MODEL_DERIVED_WATCH,
            official_authority=None,
            level=level,
            status=status,
            first_detected_at=now.isoformat(),
            issued_at=now.isoformat(),
            valid_from=now.isoformat(),
            valid_until=(now + timedelta(hours=VALID_HOURS.get(level, 36))).isoformat(),
            last_evaluated_at=now.isoformat(),
            supersedes_alert_id=None,
            trigger_summary=kwargs["title"],
            confidence="medium",
            recommended_action_set_id=kwargs["action_set"],
            source_run_ids=[kwargs["source_run_id"]],
            title=kwargs["title"],
            plain_language_message=kwargs["message"],
            official_warning=False,
            actions=kwargs["actions"],
            language=self.language,
        )

    def _transition(self, prev, level, status, title, message, actions, source_run_id, now, escalate: bool) -> WeatherAlertEvent:
        nxt = WeatherAlertEvent(**{**prev.__dict__})
        nxt.id = str(uuid.uuid4()) if escalate else prev.id
        nxt.supersedes_alert_id = prev.id if escalate else prev.supersedes_alert_id
        nxt.level = level
        nxt.status = status if isinstance(status, AlertStatus) else AlertStatus(status)
        nxt.title = title
        nxt.plain_language_message = message
        nxt.actions = actions
        nxt.trigger_summary = title
        nxt.last_evaluated_at = now.isoformat()
        nxt.valid_until = (now + timedelta(hours=VALID_HOURS.get(level, 36))).isoformat()
        nxt.source_run_ids = list(dict.fromkeys([*(prev.source_run_ids or []), source_run_id]))
        return nxt

    def _from_official(self, farm_id, farm_name, official: dict[str, Any], source_run_id: str, now: datetime) -> WeatherAlertEvent:
        return WeatherAlertEvent(
            id=str(official.get("id") or uuid.uuid4()),
            farm_id=farm_id,
            farm_name=farm_name,
            hazard_type=str(official.get("hazard_type") or "heavy_rain"),
            alert_origin=AlertOrigin.OFFICIAL_WARNING,
            official_authority=str(official.get("authority") or "KMD"),
            level="warning",
            status=AlertStatus.WARNING,
            first_detected_at=str(official.get("issued_at") or now.isoformat()),
            issued_at=str(official.get("issued_at") or now.isoformat()),
            valid_from=str(official.get("onset") or now.isoformat()),
            valid_until=str(official.get("expires") or (now + timedelta(hours=24)).isoformat()),
            last_evaluated_at=now.isoformat(),
            supersedes_alert_id=None,
            trigger_summary=str(official.get("headline") or "Official warning"),
            confidence=str(official.get("certainty") or "high"),
            recommended_action_set_id="official_instructions",
            source_run_ids=[source_run_id],
            title=str(official.get("headline") or "Official weather warning"),
            plain_language_message=str(official.get("description") or ""),
            official_warning=True,
            actions=[{"id": "follow", "label": "Follow official instructions", "detail": str(official.get("instruction") or "Follow public-authority guidance.")}],
            language=self.language,
        )

    def _copy(self, hazard: str, level: str, features: dict[str, float | None], boosted: bool) -> tuple[str, str]:
        rain = features.get("rain_24h_mm")
        prob = features.get("rain_prob_24h_pct")
        temp = features.get("temp_max_24h_c")
        if hazard == "heavy_rain":
            title = "Heavy rain possible at your farm" if level != "watch" else "Heavy rain watch for your farm"
            message = (
                f"Farm-place forecast: about {prob or '—'}% chance of rain"
                f"{f' (~{rain} mm in 24h)' if rain is not None else ''}. "
                "This is a Mkulima preparedness watch, not an official KMD warning."
            )
            if boosted:
                message += " Your farm exposure (drainage, slope or waterway) raises urgency."
            return title, message
        if hazard == "heat":
            return "Hot conditions expected", f"Highs near {temp or '—'}°C at the farm place. Mkulima preparedness watch — not an official warning."
        if hazard == "drought":
            return "Dry spell — check water", "The forecast looks dry. Check livestock water and storage. This is not an official NDMA drought phase."
        if hazard == "wind":
            return "Strong wind possible", "Gusts may affect spraying and light structures. Mkulima preparedness watch — not an official warning."
        return f"{hazard.replace('_', ' ').title()} watch", "Preparedness signal from the farm forecast — not an official government warning."
