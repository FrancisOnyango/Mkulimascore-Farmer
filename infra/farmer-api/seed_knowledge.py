"""Create the Ask knowledge schema and upsert the Kenya-first corpus."""

from __future__ import annotations

import os

import boto3

from knowledge import ensure_schema_and_seed


def load_stack_env(stack_name: str = "mkulima-ask-knowledge-staging") -> None:
    cloudformation = boto3.client("cloudformation")
    outputs = {
        item["OutputKey"]: item["OutputValue"]
        for item in cloudformation.describe_stacks(StackName=stack_name)["Stacks"][0].get("Outputs") or []
    }
    os.environ.setdefault("KNOWLEDGE_CLUSTER_ARN", outputs.get("ClusterArn") or "")
    os.environ.setdefault("KNOWLEDGE_SECRET_ARN", outputs.get("SecretArn") or "")
    os.environ.setdefault("KNOWLEDGE_DB", outputs.get("DatabaseName") or "mkulima_knowledge")


if __name__ == "__main__":
    load_stack_env()
    print(ensure_schema_and_seed())
