from __future__ import annotations

from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.infrastructure.db import models
from app.infrastructure.search.evidence_search import EvidenceCandidate, embedding_for_text, rank_candidates


def search_evidence_chunks(
    session: Session,
    workspace_id: str,
    review_id: str,
    query: str,
    limit: int,
) -> list[dict[str, object]]:
    rows = _evidence_rows(session, workspace_id, review_id, query, max(limit * 4, limit))
    candidates = [
        EvidenceCandidate(
            source_id=source.id,
            source_filename=source.filename,
            locator=chunk.locator,
            text=chunk.text,
            embedding=[float(value) for value in chunk.embedding],
        )
        for chunk, source in rows
    ]
    return rank_candidates(candidates, query, limit)


def _evidence_rows(session: Session, workspace_id: str, review_id: str, query: str, limit: int) -> list[Any]:
    statement = (
        select(models.EvidenceChunk, models.Source)
        .join(models.Source, models.Source.id == models.EvidenceChunk.source_id)
        .where(models.EvidenceChunk.workspace_id == workspace_id, models.Source.review_id == review_id)
    )
    if session.get_bind().dialect.name == "postgresql" and query.strip():
        ts_query = func.websearch_to_tsquery("english", query)
        vector = func.to_tsvector("english", models.EvidenceChunk.text)
        query_embedding = embedding_for_text(query)
        ranked = statement.where(vector.op("@@")(ts_query)).order_by(
            desc(func.ts_rank_cd(vector, ts_query)),
            models.EvidenceChunk.embedding.cosine_distance(query_embedding),
        )
        rows = list(session.execute(ranked.limit(limit)).all())
        if rows:
            return rows
    return list(session.execute(statement.limit(limit)).all())
