"""Fetch the KAMIS produce catalogue from a host that can reach kilimo.go.ke.

Lambda in us-east-1 often times out on that site. Run this on a machine that
can open KAMIS, then write SYSTEM#MARKET / KAMIS#SNAPSHOT.
"""

from __future__ import annotations

import json
import os
import time
from decimal import Decimal

from market_intelligence import KAMIS_PRODUCTS, fetch_kamis_product, utcnow


def ingest_all() -> list[dict]:
    rows: list[dict] = []
    seen: set[tuple[str, str, str, str]] = set()
    for product_id, label in KAMIS_PRODUCTS:
        try:
            batch = fetch_kamis_product(product_id, label)
            print(f"ok {product_id} {label} {len(batch)}")
        except Exception as exc:
            print(f"fail {product_id} {label} {type(exc).__name__}: {exc}")
            continue
        for row in batch:
            key = (
                str(row.get("source_commodity") or ""),
                str(row.get("market") or ""),
                str(row.get("observed_at") or ""),
                str(row.get("source_quote") or ""),
            )
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)
    return rows


def compact(rows: list[dict]) -> list[dict]:
    latest: dict[tuple[str, str], dict] = {}
    for row in rows:
        key = (str(row.get("commodity") or ""), str(row.get("market") or ""))
        current = latest.get(key)
        if not current or (row.get("observed_at") or "") > (current.get("observed_at") or ""):
            latest[key] = row
    return list(latest.values())


def to_attr(value):
    if value is None:
        return {"NULL": True}
    if isinstance(value, bool):
        return {"BOOL": value}
    if isinstance(value, (int, float, Decimal)):
        return {"N": str(value)}
    if isinstance(value, list):
        return {"L": [to_attr(item) for item in value]}
    if isinstance(value, dict):
        return {"M": {str(key): to_attr(item) for key, item in value.items() if item is not None}}
    return {"S": str(value)}


def write_put_item(rows: list[dict], path: str) -> None:
    payload = {
        "pk": "SYSTEM#MARKET",
        "sk": "KAMIS#SNAPSHOT",
        "rows": rows,
        "at": time.time(),
        "ingestedAt": utcnow(),
        "source": "KAMIS",
    }
    with open(path, "w", encoding="utf-8") as handle:
        json.dump({"TableName": os.environ.get("TABLE_NAME") or "mkulima-farmer-staging", "Item": to_attr(payload)["M"]}, handle)
    print(f"wrote {path} rows={len(rows)} commodities={len({row.get('commodity') for row in rows})}")


if __name__ == "__main__":
    catalog = ingest_all()
    print("total", len(catalog), "commodities", sorted({str(row.get("commodity")) for row in catalog}))
    if catalog:
        write_put_item(compact(catalog), "kamis-put-item.json")
