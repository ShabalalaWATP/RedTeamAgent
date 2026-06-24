from __future__ import annotations

from pathlib import Path

import boto3

from app.core.config import Settings


class LocalObjectStorage:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, key: str, content: bytes, content_type: str) -> None:
        del content_type
        target = self.root / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)

    def get(self, key: str) -> bytes:
        return (self.root / key).read_bytes()


class S3ObjectStorage:
    def __init__(self, settings: Settings) -> None:
        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )
        self.client.create_bucket(Bucket=self.bucket)

    def put(self, key: str, content: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content, ContentType=content_type)

    def get(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        body = response["Body"].read()
        if not isinstance(body, bytes):
            raise TypeError("S3 body did not return bytes.")
        return body
