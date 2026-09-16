"""In-memory / dict-backed store used by Lambda (DynamoDB adapter wraps this shape)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def checksum(payload: Any) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def serialize(obj: Any) -> Any:
    if is_dataclass(obj):
        return {k: serialize(v) for k, v in asdict(obj).items()}
    if isinstance(obj, list):
        return [serialize(item) for item in obj]
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    if hasattr(obj, "value"):
        return obj.value
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


class MemoryWeatherStore:
    """Process-local store for CLI tests; Lambda persists via DynamoWeatherStore."""

    def __init__(self):
        self.runs: dict[str, dict] = {}
        self.raw: dict[str, dict] = {}
        self.hourly: dict[str, list[dict]] = {}
        self.features: dict[str, dict] = {}
        self.contexts: dict[str, dict] = {}
        self.alerts: dict[str, dict] = {}
        self.health: dict[str, Any] = {}

    def save_run(self, run: dict) -> None:
        self.runs[run["id"]] = run

    def save_raw(self, record: dict) -> None:
        self.raw[record["id"]] = record

    def save_hourly(self, cell_id: str, points: list[dict]) -> None:
        self.hourly[cell_id] = points

    def save_features(self, cell_id: str, feature_map: dict, meta: dict) -> None:
        self.features[cell_id] = {"features": feature_map, **meta}

    def get_features(self, cell_id: str) -> dict | None:
        return self.features.get(cell_id)

    def save_context(self, ctx: dict) -> None:
        self.contexts[ctx["farm_id"]] = ctx

    def list_contexts_for_cells(self, cell_ids: set[str]) -> list[dict]:
        return [c for c in self.contexts.values() if c.get("forecast_cell_id") in cell_ids]

    def save_alert(self, alert: dict) -> None:
        self.alerts[alert["id"]] = alert

    def list_alerts_for_farm(self, farm_id: str) -> list[dict]:
        return [a for a in self.alerts.values() if a.get("farm_id") == farm_id]

    def get_alert(self, alert_id: str) -> dict | None:
        return self.alerts.get(alert_id)

    def set_health(self, snapshot: dict) -> None:
        self.health = snapshot

    def get_health(self) -> dict:
        return self.health or {"status": "unknown"}
