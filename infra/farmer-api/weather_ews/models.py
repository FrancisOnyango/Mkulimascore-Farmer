from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class AlertOrigin(str, Enum):
    OFFICIAL_WARNING = "official_warning"
    MODEL_DERIVED_WATCH = "model_derived_watch"
    FIELD_OBSERVATION = "field_observation"
    FARMER_REPORT = "farmer_report"
    COMBINED_ASSESSMENT = "combined_assessment"


class AlertStatus(str, Enum):
    DETECTED = "detected"
    OUTLOOK = "outlook"
    ADVISORY = "advisory"
    WATCH = "watch"
    WARNING = "warning"
    OBSERVED_IMPACT = "observed_impact"
    DOWNGRADED = "downgraded"
    EXPIRED = "expired"
    RECOVERY = "recovery"
    CLOSED = "closed"


@dataclass(frozen=True)
class ForecastLocation:
    cell_id: str
    latitude: float
    longitude: float


@dataclass(frozen=True)
class ForecastPoint:
    cell_id: str
    valid_at: datetime
    precipitation_mm: float | None
    precipitation_probability: float | None
    temperature_c: float | None
    humidity_pct: float | None
    wind_speed_kmh: float | None
    wind_gust_kmh: float | None
    et0_mm: float | None
    soil_moisture_surface: float | None
    soil_moisture_root_zone: float | None
    weather_code: int | None
    issued_at: datetime | None = None


@dataclass
class FarmWeatherContext:
    farm_id: str
    forecast_cell_id: str
    latitude: float
    longitude: float
    assigned_at: str
    assignment_method: str = "centroid_grid_v1"
    distance_to_cell_centroid_m: float | None = None
    farm_elevation_m: float | None = None
    terrain_class: str | None = None
    flood_exposure_class: str | None = None
    assignment_version: str = "v1"
    farm_name: str = ""
    exposure: dict[str, Any] = field(default_factory=dict)
    enterprises: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class WeatherFeature:
    name: str
    value: float | None
    unit: str
    window_start: str
    window_end: str
    calculation_version: str
    source_run_ids: list[str]
    freshness: str
    confidence: str


@dataclass
class WeatherAlertEvent:
    id: str
    farm_id: str
    hazard_type: str
    alert_origin: AlertOrigin
    official_authority: str | None
    level: str
    status: AlertStatus
    first_detected_at: str
    issued_at: str
    valid_from: str
    valid_until: str
    last_evaluated_at: str
    supersedes_alert_id: str | None
    trigger_summary: str
    confidence: str
    recommended_action_set_id: str
    source_run_ids: list[str]
    acknowledged_at: str | None = None
    closed_at: str | None = None
    closure_reason: str | None = None
    title: str = ""
    plain_language_message: str = ""
    official_warning: bool = False
    actions: list[dict[str, str]] = field(default_factory=list)
    farm_name: str = ""
    language: str = "en"

    def to_farmer_card(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "farmId": self.farm_id,
            "farmName": self.farm_name,
            "level": self.level if self.level != "advisory" else "outlook",
            "hazardType": self.hazard_type,
            "title": self.title,
            "plainLanguageMessage": self.plain_language_message,
            "actions": self.actions,
            "source": self.official_authority or "MKULIMA_PREPAREDNESS",
            "sourceLabel": (
                "Official · Kenya Meteorological Service Authority"
                if self.official_warning and self.official_authority == "KMD"
                else "Official · NDMA"
                if self.official_warning and self.official_authority == "NDMA"
                else "Mkulima preparedness watch — not an official warning"
            ),
            "officialWarning": self.official_warning,
            "alertOrigin": self.alert_origin.value,
            "issuedAt": self.issued_at,
            "validUntil": self.valid_until,
            "status": "acknowledged" if self.acknowledged_at else (
                "expired" if self.status in (AlertStatus.EXPIRED, AlertStatus.CLOSED) else "active"
            ),
            "acknowledgedAt": self.acknowledged_at,
            "language": self.language,
        }
