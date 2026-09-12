"""Ask Mkulima knowledge library on Aurora PostgreSQL.

Hybrid retrieval: Postgres full-text first, pgvector when embeddings exist.
Falls back to the bundled Kenya-first corpus if Data API is not configured.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import boto3

CLUSTER_ARN = os.environ.get("KNOWLEDGE_CLUSTER_ARN") or ""
SECRET_ARN = os.environ.get("KNOWLEDGE_SECRET_ARN") or ""
DATABASE = os.environ.get("KNOWLEDGE_DB") or "mkulima_knowledge"

_rds = None
_CORPUS_PATH = Path(__file__).resolve().parents[2] / "src" / "lib" / "ai" / "knowledgeCorpus.json"
_LOCAL_CORPUS_PATH = Path(__file__).with_name("knowledge_corpus.json")


def _client():
    global _rds
    if _rds is None:
        _rds = boto3.client("rds-data")
    return _rds


def search_knowledge(question: str, sector: str | None = None, limit: int = 3) -> list[dict[str, Any]]:
    q = (question or "").strip()
    if not q:
        return []
    if CLUSTER_ARN and SECRET_ARN:
        try:
            hits = _search_postgres(q, sector, limit)
            if hits:
                return hits
        except Exception as exc:
            print(f"KNOWLEDGE_PG_ERR {type(exc).__name__} {exc}")
    return _search_corpus(q, sector, limit)


def _search_postgres(question: str, sector: str | None, limit: int) -> list[dict[str, Any]]:
    sql = """
        SELECT id, title, farmer_line, source_organisation, authority_tier, source_url,
               ts_rank(search_tsv, plainto_tsquery('simple', :q)) AS rank
        FROM agri_knowledge
        WHERE search_tsv @@ plainto_tsquery('simple', :q)
           OR (:sector <> '' AND :sector = ANY(value_chains))
        ORDER BY authority_tier ASC,
                 ts_rank(search_tsv, plainto_tsquery('simple', :q)) DESC
        LIMIT :limit
    """
    result = _client().execute_statement(
        resourceArn=CLUSTER_ARN,
        secretArn=SECRET_ARN,
        database=DATABASE,
        sql=sql,
        parameters=[
            {"name": "q", "value": {"stringValue": question[:240]}},
            {"name": "sector", "value": {"stringValue": sector or ""}},
            {"name": "limit", "value": {"longValue": limit}},
        ],
        includeResultMetadata=True,
    )
    columns = [col.get("name") for col in result.get("columnMetadata") or []]
    hits: list[dict[str, Any]] = []
    for record in result.get("records") or []:
        item = {}
        for i, name in enumerate(columns):
            item[name] = _scalar(record[i] if i < len(record) else None)
        hits.append({
            "id": item.get("id"),
            "title": item.get("title"),
            "farmerLine": item.get("farmer_line"),
            "sourceOrganisation": item.get("source_organisation"),
            "authorityTier": item.get("authority_tier"),
            "sourceUrl": item.get("source_url"),
            "score": item.get("rank") or 0,
        })
    return [item for item in hits if item.get("farmerLine")]


def ensure_schema_and_seed() -> dict[str, Any]:
    if not CLUSTER_ARN or not SECRET_ARN:
        return {"ok": False, "reason": "KNOWLEDGE_NOT_CONFIGURED"}
    for statement in (
        "CREATE EXTENSION IF NOT EXISTS vector",
        "CREATE EXTENSION IF NOT EXISTS pg_trgm",
        """CREATE TABLE IF NOT EXISTS agri_knowledge (
            id TEXT PRIMARY KEY,
            country TEXT NOT NULL DEFAULT 'KE',
            value_chains TEXT[] NOT NULL DEFAULT '{}',
            topics TEXT[] NOT NULL DEFAULT '{}',
            source_organisation TEXT NOT NULL,
            title TEXT NOT NULL,
            authority_tier CHAR(1) NOT NULL,
            license TEXT,
            source_url TEXT,
            language TEXT NOT NULL DEFAULT 'en',
            farmer_line TEXT NOT NULL,
            body TEXT NOT NULL,
            embedding vector(1024),
            search_tsv tsvector,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )""",
        "CREATE INDEX IF NOT EXISTS agri_knowledge_tsv_idx ON agri_knowledge USING GIN (search_tsv)",
        "CREATE INDEX IF NOT EXISTS agri_knowledge_trgm_idx ON agri_knowledge USING GIN (title gin_trgm_ops)",
    ):
        _exec(statement)
    docs = load_corpus()
    for doc in docs:
        _exec(
            """
            INSERT INTO agri_knowledge (
                id, country, value_chains, topics, source_organisation, title,
                authority_tier, license, source_url, language, farmer_line, body, search_tsv
            ) VALUES (
                :id, :country, string_to_array(:value_chains, '|'), string_to_array(:topics, '|'),
                :source_organisation, :title, :authority_tier, :license, :source_url, :language,
                :farmer_line, :body,
                to_tsvector('simple', coalesce(:title,'') || ' ' || coalesce(:farmer_line,'') || ' ' || coalesce(:body,'') || ' ' || coalesce(:topics,''))
            )
            ON CONFLICT (id) DO UPDATE SET
                country = EXCLUDED.country,
                value_chains = EXCLUDED.value_chains,
                topics = EXCLUDED.topics,
                source_organisation = EXCLUDED.source_organisation,
                title = EXCLUDED.title,
                authority_tier = EXCLUDED.authority_tier,
                license = EXCLUDED.license,
                source_url = EXCLUDED.source_url,
                language = EXCLUDED.language,
                farmer_line = EXCLUDED.farmer_line,
                body = EXCLUDED.body,
                search_tsv = EXCLUDED.search_tsv,
                updated_at = now();
            """,
            [
                {"name": "id", "value": {"stringValue": doc["id"]}},
                {"name": "country", "value": {"stringValue": doc.get("country") or "KE"}},
                {"name": "value_chains", "value": {"stringValue": "|".join(doc.get("valueChains") or [])}},
                {"name": "topics", "value": {"stringValue": "|".join(doc.get("topics") or [])}},
                {"name": "source_organisation", "value": {"stringValue": doc["sourceOrganisation"]}},
                {"name": "title", "value": {"stringValue": doc["title"]}},
                {"name": "authority_tier", "value": {"stringValue": doc["authorityTier"]}},
                {"name": "license", "value": {"stringValue": doc.get("license") or "public-guidance"}},
                {"name": "source_url", "value": {"stringValue": doc.get("sourceUrl") or ""}},
                {"name": "language", "value": {"stringValue": doc.get("language") or "en"}},
                {"name": "farmer_line", "value": {"stringValue": doc["farmerLine"]}},
                {"name": "body", "value": {"stringValue": doc["body"]}},
            ],
        )
    return {"ok": True, "documents": len(docs)}


def load_corpus() -> list[dict[str, Any]]:
    for path in (_LOCAL_CORPUS_PATH, _CORPUS_PATH):
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    return []


def _search_corpus(question: str, sector: str | None, limit: int) -> list[dict[str, Any]]:
    terms = [term for term in re.split(r"[^a-z0-9']+", question.lower()) if len(term) > 2]
    hits: list[dict[str, Any]] = []
    for doc in load_corpus():
        hay = " ".join([
            str(doc.get("title") or ""),
            str(doc.get("farmerLine") or ""),
            str(doc.get("body") or ""),
            " ".join(doc.get("topics") or []),
            " ".join(doc.get("valueChains") or []),
        ]).lower()
        score = sum(2 for term in terms if term in hay)
        if sector and any(str(item).lower() == sector.lower() for item in doc.get("valueChains") or []):
            score += 3
        score += max(0, 7 - (ord(str(doc.get("authorityTier") or "F")[0]) - 64))
        if score >= 4:
            hits.append({
                "id": doc.get("id"),
                "title": doc.get("title"),
                "farmerLine": doc.get("farmerLine"),
                "sourceOrganisation": doc.get("sourceOrganisation"),
                "authorityTier": doc.get("authorityTier"),
                "sourceUrl": doc.get("sourceUrl"),
                "score": score,
            })
    hits.sort(key=lambda item: (-int(item.get("score") or 0), str(item.get("authorityTier") or "Z")))
    return hits[:limit]


def _exec(sql: str, parameters: list[dict[str, Any]] | None = None) -> None:
    kwargs: dict[str, Any] = {
        "resourceArn": CLUSTER_ARN,
        "secretArn": SECRET_ARN,
        "database": DATABASE,
        "sql": sql,
    }
    if parameters:
        kwargs["parameters"] = parameters
    _client().execute_statement(**kwargs)


def _scalar(cell: Any) -> Any:
    if not isinstance(cell, dict):
        return None
    for key in ("stringValue", "longValue", "doubleValue", "booleanValue"):
        if key in cell:
            return cell[key]
    if cell.get("isNull"):
        return None
    return None


