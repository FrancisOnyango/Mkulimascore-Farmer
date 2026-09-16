"""Material-change detection between consecutive forecast feature maps."""

from __future__ import annotations

from typing import Any


THRESHOLDS = {
    "rain_24h_mm": 5.0,
    "rain_prob_24h_pct": 15.0,
    "temp_max_24h_c": 2.0,
    "wind_gust_max_24h_kmh": 10.0,
    "heat_stress_hours_24h": 2.0,
}


def material_changes(
    previous: dict[str, float | None] | None,
    current: dict[str, float | None],
) -> list[dict[str, Any]]:
    if not previous:
        return [{"feature": key, "reason": "first_run", "previous": None, "current": value} for key, value in current.items() if value is not None]

    changes: list[dict[str, Any]] = []
    for key, threshold in THRESHOLDS.items():
        before = previous.get(key)
        after = current.get(key)
        if before is None or after is None:
            if after is not None and before is None:
                changes.append({"feature": key, "reason": "became_available", "previous": before, "current": after})
            continue
        if abs(after - before) >= threshold:
            changes.append({
                "feature": key,
                "reason": "threshold_crossed",
                "previous": before,
                "current": after,
                "delta": round(after - before, 2),
            })
    return changes


def is_material(previous: dict[str, float | None] | None, current: dict[str, float | None]) -> bool:
    return bool(material_changes(previous, current))
