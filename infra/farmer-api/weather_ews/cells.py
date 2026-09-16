"""Forecast cell assignment — one provider call per occupied cell, not per farm."""

from __future__ import annotations

import math
from dataclasses import dataclass

from .models import FarmWeatherContext, ForecastLocation


@dataclass(frozen=True)
class CellAssignment:
    farm_id: str
    cell_id: str
    latitude: float
    longitude: float
    cell_lat: float
    cell_lng: float
    distance_to_cell_centroid_m: float
    assignment_method: str = "centroid_grid_v1"


def forecast_cell_id(latitude: float, longitude: float, precision: int = 1) -> str:
    """~5–10 km cells via decimal rounding. Prefer H3/PostGIS grid in production."""
    return f"{round(float(longitude), precision)}:{round(float(latitude), precision)}"


def cell_centroid(cell_id: str) -> tuple[float, float]:
    lng_s, lat_s = cell_id.split(":", 1)
    return float(lat_s), float(lng_s)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def assign_farm_to_cell(
    farm_id: str,
    latitude: float,
    longitude: float,
    *,
    farm_name: str = "",
    exposure: dict | None = None,
    enterprises: list | None = None,
    precision: int = 1,
) -> FarmWeatherContext:
    cell_id = forecast_cell_id(latitude, longitude, precision=precision)
    cell_lat, cell_lng = cell_centroid(cell_id)
    distance = haversine_m(latitude, longitude, cell_lat, cell_lng)
    from datetime import datetime, timezone

    return FarmWeatherContext(
        farm_id=farm_id,
        forecast_cell_id=cell_id,
        latitude=latitude,
        longitude=longitude,
        assigned_at=datetime.now(timezone.utc).isoformat(),
        assignment_method="centroid_grid_v1",
        distance_to_cell_centroid_m=round(distance, 1),
        assignment_version="v1",
        farm_name=farm_name,
        exposure=exposure or {},
        enterprises=enterprises or [],
    )


def unique_locations(contexts: list[FarmWeatherContext]) -> list[ForecastLocation]:
    seen: dict[str, ForecastLocation] = {}
    for ctx in contexts:
        if ctx.forecast_cell_id in seen:
            continue
        cell_lat, cell_lng = cell_centroid(ctx.forecast_cell_id)
        seen[ctx.forecast_cell_id] = ForecastLocation(
            cell_id=ctx.forecast_cell_id,
            latitude=cell_lat,
            longitude=cell_lng,
        )
    return list(seen.values())
