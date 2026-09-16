"""Provisional writers for Ask action confirmations — never overwrite verified records."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_confirmation_records(
    farmer: dict[str, Any],
    action_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Map confirmed Ask actions to provisional farm submissions."""
    action_type = str(payload.get("type") or payload.get("actionType") or "unknown")
    now = utc_now()
    msid = farmer["msid"]
    farm_id = payload.get("farmId") or payload.get("farm_id")
    base = {
        "actionId": action_id,
        "type": action_type,
        "confirmed": bool(payload.get("confirmed", True)),
        "msid": msid,
        "farmId": farm_id,
        "createdAt": now,
        "status": "PROVISIONAL",
        "provenance": "FARMER_REPORTED",
        "source": "ASK_MKULIMA",
        "note": "Provisional until field verification or matching farm workflow completes.",
    }

    outbox_ops: list[dict[str, Any]] = []
    entity_items: list[dict[str, Any]] = []

    if action_type in ("create_profile_update_request", "profile_update", "planting_date"):
        correction = {
            **base,
            "id": str(uuid.uuid4()),
            "field": payload.get("field") or "planting_date",
            "proposedValue": payload.get("proposedValue") or payload.get("value") or payload.get("summary"),
            "reason": payload.get("reason") or "Asked Mkulima to submit a provisional update from conversation.",
        }
        entity_items.append({"sk": f"CORRECTION#{correction['id']}", "entity": "correction", "data": correction})
        outbox_ops.append({"operation_type": "FARMER_CORRECTION_SUBMITTED", "payload": correction})

    elif action_type in ("create_activity_draft", "activity", "save_activity"):
        activity = {
            **base,
            "id": str(uuid.uuid4()),
            "kind": payload.get("kind") or "activity",
            "summary": payload.get("summary") or payload.get("label") or "Activity noted from Ask Mkulima",
            "occurredAt": payload.get("occurredAt") or now,
        }
        entity_items.append({"sk": f"ACTIVITY#{activity['id']}", "entity": "activity", "data": activity})
        outbox_ops.append({"operation_type": "ASK_ACTIVITY_DRAFT_CONFIRMED", "payload": activity})

    elif action_type in ("report_pest_or_disease", "pest", "disease"):
        incident = {
            **base,
            "id": str(uuid.uuid4()),
            "incidentType": "pest_or_disease",
            "narrative": payload.get("narrative") or payload.get("summary") or "",
            "attachmentId": payload.get("attachmentId"),
        }
        entity_items.append({"sk": f"INCIDENT#{incident['id']}", "entity": "farm_incident", "data": incident})
        outbox_ops.append({"operation_type": "FARMER_INCIDENT_REPORTED", "payload": incident})

    elif action_type in ("submit_impact_report", "impact"):
        impact = {
            **base,
            "id": str(uuid.uuid4()),
            "alertId": payload.get("alertId"),
            "impactType": payload.get("impactType") or "other",
            "narrative": payload.get("narrative") or "",
            "provisionalStatus": "PROVISIONAL",
            "safeToAssess": bool(payload.get("safeToAssess", True)),
        }
        entity_items.append({"sk": f"IMPACT#{impact['id']}", "entity": "impact_case", "data": impact})
        outbox_ops.append({"operation_type": "FARMER_IMPACT_CASE", "payload": impact})

    elif action_type in ("escalate_to_officer", "escalation"):
        case = {
            **base,
            "id": str(uuid.uuid4()),
            "reason": payload.get("reason") or "ask_action_confirmed",
            "question": payload.get("question") or "",
            "channel": "field_or_extension_officer",
            "status": "open",
        }
        entity_items.append({"sk": f"ASKESC#{case['id']}", "entity": "ask_escalation", "data": case})
        outbox_ops.append({"operation_type": "ASK_ESCALATION_OPENED", "payload": case})

    else:
        generic = {**base, "id": str(uuid.uuid4()), "payload": payload}
        entity_items.append({"sk": f"ASKACTION#{generic['id']}", "entity": "ask_action_confirm", "data": generic})
        outbox_ops.append({"operation_type": "ASK_ACTION_CONFIRMED", "payload": generic})

    return {
        "confirmation": base,
        "entity_items": entity_items,
        "outbox_ops": outbox_ops,
    }
