# Live Weather Early Warning System (first dynamic release)

Two independent lanes:

1. **Numerical forecast** — Open-Meteo behind `ForecastProvider` → `model_derived_watch` / Mkulima preparedness only.
2. **Official warnings** — KMD CAP (and later NDMA) → `official_warning` only when a real bulletin exists.

Model output is never labelled “Official KMD Warning.”

## Package

`infra/farmer-api/weather_ews/`

| Module | Role |
| --- | --- |
| `providers/open_meteo.py` | Batchable Open-Meteo adapter ([docs](https://open-meteo.com/en/docs)) |
| `providers/kmd_cap.py` | Official lane stub until KMD feed access is confirmed ([warnings](https://meteo.go.ke/weather-warnings/)) |
| `cells.py` | ~5–10 km forecast cells; farms share one request per occupied cell |
| `features.py` | 6 / 24 / 72 h agricultural features |
| `material_change.py` | Skip noise; recalculate only material cell changes |
| `rules.py` | Versioned thresholds (`mkulima-thresholds-v1`) |
| `lifecycle.py` | Detected → Outlook/Advisory/Watch/Warning → Expired/Closed |
| `ingest.py` | Fetch → raw retain → normalize → features → alerts |
| `schedule.py` | Celery beat cadence (3h forecast, 15m official/expiry) |
| `dynamo_store.py` | Dynamo persistence for Lambda |
| `cli.py` | Local ingest runner |

## API

| Method | Path |
| --- | --- |
| GET | `/api/v1/ops/weather/health` |
| POST | `/api/v1/ops/weather/ingest` |
| GET | `/api/v1/farmer/farms/{id}/weather-timeline` |
| GET | `/api/v1/farmer/farms/{id}/preparedness-actions` |
| POST | `/api/v1/farmer/weather-alerts/{id}/acknowledge` |
| POST | `/api/v1/farmer/weather-alerts/{id}/impact-reports` |
| POST | `/api/v1/farmer/farms/{id}/exposure-observations` |
| POST | `/api/v1/impact-reports/{id}/verify` (501 — Collect/ops) |
| POST | `/api/v1/weather-alerts/{id}/escalate` |
| POST | `/api/v1/weather-alerts/{id}/close` |

## Local ingest

```bash
cd infra/farmer-api
python -m weather_ews.cli --farms-json farms.sample.json --force
python -m weather_ews.cli --health
```

Set `OPEN_METEO_BASE_URL` to a commercial or self-hosted endpoint for production ([licensing](https://open-meteo.com/)). Public Open-Meteo is for non-commercial / controlled development only.

Set `KMD_CAP_FEED_URL` only after KMD confirms a machine-readable CAP feed. Do not scrape HTML.

## App

- Live refresh still uses Open-Meteo at the **forecast cell** centroid with freshness labels.
- Preparedness watches carry `alertOrigin: model_derived_watch`.
- Settings shows dual-lane weather health.
- Ack / impact post to dedicated APIs when the live backend is enabled, and always persist locally.
