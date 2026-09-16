from __future__ import annotations

from typing import Protocol, runtime_checkable

from ..models import ForecastLocation, ForecastPoint


@runtime_checkable
class ForecastProvider(Protocol):
    """Replaceable numerical forecast lane (Open-Meteo, ECMWF, KMD licensed, etc.)."""

    provider_name: str
    provider_type: str  # numerical_forecast

    async def fetch(self, locations: list[ForecastLocation]) -> list[ForecastPoint]:
        ...


@runtime_checkable
class OfficialWarningProvider(Protocol):
    """Official bulletin lane — only this lane may set official_warning=True."""

    provider_name: str
    authority_code: str  # KMD | NDMA | ICPAC | COUNTY

    async def fetch_active(self) -> list[dict]:
        """Return CAP-like records exactly as issued (normalized envelope, raw preserved)."""
        ...
