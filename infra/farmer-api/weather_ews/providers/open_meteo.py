"""Open-Meteo numerical forecast adapter.

Public endpoint is for non-commercial / controlled development.
Set OPEN_METEO_BASE_URL to a commercial or self-hosted endpoint for production.
See https://open-meteo.com/en/docs and https://open-meteo.com/
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

from ..models import ForecastLocation, ForecastPoint

HOURLY_VARS = (
    "precipitation",
    "precipitation_probability",
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_gusts_10m",
    "et0_fao_evapotranspiration",
    "soil_moisture_0_to_1cm",
    "soil_moisture_9_to_27cm",
    "weather_code",
)


class OpenMeteoProvider:
    provider_name = "open_meteo"
    provider_type = "numerical_forecast"

    def __init__(
        self,
        base_url: str | None = None,
        forecast_days: int = 7,
        timeout_s: float = 20.0,
        batch_size: int = 20,
    ):
        # Commercial / self-hosted override; public URL is development default only.
        self.base_url = (base_url or os.environ.get("OPEN_METEO_BASE_URL") or "https://api.open-meteo.com/v1/forecast").rstrip("/")
        self.forecast_days = forecast_days
        self.timeout_s = timeout_s
        self.batch_size = max(1, batch_size)

    async def fetch(self, locations: list[ForecastLocation]) -> list[ForecastPoint]:
        # Sync HTTP under async surface so Lambda can call without extra deps.
        return self.fetch_sync(locations)

    def fetch_sync(self, locations: list[ForecastLocation]) -> list[ForecastPoint]:
        if not locations:
            return []
        points: list[ForecastPoint] = []
        issued_at = datetime.now(timezone.utc)
        for start in range(0, len(locations), self.batch_size):
            batch = locations[start : start + self.batch_size]
            points.extend(self._fetch_batch(batch, issued_at))
        return points

    def _fetch_batch(self, batch: list[ForecastLocation], issued_at: datetime) -> list[ForecastPoint]:
        lats = ",".join(f"{loc.latitude:.5f}" for loc in batch)
        lngs = ",".join(f"{loc.longitude:.5f}" for loc in batch)
        query = urllib.parse.urlencode(
            {
                "latitude": lats,
                "longitude": lngs,
                "hourly": ",".join(HOURLY_VARS),
                "forecast_days": str(self.forecast_days),
                "timezone": "UTC",
            }
        )
        url = f"{self.base_url}?{query}"
        payload = self._http_get_json(url)
        # Single location → object; multi → list
        payloads = payload if isinstance(payload, list) else [payload]
        if len(payloads) != len(batch):
            # Fallback: some deployments return one object even for multi — zip carefully
            if len(payloads) == 1 and len(batch) == 1:
                pass
            elif len(payloads) != len(batch):
                raise ValueError(f"Open-Meteo returned {len(payloads)} payloads for {len(batch)} locations")
        out: list[ForecastPoint] = []
        for loc, item in zip(batch, payloads):
            out.extend(self._normalize_location(loc, item, issued_at))
        return out

    def _normalize_location(self, loc: ForecastLocation, item: dict[str, Any], issued_at: datetime) -> list[ForecastPoint]:
        hourly = item.get("hourly") or {}
        times = hourly.get("time") or []
        points: list[ForecastPoint] = []
        for index, stamp in enumerate(times):
            valid_at = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            if valid_at.tzinfo is None:
                valid_at = valid_at.replace(tzinfo=timezone.utc)
            points.append(
                ForecastPoint(
                    cell_id=loc.cell_id,
                    valid_at=valid_at,
                    precipitation_mm=_num(hourly.get("precipitation"), index),
                    precipitation_probability=_num(hourly.get("precipitation_probability"), index),
                    temperature_c=_num(hourly.get("temperature_2m"), index),
                    humidity_pct=_num(hourly.get("relative_humidity_2m"), index),
                    wind_speed_kmh=_num(hourly.get("wind_speed_10m"), index),
                    wind_gust_kmh=_num(hourly.get("wind_gusts_10m"), index),
                    et0_mm=_num(hourly.get("et0_fao_evapotranspiration"), index),
                    soil_moisture_surface=_num(hourly.get("soil_moisture_0_to_1cm"), index),
                    soil_moisture_root_zone=_num(hourly.get("soil_moisture_9_to_27cm"), index),
                    weather_code=_int(hourly.get("weather_code"), index),
                    issued_at=issued_at,
                )
            )
        return points

    def _http_get_json(self, url: str) -> Any:
        req = urllib.request.Request(url, headers={"User-Agent": "MkulimaScore-WeatherEWS/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_s) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Open-Meteo HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Open-Meteo unreachable: {exc.reason}") from exc


def _num(series: list | None, index: int) -> float | None:
    if not series or index >= len(series) or series[index] is None:
        return None
    try:
        return float(series[index])
    except (TypeError, ValueError):
        return None


def _int(series: list | None, index: int) -> int | None:
    value = _num(series, index)
    return int(value) if value is not None else None
