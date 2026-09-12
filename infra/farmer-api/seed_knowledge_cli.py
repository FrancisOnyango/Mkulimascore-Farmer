"""Seed Ask knowledge through the AWS CLI so local boto3 CRT is not required."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

STACK = "mkulima-ask-knowledge-staging"
SCHEMA = [
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
]

UPSERT = """
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
"""


def outputs() -> dict[str, str]:
    raw = subprocess.check_output(
        ["aws", "cloudformation", "describe-stacks", "--stack-name", STACK, "--query", "Stacks[0].Outputs", "--output", "json"],
        text=True,
    )
    return {item["OutputKey"]: item["OutputValue"] for item in json.loads(raw)}


def execute(cluster: str, secret: str, database: str, sql: str, parameters: list[dict] | None = None) -> None:
    cmd = [
        "aws", "rds-data", "execute-statement",
        "--resource-arn", cluster,
        "--secret-arn", secret,
        "--database", database,
        "--sql", str(sql),
    ]
    if parameters:
        params_path = Path(__file__).with_name("_seed_params.json")
        params_path.write_text(json.dumps(parameters), encoding="utf-8")
        cmd.extend(["--parameters", f"file://{params_path}"])
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL)


def main() -> int:
    env = outputs()
    cluster = env["ClusterArn"]
    secret = env["SecretArn"]
    database = env.get("DatabaseName") or "mkulima_knowledge"
    for statement in SCHEMA:
        execute(cluster, secret, database, statement)
    docs = json.loads((Path(__file__).with_name("knowledge_corpus.json")).read_text(encoding="utf-8"))
    for doc in docs:
        execute(cluster, secret, database, UPSERT, [
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
        ])
    print(json.dumps({"ok": True, "documents": len(docs), "cluster": cluster}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
