"""Celery beat schedule for production workers.

Lambda / EventBridge can mirror the same cadence without Celery.
"""

from __future__ import annotations

# Documented schedule — wire to Celery when a worker fleet exists.
CELERY_BEAT_SCHEDULE = {
    "ingest-weather-forecast": {
        "task": "weather.ingest_forecast",
        "schedule": 3 * 60 * 60,
    },
    "check-official-warnings": {
        "task": "weather.ingest_official_warnings",
        "schedule": 15 * 60,
    },
    "expire-weather-alerts": {
        "task": "weather.expire_alerts",
        "schedule": 15 * 60,
    },
    "provider-health-check": {
        "task": "weather.provider_health",
        "schedule": 5 * 60,
    },
}


def try_register_celery(app) -> None:
    """Optional: register tasks if Celery is installed."""
    try:
        from celery import shared_task  # type: ignore
    except ImportError:
        return

    @shared_task(name="weather.ingest_forecast")
    def ingest_forecast():
        from .cli import run_ingest_from_env
        return run_ingest_from_env()

    @shared_task(name="weather.ingest_official_warnings")
    def ingest_official_warnings():
        from .providers.kmd_cap import KmdCapProvider
        return KmdCapProvider().health()

    @shared_task(name="weather.expire_alerts")
    def expire_alerts():
        return {"ok": True, "note": "Expiry runs inside ingest recalculation and API reads."}

    @shared_task(name="weather.provider_health")
    def provider_health():
        from .health import provider_health_snapshot
        return provider_health_snapshot()

    app.conf.beat_schedule = {**getattr(app.conf, "beat_schedule", {}), **CELERY_BEAT_SCHEDULE}
