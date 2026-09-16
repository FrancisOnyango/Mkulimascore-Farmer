"""Live early-warning weather package for MkulimaScore.

Two independent lanes:
1. Numerical forecast (Open-Meteo behind ForecastProvider) → model_derived_watch
2. Official warning feed (KMD CAP etc.) → official_warning only when a real bulletin exists

Never present a model-derived preparedness signal as an official KMD/NDMA warning.
"""

from .cells import assign_farm_to_cell, forecast_cell_id
from .features import build_agricultural_features
from .health import provider_health_snapshot
from .ingest import ingest_forecast_run, recalculate_farm_alerts
from .lifecycle import AlertLifecycle, AlertStatus, AlertOrigin
from .models import ForecastLocation, ForecastPoint, FarmWeatherContext, WeatherAlertEvent
from .providers.base import ForecastProvider, OfficialWarningProvider
from .providers.open_meteo import OpenMeteoProvider
from .providers.kmd_cap import KmdCapProvider

__all__ = [
    "AlertLifecycle",
    "AlertOrigin",
    "AlertStatus",
    "FarmWeatherContext",
    "ForecastLocation",
    "ForecastPoint",
    "ForecastProvider",
    "KmdCapProvider",
    "OfficialWarningProvider",
    "OpenMeteoProvider",
    "WeatherAlertEvent",
    "assign_farm_to_cell",
    "build_agricultural_features",
    "forecast_cell_id",
    "ingest_forecast_run",
    "provider_health_snapshot",
    "recalculate_farm_alerts",
]
