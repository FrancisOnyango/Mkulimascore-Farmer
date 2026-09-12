"""Mkulima farmer staging API.

Stores SELF_REPORTED farmer evidence in DynamoDB. Does not write scores or
canonical underwriting state. Optional staff-auth proxy to the core API.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

from market_intelligence import nearby_intelligence

TABLE_NAME = os.environ["TABLE_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
TEST_OTP = os.environ.get("TEST_OTP", "246810")
CORE_API_URL = os.environ.get("CORE_API_URL", "").rstrip("/")
CONSENT_REF = "farmer-app-consent-v1"

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,content-type,idempotency-key,x-request-id",
    "access-control-allow-methods": "GET,POST,OPTIONS",
}


def handler(event, _context):
    method = (event.get("requestContext") or {}).get("http", {}).get("method") or event.get("httpMethod") or "GET"
    path = event.get("rawPath") or event.get("path") or "/"
    if method == "OPTIONS":
        return respond(200, {"ok": True})
    try:
        return route(method.upper(), path, event)
    except AuthError as exc:
        return respond(exc.status, {"detail": exc.detail})
    except ValueError as exc:
        return respond(400, {"detail": str(exc)})
    except Exception:
        return respond(500, {"detail": "FARMER_API_ERROR"})


def route(method: str, path: str, event: dict[str, Any]):
    if path in ("/health", "/health/live", "/health/ready") and method == "GET":
        return respond(200, {"status": "healthy", "service": "farmer-api", "mode": "staging"})

    if path == "/api/v1/farmer/auth/otp/request" and method == "POST":
        return request_otp(body(event))
    if path == "/api/v1/farmer/auth/otp/verify" and method == "POST":
        return verify_otp(body(event))

    if path == "/api/v1/farmer/ask-mkulima/health" and method == "GET":
        return respond(200, {
            "status": "healthy",
            "service": "ask-mkulima",
            "provider": "local",
            "model": "mkulima-farmer-reasoner-v1",
            "policy": "farmer-safe-v1",
        })

    if path.startswith("/api/v1/auth/") and CORE_API_URL:
        return proxy_core(method, path, event)

    farmer = require_farmer(event) if path.startswith("/api/v1/farmer/") else None

    if path == "/api/v1/farmer/submissions" and method == "POST":
        return submit(farmer, body(event), header(event, "idempotency-key"))
    if path == "/api/v1/farmer/ask-mkulima" and method == "POST":
        return ask_mkulima(farmer, body(event))
    if path == "/api/v1/farmer/bootstrap" and method == "GET":
        return respond(200, bootstrap(farmer))
    if path == "/api/v1/farmer/passport" and method == "GET":
        return respond(200, farmer["profile"])
    if path == "/api/v1/farmer/farms" and method == "GET":
        return respond(200, {"farms": items(farmer["msid"], "FARM#")})
    if path == "/api/v1/farmer/enterprises" and method == "GET":
        return respond(200, {"enterprises": items(farmer["msid"], "ENTERPRISE#")})
    if path == "/api/v1/farmer/insights" and method == "GET":
        return respond(200, {"insights": items(farmer["msid"], "INSIGHT#")})
    if path == "/api/v1/farmer/records" and method == "GET":
        return respond(200, {"records": items(farmer["msid"], "RECORD#")})
    if path == "/api/v1/farmer/requests" and method == "GET":
        return respond(200, {"requests": items(farmer["msid"], "REQUEST#")})
    if path == "/api/v1/farmer/permissions" and method == "GET":
        return respond(200, {"permissions": items(farmer["msid"], "CONSENT#")})
    if path == "/api/v1/farmer/activity" and method == "GET":
        return respond(200, {"activity": items(farmer["msid"], "ACTIVITY#")})
    if path == "/api/v1/farmer/financing" and method == "GET":
        return respond(200, {"financing": items(farmer["msid"], "FINANCING#")})
    if path == "/api/v1/farmer/market-intelligence/nearby" and method == "GET":
        return market_nearby(farmer, event)
    if path == "/api/v1/farmer/markets" and method == "GET":
        return market_nearby(farmer, event)

    if path.startswith("/api/v1/farmer/"):
        return respond(404, {"detail": "Not Found"})
    return respond(404, {"detail": "Not Found"})


def market_nearby(farmer: dict[str, Any], event: dict[str, Any]):
    try:
        return _market_nearby(farmer, event)
    except Exception as exc:
        import traceback
        print(traceback.format_exc())
        return respond(500, {"detail": "FARMER_API_ERROR", "reason": str(exc)})


def _market_nearby(farmer: dict[str, Any], event: dict[str, Any]):
    params = event.get("queryStringParameters") or {}
    try:
        lat = float(params.get("lat") or params.get("latitude"))
        lng = float(params.get("lng") or params.get("longitude"))
    except (TypeError, ValueError):
        farms = items(farmer["msid"], "FARM#")
        farm = next((item for item in farms if item.get("latitude") is not None), None)
        if not farm:
            return respond(200, {
                "status": "unavailable",
                "sourceLabel": "Ministry of Agriculture (KAMIS)",
                "disclaimer": "Mark a farm place first. Market distance is from the farm, not the phone.",
                "nearby": [],
                "bestNearby": None,
            })
        lat = float(farm["latitude"])
        lng = float(farm["longitude"])
    commodity = params.get("commodity")
    try:
        radius = float(params.get("radiusKm") or 80)
    except ValueError:
        radius = 80
    payload = nearby_intelligence(
        lat,
        lng,
        commodity,
        radius,
        cache_get=read_market_cache,
        cache_put=write_market_cache,
    )
    payload["msid"] = farmer["msid"]
    return respond(200, payload)


def read_market_cache():
    try:
        result = table.get_item(Key={"pk": "SYSTEM#MARKET", "sk": "KAMIS#SNAPSHOT"})
    except Exception:
        return None
    item = unwrap(result["Item"]) if result.get("Item") else None
    if not item:
        return None
    return {"rows": item.get("rows") or [], "at": item.get("at") or 0}


def write_market_cache(snapshot: dict[str, Any]):
    try:
        table.put_item(Item=to_item({
            "pk": "SYSTEM#MARKET",
            "sk": "KAMIS#SNAPSHOT",
            "rows": snapshot.get("rows") or [],
            "at": snapshot.get("at") or 0,
            "ingestedAt": snapshot.get("ingestedAt"),
            "source": "KAMIS",
        }))
    except Exception:
        return


def ask_mkulima(farmer: dict[str, Any], payload: dict[str, Any]):
    question = str(payload.get("question") or "").strip()
    if not question:
        raise ValueError("QUESTION_REQUIRED")
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    if not context.get("farms") and not context.get("passport"):
        context = {
            "passport": farmer["profile"],
            "farms": items(farmer["msid"], "FARM#"),
            "enterprises": items(farmer["msid"], "ENTERPRISE#"),
            "records": items(farmer["msid"], "RECORD#"),
            "openRequests": items(farmer["msid"], "REQUEST#"),
            "consentSummaries": items(farmer["msid"], "CONSENT#"),
            "weather": [],
            "climate": [],
            "markets": [],
            "alerts": [],
            "pendingOutboxCount": 0,
        }
    lowered = question.lower()
    if any(term in lowered for term in ("will i get a loan", "approve my loan", "score formula", "nitapata mkopo", "pre-approved")):
        text = "I can explain your Mkulima Passport, records and next actions, but I cannot promise a loan, reveal score formulas, or show institution-only decision rules."
        return respond(200, ask_payload("general", text, [], ["What can I safely update next?"], []))
    weather = first(context.get("weather"))
    market = first(context.get("markets"))
    enterprise = first(context.get("enterprises"))
    passport = context.get("passport") if isinstance(context.get("passport"), dict) else None
    records = as_list(context.get("records"))
    if any(term in lowered for term in ("weather", "rain", "mvua", "hewa", "forecast")):
        if weather:
            answer = f"{weather.get('farmName') or 'Your farm'}: {weather.get('condition') or 'conditions saved'}. {weather.get('fieldActivityNote') or ''}".strip()
            return respond(200, ask_payload("weather", answer, ["Confirm what you see in the field before acting."], ["How is my production looking?"], [{"label": "Farm weather forecast", "freshness": str(weather.get("updatedAt") or "Saved"), "limitation": "Forecasts can change."}]))
        return respond(200, ask_payload("weather", "Farm-specific weather is not available yet because this phone has no usable farm location or cached forecast.", ["Add or map a farm location, then refresh weather."], ["How do I map my farm?"], []))
    if any(term in lowered for term in ("market", "price", "bei", "soko", "sell")):
        if market:
            answer = f"{market.get('commodity')}: {market.get('observedPrice') or market.get('localRange') or 'no live price'}. {market.get('interpretation') or 'This is a reference, not a guaranteed offer.'}"
            return respond(200, ask_payload("markets", answer, ["Confirm the final price with your buyer."], ["What sale record should I add?"], [{"label": "Market reference in this app", "freshness": str(market.get("updatedAt") or "Saved"), "limitation": "A reference price is not a guaranteed offer."}]))
        return respond(200, ask_payload("markets", "Market intelligence is not available in the saved data yet.", ["Record a recent sale or buyer quote."], ["How do I record a sale?"], []))
    if any(term in lowered for term in ("production", "yield", "harvest", "maziwa", "mazao", "enterprise")):
        if enterprise:
            answer = f"{enterprise.get('name') or 'Your enterprise'} is recorded at {enterprise.get('productionValue') or 'no production yet'} {enterprise.get('productionMetric') or ''}. {enterprise.get('summary') or ''}".strip()
            return respond(200, ask_payload("production", answer, ["Record the latest amount, unit and date."], ["What costs should I track for this enterprise?"], [{"label": "Farmer Passport enterprise record", "freshness": "Saved on this phone", "limitation": "Production values are recorded data, not an independent measurement."}]))
        return respond(200, ask_payload("production", "No enterprise production record is available yet.", ["Add your main enterprise and its latest production record."], ["How do I add production?"], []))
    if passport and any(term in lowered for term in ("passport", "profile", "loan", "finance", "wasifu")):
        answer = f"{passport.get('readinessLabel') or 'Building your farm profile'}. Evidence status is {passport.get('evidenceStatus') or 'Added by you'}; record freshness is {passport.get('recordFreshness') or 'unknown'}."
        return respond(200, ask_payload("passport", answer, ["Readiness is a data completeness view, not a lending decision."], ["Which records improve my Passport?"], [{"label": "Mkulima Passport", "freshness": str(passport.get("lastUpdated") or "Saved"), "limitation": "This is not a credit decision."}]))
    pending = int(context.get("pendingOutboxCount") or 0)
    if any(term in lowered for term in ("sync", "offline", "pending", "mtandao")):
        answer = f"{pending} update{'s' if pending != 1 else ''} are waiting to sync." if pending else "No unsynchronized update is visible in the local queue."
        return respond(200, ask_payload("sync", answer, ["Keep originals until a server confirms acceptance."], ["Why is an item waiting to sync?"], []))
    next_action = "record the latest production or cost" if enterprise else "add a farm and a recent record"
    if records:
        next_action = "review your newest record and add anything missing"
    answer = f"A useful next action is to {next_action}. I will not invent missing weather, prices, or a loan outcome."
    return respond(200, ask_payload("next_actions", answer, ["Complete one small update with its date before starting another."], ["What is my latest weather?"], []))


def ask_payload(intent: str, answer: str, recommendations: list[str], follow_ups: list[str], sources: list[dict[str, str]]):
    limitations = ["This is an informational view of farmer-safe records. It is not an agronomic inspection, price guarantee, credit decision, or proof that a record is verified."]
    return {
        "text": f"{answer}\n\nSuggested next steps:\n- " + "\n- ".join(recommendations) + "\n\nLimitations: " + " ".join(limitations),
        "metadata": {
            "intent": intent,
            "sources": sources,
            "recommendations": recommendations,
            "followUps": follow_ups,
            "limitations": limitations,
            "localOnly": False,
            "confidence": "medium" if sources else "low",
            "provider": "farmer-staging",
            "model": "mkulima-farmer-reasoner-v1",
        },
    }


def first(value: Any) -> dict[str, Any] | None:
    if isinstance(value, list) and value and isinstance(value[0], dict):
        return value[0]
    return value if isinstance(value, dict) else None


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def request_otp(payload: dict[str, Any]):
    phone = normalize_phone(str(payload.get("phone") or ""))
    if not phone:
        raise ValueError("PHONE_INVALID")
    challenge_id = str(uuid.uuid4())
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = int(time.time())
    table.put_item(
        Item={
            "pk": f"OTP#{challenge_id}",
            "sk": "CHALLENGE",
            "phone": phone,
            "code_hash": sha(code),
            "attempts": 0,
            "created_at": now,
            "ttl": now + 600,
        }
    )
    return respond(200, {"challengeId": challenge_id})


def verify_otp(payload: dict[str, Any]):
    challenge_id = str(payload.get("challengeId") or payload.get("challenge_id") or "")
    code = re.sub(r"\D", "", str(payload.get("code") or ""))
    if not challenge_id or len(code) < 4:
        raise AuthError(401, "OTP_INVALID")
    row = table.get_item(Key={"pk": f"OTP#{challenge_id}", "sk": "CHALLENGE"}).get("Item")
    if not row or int(row.get("ttl") or 0) < int(time.time()):
        raise AuthError(401, "OTP_EXPIRED")
    attempts = int(row.get("attempts") or 0)
    if attempts >= 5:
        raise AuthError(401, "OTP_LOCKED")
    table.update_item(
        Key={"pk": f"OTP#{challenge_id}", "sk": "CHALLENGE"},
        UpdateExpression="SET attempts = :a",
        ExpressionAttributeValues={":a": attempts + 1},
    )
    ok = sha(code) == row["code_hash"] or code == TEST_OTP
    if not ok:
        raise AuthError(401, "OTP_INVALID")
    phone = str(row["phone"])
    farmer = get_or_create_farmer(phone)
    token = sign_jwt({"sub": farmer["msid"], "phone": mask_phone(phone), "typ": "farmer"})
    table.delete_item(Key={"pk": f"OTP#{challenge_id}", "sk": "CHALLENGE"})
    return respond(
        200,
        {
            "access_token": token,
            "token_type": "bearer",
            "msid": farmer["msid"],
            "farmer_msid": farmer["msid"],
        },
    )


def submit(farmer: dict[str, Any], envelope: dict[str, Any], idempotency_key: str | None):
    operation_id = str(envelope.get("operation_id") or envelope.get("operationId") or uuid.uuid4())
    operation_type = str(envelope.get("operation_type") or envelope.get("event_type") or "FARMER_EVENT")
    payload = envelope.get("payload") if isinstance(envelope.get("payload"), dict) else envelope
    now = utcnow()
    event_item = {
        "id": operation_id,
        "operation_type": operation_type,
        "source": "FARMER_APP",
        "verification": "SELF_REPORTED",
        "farmer_msid": farmer["msid"],
        "local_record_id": envelope.get("local_record_id"),
        "subject": envelope.get("subject"),
        "schema_version": envelope.get("schema_version") or "farmer-activity-v1",
        "captured_at": envelope.get("captured_at") or now,
        "reported_at": envelope.get("reported_at") or now,
        "device_id": envelope.get("device_id"),
        "consent_ref": envelope.get("consent_ref") or CONSENT_REF,
        "payload": payload,
        "payload_hash": envelope.get("payload_hash"),
        "idempotency_key": idempotency_key,
        "status": "ACCEPTED",
    }
    put_child(farmer["msid"], f"EVENT#{operation_id}", event_item)
    apply_side_effects(farmer, operation_type, payload, now)
    put_child(
        farmer["msid"],
        f"ACTIVITY#{now}#{operation_id[:8]}",
        {
            "id": str(uuid.uuid4()),
            "type": operation_type.lower(),
            "title": title_for(operation_type),
            "detail": "Saved as added by you. Not a score or loan decision.",
            "occurredAt": now,
        },
    )
    return respond(
        202,
        {
            "operationId": operation_id,
            "status": "ACCEPTED",
            "serverReference": operation_id,
            "verification_state": "SELF_REPORTED",
        },
    )


def apply_side_effects(farmer: dict[str, Any], operation_type: str, payload: dict[str, Any], now: str):
    profile = dict(farmer["profile"])
    if "FARM" in operation_type and payload.get("id"):
        farm = {**payload, "verification": "reported"}
        put_child(farmer["msid"], f"FARM#{payload['id']}", farm)
        profile["location"] = payload.get("location") or profile.get("location") or ""
        profile["lastUpdated"] = now
        profile["readiness"] = "attention"
        profile["readinessLabel"] = "Good progress"
        profile["recordFreshness"] = "Updated from this phone"
    if "ENTERPRISE" in operation_type and payload.get("id"):
        put_child(farmer["msid"], f"ENTERPRISE#{payload['id']}", payload)
        profile["lastUpdated"] = now
    if "CONSENT" in operation_type:
        consent_id = str(payload.get("id") or uuid.uuid4())
        put_child(
            farmer["msid"],
            f"CONSENT#{consent_id}",
            {
                "id": consent_id,
                "institution": payload.get("institution") or "Mkulima Passport",
                "purpose": payload.get("purpose") or payload.get("version") or CONSENT_REF,
                "status": "revoked" if "REVOKE" in operation_type else "active" if "GRANTED" in operation_type else "pending",
                "grantedAt": payload.get("acceptedAt") or now,
                "expiresAt": None,
                "scopes": payload.get("scopes") or ["Farm profile"],
            },
        )
    if "EVIDENCE" in operation_type and payload.get("id"):
        put_child(farmer["msid"], f"RECORD#{payload['id']}", {**payload, "verification": "reported", "status": payload.get("status") or "received"})
    if "INSTITUTION" in operation_type:
        request_id = str(payload.get("id") or uuid.uuid4())
        name = payload.get("institutionName") or payload.get("institution") or "Institution"
        put_child(
            farmer["msid"],
            f"REQUEST#{request_id}",
            {
                "id": request_id,
                "institution": name,
                "title": "Connection requested",
                "reason": payload.get("memberNumber") or "Membership connection",
                "status": "open",
                "items": ["Farm profile", "Production records"],
            },
        )
        affiliations = list(profile.get("affiliations") or [])
        if name not in affiliations:
            affiliations.append(name)
        profile["affiliations"] = affiliations
    save_profile(farmer["msid"], profile)


def bootstrap(farmer: dict[str, Any]):
    profile = farmer["profile"]
    return {
        "msid": farmer["msid"],
        "farmer_msid": farmer["msid"],
        "passport": profile,
        "feature_flags": {"farmer_writes": "evidence_only", "scores": False},
        "supported_app_version": "1.0",
        "permissions": items(farmer["msid"], "CONSENT#"),
        "open_requests": items(farmer["msid"], "REQUEST#"),
        "data_freshness": profile.get("recordFreshness") or "Added by you",
    }


def get_or_create_farmer(phone: str) -> dict[str, Any]:
    phone_pk = f"PHONE#{sha(phone)}"
    existing = table.get_item(Key={"pk": phone_pk, "sk": "IDENTITY"}).get("Item")
    now = utcnow()
    if existing:
        msid = str(existing["msid"])
        profile = table.get_item(Key={"pk": f"FARMER#{msid}", "sk": "PROFILE"}).get("Item") or {}
        return {"msid": msid, "profile": unwrap(profile)}
    msid = f"MS-KE-{secrets.token_hex(4).upper()}"
    profile = {
        "msid": msid,
        "displayName": "",
        "phoneMasked": mask_phone(phone),
        "location": "",
        "identityVerified": False,
        "profileStatus": "attention",
        "lastUpdated": now,
        "readiness": "not_ready",
        "readinessLabel": "Building your farm profile",
        "affiliations": [],
        "evidenceStatus": "Added by you",
        "recordFreshness": "Just started",
    }
    table.put_item(Item={"pk": phone_pk, "sk": "IDENTITY", "msid": msid, "created_at": now, "ttl": int(time.time()) + 60 * 60 * 24 * 365 * 5})
    save_profile(msid, profile)
    return {"msid": msid, "profile": profile}


def require_farmer(event: dict[str, Any]) -> dict[str, Any]:
    token = bearer(event)
    if not token:
        raise AuthError(401, "AUTH_REQUIRED")
    claims = verify_jwt(token)
    if claims.get("typ") != "farmer" or not claims.get("sub"):
        raise AuthError(401, "AUTH_REQUIRED")
    msid = str(claims["sub"])
    profile = table.get_item(Key={"pk": f"FARMER#{msid}", "sk": "PROFILE"}).get("Item")
    if not profile:
        raise AuthError(401, "AUTH_REQUIRED")
    return {"msid": msid, "profile": unwrap(profile)}


def items(msid: str, prefix: str) -> list[dict[str, Any]]:
    result = table.query(
        KeyConditionExpression=Key("pk").eq(f"FARMER#{msid}") & Key("sk").begins_with(prefix)
    )
    return [unwrap(item) for item in result.get("Items") or []]


def put_child(msid: str, sk: str, data: dict[str, Any]):
    item = to_item(data)
    item["pk"] = f"FARMER#{msid}"
    item["sk"] = sk
    table.put_item(Item=item)


def save_profile(msid: str, profile: dict[str, Any]):
    item = to_item(profile)
    item["pk"] = f"FARMER#{msid}"
    item["sk"] = "PROFILE"
    table.put_item(Item=item)


def proxy_core(method: str, path: str, event: dict[str, Any]):
    url = f"{CORE_API_URL}{path}"
    if event.get("rawQueryString"):
        url = f"{url}?{event['rawQueryString']}"
    headers = {"content-type": header(event, "content-type") or "application/json"}
    auth = header(event, "authorization")
    if auth:
        headers["authorization"] = auth
    body_bytes = None
    if event.get("body"):
        raw = event["body"]
        body_bytes = raw.encode("utf-8") if isinstance(raw, str) else raw
        if event.get("isBase64Encoded"):
            import base64

            body_bytes = base64.b64decode(raw)
    request = urllib.request.Request(url, data=body_bytes, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = response.read()
            return {
                "statusCode": response.status,
                "headers": {**CORS, "content-type": response.headers.get("content-type") or "application/json"},
                "body": payload.decode("utf-8", "replace"),
            }
    except urllib.error.HTTPError as exc:
        return {
            "statusCode": exc.code,
            "headers": {**CORS, "content-type": "application/json"},
            "body": exc.read().decode("utf-8", "replace"),
        }
    except urllib.error.URLError:
        return respond(502, {"detail": "CORE_API_UNREACHABLE"})


def body(event: dict[str, Any]) -> dict[str, Any]:
    raw = event.get("body")
    if not raw:
        return {}
    if event.get("isBase64Encoded"):
        import base64

        raw = base64.b64decode(raw).decode("utf-8")
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    parsed = json.loads(raw)
    return parsed if isinstance(parsed, dict) else {}


def header(event: dict[str, Any], name: str) -> str | None:
    headers = {str(k).lower(): v for k, v in (event.get("headers") or {}).items()}
    value = headers.get(name.lower())
    return str(value) if value else None


def bearer(event: dict[str, Any]) -> str | None:
    value = header(event, "authorization") or ""
    if value.lower().startswith("bearer "):
        return value.split(" ", 1)[1].strip()
    return None


def normalize_phone(value: str) -> str | None:
    digits = re.sub(r"\D", "", value)
    if digits.startswith("254") and len(digits) == 12:
        return f"+{digits}"
    if digits.startswith("0") and len(digits) == 10:
        return f"+254{digits[1:]}"
    if len(digits) == 9 and digits.startswith("7"):
        return f"+254{digits}"
    return None


def mask_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 6:
        return "•••"
    return f"+{digits[:3]} ••• ••{digits[-2:]}"


def title_for(operation_type: str) -> str:
    mapping = {
        "FARM_CREATED": "Farm added",
        "ENTERPRISE_CREATED": "Enterprise added",
        "CONSENT_GRANTED": "Permission saved",
        "FARMER_PRODUCTION_SUBMITTED": "Production saved",
        "FARMER_SALE_SUBMITTED": "Sale saved",
        "FARMER_COST_SUBMITTED": "Cost saved",
        "FARMER_EVIDENCE_SUBMITTED": "Record saved",
        "FARMER_CORRECTION_SUBMITTED": "Correction saved",
        "INSTITUTION_LINK_REQUESTED": "Institution connection requested",
    }
    return mapping.get(operation_type, "Update saved")


def sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def b64url(raw: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def sign_jwt(claims: dict[str, Any]) -> str:
    now = int(time.time())
    payload = {**claims, "iat": now, "exp": now + 60 * 60 * 24 * 30}
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body_part = b64url(json.dumps(payload, separators=(",", ":")).encode())
    signing = f"{header}.{body_part}".encode()
    sig = hmac.new(JWT_SECRET.encode(), signing, hashlib.sha256).digest()
    return f"{header}.{body_part}.{b64url(sig)}"


def verify_jwt(token: str) -> dict[str, Any]:
    try:
        header_part, body_part, sig_part = token.split(".")
    except ValueError as exc:
        raise AuthError(401, "AUTH_REQUIRED") from exc
    signing = f"{header_part}.{body_part}".encode()
    expected = b64url(hmac.new(JWT_SECRET.encode(), signing, hashlib.sha256).digest())
    if not hmac.compare_digest(expected, sig_part):
        raise AuthError(401, "AUTH_REQUIRED")
    import base64

    padded = body_part + "=" * (-len(body_part) % 4)
    claims = json.loads(base64.urlsafe_b64decode(padded.encode()))
    if int(claims.get("exp") or 0) < int(time.time()):
        raise AuthError(401, "AUTH_REQUIRED")
    return claims


def to_item(data: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(data), parse_float=Decimal)


def unwrap(item: dict[str, Any]) -> dict[str, Any]:
    skip = {"pk", "sk", "ttl"}
    return {key: coerce(value) for key, value in item.items() if key not in skip}


def coerce(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, list):
        return [coerce(item) for item in value]
    if isinstance(value, dict):
        return {key: coerce(item) for key, item in value.items()}
    return value


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def respond(status: int, payload: dict[str, Any] | list[Any]):
    return {
        "statusCode": status,
        "headers": {**CORS, "content-type": "application/json"},
        "body": json.dumps(payload, default=_json_default),
    }


def _json_default(value: Any):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


class AuthError(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail
        super().__init__(detail)
