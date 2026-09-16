"""Official KMD CAP warning lane.

Production must use an approved machine-readable CAP feed from KMD — not HTML scraping.
Until credentials/endpoint are confirmed, this provider returns an empty feed and reports
health as configured_but_inactive. See https://meteo.go.ke/weather-warnings/
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any


class KmdCapProvider:
    provider_name = "kmd_cap"
    authority_code = "KMD"

    def __init__(self, feed_url: str | None = None, timeout_s: float = 15.0):
        self.feed_url = feed_url or os.environ.get("KMD_CAP_FEED_URL", "").strip()
        self.timeout_s = timeout_s

    @property
    def configured(self) -> bool:
        return bool(self.feed_url)

    async def fetch_active(self) -> list[dict[str, Any]]:
        return self.fetch_active_sync()

    def fetch_active_sync(self) -> list[dict[str, Any]]:
        if not self.feed_url:
            return []
        # Placeholder for CAP Atom/XML parse once KMD confirms the stable endpoint.
        # Do not scrape HTML. Do not invent official warnings.
        raise RuntimeError(
            "KMD_CAP_FEED_URL is set but CAP parsing is pending KMD feed confirmation. "
            "Unset the URL to keep the official lane inactive."
        )

    def health(self) -> dict[str, Any]:
        return {
            "provider": self.provider_name,
            "authority": self.authority_code,
            "configured": self.configured,
            "status": "configured_pending_feed" if self.configured else "inactive_awaiting_kmd_access",
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "note": "Official KMD Warning labels require a real CAP record. Model watches never use this lane.",
        }
