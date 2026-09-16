"""CLI / Lambda entry for forecast ingestion."""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

from .cells import assign_farm_to_cell
from .health import provider_health_snapshot
from .ingest import ingest_forecast_run
from .store import MemoryWeatherStore

# Process-global store for Lambda warm starts (Dynamo adapter replaces in production).
GLOBAL_STORE = MemoryWeatherStore()


def farms_from_payload(payload: list[dict[str, Any]]) -> list:
    contexts = []
    for farm in payload:
        lat = farm.get("latitude")
        lng = farm.get("longitude")
        if lat is None or lng is None:
            continue
        contexts.append(
            assign_farm_to_cell(
                str(farm["id"]),
                float(lat),
                float(lng),
                farm_name=str(farm.get("name") or farm["id"]),
                exposure=farm.get("exposure") or {},
                enterprises=farm.get("enterprises") or [],
            )
        )
    return contexts


def run_ingest(farms: list[dict[str, Any]], *, force: bool = False, store=None) -> dict:
    store = store or GLOBAL_STORE
    contexts = farms_from_payload(farms)
    if not contexts:
        return {"run": {"status": "skipped", "error_summary": "No farms with coordinates"}, "alerts": [], "changed_cells": []}
    return ingest_forecast_run(contexts, store=store, force=force)


def run_ingest_from_env() -> dict:
    raw = os.environ.get("WEATHER_INGEST_FARMS_JSON", "[]")
    farms = json.loads(raw)
    return run_ingest(farms, force=os.environ.get("WEATHER_INGEST_FORCE") == "1")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Mkulima weather EWS ingest")
    parser.add_argument("--farms-json", help="Path to farms JSON array with id, latitude, longitude")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--health", action="store_true")
    args = parser.parse_args(argv)
    if args.health:
        print(json.dumps(provider_health_snapshot(GLOBAL_STORE.get_health()), indent=2))
        return 0
    if not args.farms_json:
        print("Provide --farms-json or use --health", file=sys.stderr)
        return 2
    with open(args.farms_json, encoding="utf-8") as handle:
        farms = json.load(handle)
    result = run_ingest(farms, force=args.force)
    print(json.dumps(result, indent=2, default=str))
    return 0 if result.get("run", {}).get("status") in ("succeeded", "skipped") else 1


if __name__ == "__main__":
    raise SystemExit(main())
