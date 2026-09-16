"""DynamoDB persistence adapter for weather EWS (farmer-api table)."""

from __future__ import annotations

import json
from typing import Any

from .store import utc_now


class DynamoWeatherStore:
    def __init__(self, table, msid: str = "SYSTEM"):
        self.table = table
        self.msid = msid

    def _pk(self) -> str:
        return f"WEATHER#{self.msid}"

    def save_run(self, run: dict) -> None:
        self.table.put_item(Item={
            "pk": self._pk(),
            "sk": f"RUN#{run['id']}",
            "entity": "weather_run",
            "data": _decimal_safe(run),
            "updated_at": utc_now(),
        })

    def save_raw(self, record: dict) -> None:
        self.table.put_item(Item={
            "pk": self._pk(),
            "sk": f"RAW#{record['id']}",
            "entity": "weather_raw",
            "data": _decimal_safe(record),
            "updated_at": utc_now(),
        })

    def save_hourly(self, cell_id: str, points: list[dict]) -> None:
        # Keep a compact latest slice (first 72 hours) to stay under Dynamo item limits.
        compact = points[:72]
        self.table.put_item(Item={
            "pk": self._pk(),
            "sk": f"HOURLY#{cell_id}",
            "entity": "weather_hourly",
            "cell_id": cell_id,
            "data": _decimal_safe({"points": compact, "truncated": len(points) > 72}),
            "updated_at": utc_now(),
        })

    def save_features(self, cell_id: str, feature_map: dict, meta: dict) -> None:
        payload = {"features": feature_map, **meta}
        self.table.put_item(Item={
            "pk": self._pk(),
            "sk": f"FEATURES#{cell_id}",
            "entity": "weather_features",
            "cell_id": cell_id,
            "data": _decimal_safe(payload),
            "updated_at": utc_now(),
        })

    def get_features(self, cell_id: str) -> dict | None:
        res = self.table.get_item(Key={"pk": self._pk(), "sk": f"FEATURES#{cell_id}"})
        item = res.get("Item")
        return item.get("data") if item else None

    def save_context(self, ctx: dict) -> None:
        self.table.put_item(Item={
            "pk": self._pk(),
            "sk": f"CTX#{ctx['farm_id']}",
            "entity": "farm_weather_context",
            "farm_id": ctx["farm_id"],
            "cell_id": ctx.get("forecast_cell_id"),
            "data": _decimal_safe(ctx),
            "updated_at": utc_now(),
        })

    def list_contexts_for_cells(self, cell_ids: set[str]) -> list[dict]:
        # Staging: query all contexts for system partition (paginate as fleet grows).
        from boto3.dynamodb.conditions import Key
        res = self.table.query(KeyConditionExpression=Key("pk").eq(self._pk()) & Key("sk").begins_with("CTX#"))
        out = []
        for item in res.get("Items", []):
            data = item.get("data") or {}
            if data.get("forecast_cell_id") in cell_ids:
                out.append(data)
        return out

    def save_alert(self, alert: dict) -> None:
        farm_id = alert.get("farm_id") or alert.get("farmId")
        self.table.put_item(Item={
            "pk": f"FARMER#{alert.get('msid') or self.msid}",
            "sk": f"WALERT#{alert['id']}",
            "entity": "weather_alert",
            "farm_id": farm_id,
            "data": _decimal_safe(alert),
            "updated_at": utc_now(),
        })
        # Also index under weather system for ops
        self.table.put_item(Item={
            "pk": self._pk(),
            "sk": f"ALERT#{alert['id']}",
            "entity": "weather_alert",
            "farm_id": farm_id,
            "data": _decimal_safe(alert),
            "updated_at": utc_now(),
        })

    def list_alerts_for_farm(self, farm_id: str) -> list[dict]:
        from boto3.dynamodb.conditions import Key
        res = self.table.query(KeyConditionExpression=Key("pk").eq(self._pk()) & Key("sk").begins_with("ALERT#"))
        return [item["data"] for item in res.get("Items", []) if (item.get("data") or {}).get("farm_id") == farm_id or (item.get("data") or {}).get("farmId") == farm_id]

    def get_alert(self, alert_id: str) -> dict | None:
        res = self.table.get_item(Key={"pk": self._pk(), "sk": f"ALERT#{alert_id}"})
        item = res.get("Item")
        return item.get("data") if item else None

    def set_health(self, snapshot: dict) -> None:
        self.table.put_item(Item={
            "pk": self._pk(),
            "sk": "HEALTH#LATEST",
            "entity": "weather_health",
            "data": _decimal_safe(snapshot),
            "updated_at": utc_now(),
        })

    def get_health(self) -> dict:
        res = self.table.get_item(Key={"pk": self._pk(), "sk": "HEALTH#LATEST"})
        item = res.get("Item")
        return (item or {}).get("data") or {"status": "unknown"}


def _decimal_safe(value: Any) -> Any:
    from decimal import Decimal
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: _decimal_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_decimal_safe(v) for v in value]
    return value
