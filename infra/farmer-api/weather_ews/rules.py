"""Versioned preparedness thresholds — calibrate against Kenyan history before production."""

from __future__ import annotations

from typing import Any

RULES_VERSION = "mkulima-thresholds-v1"

# Provisional operational thresholds — not official KMD criteria.
RULES: list[dict[str, Any]] = [
    {
        "rule_id": "heavy_rain_watch_v1",
        "hazard": "heavy_rain",
        "conditions": {
            "rain_24h_mm": {">=": 20},
            "rain_prob_24h_pct": {">=": 60},
        },
        "or_conditions": {
            "rain_6h_mm": {">=": 12},
            "rain_prob_6h_pct": {">=": 70},
        },
        "exposure_boost": ["nearWaterway", "poorDrainage", "steepSlope"],
        "output": {
            "base_level": "outlook",
            "elevated_level": "watch",
            "action_set": "rain_preparedness_v1",
        },
    },
    {
        "rule_id": "heat_watch_v1",
        "hazard": "heat",
        "conditions": {
            "temp_max_24h_c": {">=": 32},
            "heat_stress_hours_24h": {">=": 3},
        },
        "output": {
            "base_level": "watch",
            "elevated_level": "watch",
            "action_set": "heat_preparedness_v1",
        },
    },
    {
        "rule_id": "dry_spell_outlook_v1",
        "hazard": "drought",
        "conditions": {
            "rain_72h_mm": {"<=": 1},
            "rain_prob_72h_pct": {"<=": 20},
            "temp_max_24h_c": {">=": 28},
        },
        "output": {
            "base_level": "outlook",
            "elevated_level": "outlook",
            "action_set": "dry_spell_v1",
        },
    },
    {
        "rule_id": "wind_watch_v1",
        "hazard": "wind",
        "conditions": {
            "wind_gust_max_24h_kmh": {">=": 45},
        },
        "output": {
            "base_level": "watch",
            "elevated_level": "watch",
            "action_set": "wind_preparedness_v1",
        },
    },
]


ACTION_SETS: dict[str, list[dict[str, str]]] = {
    "rain_preparedness_v1": [
        {"id": "safe", "label": "People first", "detail": "Avoid rivers, culverts and flooded roads."},
        {"id": "animals", "label": "Move animals only if safe", "detail": "Do not risk lives for livestock."},
        {"id": "harvest", "label": "Protect harvest or store", "detail": "Cover bags and reduce water ingress."},
    ],
    "heat_preparedness_v1": [
        {"id": "water", "label": "Keep water available", "detail": "For people and animals."},
        {"id": "shade", "label": "Provide shade", "detail": "Reduce midday heavy work."},
    ],
    "dry_spell_v1": [
        {"id": "budget", "label": "Budget water", "detail": "Prioritise drinking and livestock."},
        {"id": "feed", "label": "Check feed and pasture", "detail": "Store fodder if pasture is thinning."},
    ],
    "wind_preparedness_v1": [
        {"id": "secure", "label": "Secure loose covers", "detail": "Check roofs and drying racks."},
        {"id": "spray", "label": "Delay spraying", "detail": "Strong gusts waste spray and raise drift risk."},
    ],
}


def evaluate_rules(features: dict[str, float | None], exposure: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    exposure = exposure or {}
    hits: list[dict[str, Any]] = []
    for rule in RULES:
        if not _match(rule.get("conditions") or {}, features):
            alt = rule.get("or_conditions")
            if not alt or not _match(alt, features):
                continue
        boosted = any(bool(exposure.get(key)) for key in (rule.get("exposure_boost") or []))
        output = rule["output"]
        level = output["elevated_level"] if boosted else output["base_level"]
        hits.append({
            "rule_id": rule["rule_id"],
            "hazard": rule["hazard"],
            "level": level,
            "action_set": output["action_set"],
            "actions": ACTION_SETS.get(output["action_set"], []),
            "boosted": boosted,
            "rules_version": RULES_VERSION,
        })
    return hits


def _match(conditions: dict[str, dict[str, float]], features: dict[str, float | None]) -> bool:
    for feature, ops in conditions.items():
        value = features.get(feature)
        if value is None:
            return False
        for op, threshold in ops.items():
            if op == ">=" and not (value >= threshold):
                return False
            if op == "<=" and not (value <= threshold):
                return False
            if op == ">" and not (value > threshold):
                return False
            if op == "<" and not (value < threshold):
                return False
    return True
