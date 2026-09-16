from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .providers.kmd_cap import KmdCapProvider
from .providers.open_meteo import OpenMeteoProvider


def provider_health_snapshot(
    store_health: dict[str, Any] | None = None,
    *,
    forecast_provider: OpenMeteoProvider | None = None,
    official_provider: KmdCapProvider | None = None,
) -> dict[str, Any]:
    forecast_provider = forecast_provider or OpenMeteoProvider()
    official_provider = official_provider or KmdCapProvider()
    base = store_health or {}
    return {
        "service": "mkulima-weather-ews",
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "status": base.get("status") or "unknown",
        "numericalForecast": {
            "provider": forecast_provider.provider_name,
            "baseUrl": forecast_provider.base_url,
            **(base.get("numericalForecast") or {}),
        },
        "officialWarnings": {
            **official_provider.health(),
            **(base.get("officialWarnings") or {}),
        },
        "lanes": base.get("lanes") or {
            "model_derived_watch": "active",
            "official_warning": "inactive",
        },
        "schedule": {
            "ingestForecastHours": 3,
            "officialWarningMinutes": 15,
            "expireAlertsMinutes": 15,
            "providerHealthMinutes": 5,
        },
    }
