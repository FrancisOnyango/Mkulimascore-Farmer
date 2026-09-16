"""Agricultural weather features derived from hourly forecast points."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

from .models import ForecastPoint, WeatherFeature

CALC_VERSION = "ag-features-v1"


def build_agricultural_features(
    points: list[ForecastPoint],
    *,
    now: datetime | None = None,
    source_run_id: str = "",
    max_age_hours: float = 6.0,
) -> list[WeatherFeature]:
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    ordered = sorted(points, key=lambda p: p.valid_at)
    if not ordered:
        return []

    issued = ordered[0].issued_at or now
    age_h = (now - issued).total_seconds() / 3600.0
    freshness = "fresh" if age_h <= max_age_hours else "stale"
    confidence = "medium" if freshness == "fresh" else "low"
    run_ids = [source_run_id] if source_run_id else []

    def window(hours: int) -> list[ForecastPoint]:
        end = now + timedelta(hours=hours)
        return [p for p in ordered if now <= _aware(p.valid_at) <= end]

    features: list[WeatherFeature] = []
    for hours in (6, 24, 72):
        chunk = window(hours)
        rain = _sum(p.precipitation_mm for p in chunk)
        prob = _max(p.precipitation_probability for p in chunk)
        features.append(_f(f"rain_{hours}h_mm", rain, "mm", now, hours, run_ids, freshness, confidence))
        features.append(_f(f"rain_prob_{hours}h_pct", prob, "%", now, hours, run_ids, freshness, confidence))
        features.append(_f(f"max_hourly_rain_{hours}h_mm", _max(p.precipitation_mm for p in chunk), "mm", now, hours, run_ids, freshness, confidence))
        features.append(_f(f"temp_max_{hours}h_c", _max(p.temperature_c for p in chunk), "C", now, hours, run_ids, freshness, confidence))
        features.append(_f(f"temp_min_{hours}h_c", _min(p.temperature_c for p in chunk), "C", now, hours, run_ids, freshness, confidence))
        features.append(_f(f"wind_gust_max_{hours}h_kmh", _max(p.wind_gust_kmh for p in chunk), "km/h", now, hours, run_ids, freshness, confidence))
        heat_hours = sum(1 for p in chunk if (p.temperature_c or 0) >= 32)
        features.append(_f(f"heat_stress_hours_{hours}h", float(heat_hours), "hours", now, hours, run_ids, freshness, confidence))

    week = window(24 * 7)
    et0 = _sum(p.et0_mm for p in week)
    rain7 = _sum(p.precipitation_mm for p in week)
    features.append(_f("et0_7d_mm", et0, "mm", now, 24 * 7, run_ids, freshness, confidence))
    features.append(_f("water_balance_7d_mm", (rain7 - et0) if rain7 is not None and et0 is not None else None, "mm", now, 24 * 7, run_ids, freshness, confidence))
    features.append(_f("soil_moisture_surface_latest", _latest(ordered, "soil_moisture_surface"), "m3/m3", now, 1, run_ids, freshness, confidence))
    features.append(_f("soil_moisture_root_latest", _latest(ordered, "soil_moisture_root_zone"), "m3/m3", now, 1, run_ids, freshness, confidence))
    features.append(_f("forecast_age_hours", round(age_h, 2), "hours", now, 0, run_ids, freshness, confidence))
    return features


def features_as_map(features: list[WeatherFeature]) -> dict[str, float | None]:
    return {item.name: item.value for item in features}


def _f(name, value, unit, now, hours, run_ids, freshness, confidence) -> WeatherFeature:
    end = now + timedelta(hours=hours)
    return WeatherFeature(
        name=name,
        value=value,
        unit=unit,
        window_start=now.isoformat(),
        window_end=end.isoformat(),
        calculation_version=CALC_VERSION,
        source_run_ids=list(run_ids),
        freshness=freshness,
        confidence=confidence,
    )


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _sum(values: Iterable[float | None]) -> float | None:
    nums = [v for v in values if v is not None]
    return round(sum(nums), 2) if nums else None


def _max(values: Iterable[float | None]) -> float | None:
    nums = [v for v in values if v is not None]
    return round(max(nums), 2) if nums else None


def _min(values: Iterable[float | None]) -> float | None:
    nums = [v for v in values if v is not None]
    return round(min(nums), 2) if nums else None


def _latest(points: list[ForecastPoint], attr: str) -> float | None:
    for point in reversed(points):
        value = getattr(point, attr, None)
        if value is not None:
            return float(value)
    return None
