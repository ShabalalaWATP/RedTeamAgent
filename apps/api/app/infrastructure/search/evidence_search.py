from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from hashlib import sha256
from math import sqrt
from re import finditer

DIMENSIONS = 16
STOP_WORDS = {
    "and",
    "are",
    "for",
    "from",
    "not",
    "that",
    "the",
    "this",
    "with",
}


@dataclass(frozen=True)
class EvidenceCandidate:
    source_id: str
    source_filename: str
    locator: str
    text: str
    embedding: list[float]


def embedding_for_text(text: str) -> list[float]:
    vector = [0.0] * DIMENSIONS
    for term, count in _terms(text).items():
        digest = sha256(term.encode("utf-8")).digest()
        index = digest[0] % DIMENSIONS
        sign = 1.0 if digest[1] % 2 == 0 else -1.0
        vector[index] += sign * count
    return _normalise(vector)


def rank_candidates(candidates: list[EvidenceCandidate], query: str, limit: int) -> list[dict[str, object]]:
    query_terms = _terms(query)
    query_embedding = embedding_for_text(query)
    ranked = [_rank(candidate, query_terms, query_embedding) for candidate in candidates]
    ranked.sort(key=lambda item: (-_score(item), str(item["locator"])))
    return ranked[:limit]


def _rank(
    candidate: EvidenceCandidate,
    query_terms: Counter[str],
    query_embedding: list[float],
) -> dict[str, object]:
    text_terms = _terms(candidate.text)
    overlap = sum(min(query_terms[term], text_terms[term]) for term in query_terms)
    coverage = _coverage(query_terms, text_terms)
    vector_score = max(_cosine(query_embedding, candidate.embedding), 0.0)
    score = overlap + (coverage * 2.0) + (vector_score * 0.5)
    return {
        "source_id": candidate.source_id,
        "source_filename": candidate.source_filename,
        "locator": _source_locator(candidate.source_filename, candidate.locator),
        "excerpt": _excerpt(candidate.text, query_terms),
        "score": round(score, 4),
    }


def _terms(text: str) -> Counter[str]:
    return Counter(
        match.group(0)
        for match in finditer(r"[a-z0-9][a-z0-9_-]{2,}", text.lower())
        if match.group(0) not in STOP_WORDS
    )


def _coverage(query_terms: Counter[str], text_terms: Counter[str]) -> float:
    if not query_terms:
        return 0.0
    return len(set(query_terms) & set(text_terms)) / len(query_terms)


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    pairs = zip(left, right, strict=False)
    numerator = sum(left_value * right_value for left_value, right_value in pairs)
    return numerator / (_magnitude(left) * _magnitude(right) or 1.0)


def _score(item: dict[str, object]) -> float:
    score = item.get("score", 0.0)
    return float(score) if isinstance(score, int | float) else 0.0


def _magnitude(vector: list[float]) -> float:
    return sqrt(sum(value * value for value in vector))


def _normalise(vector: list[float]) -> list[float]:
    magnitude = _magnitude(vector)
    if magnitude == 0:
        return vector
    return [round(value / magnitude, 6) for value in vector]


def _source_locator(filename: str, locator: str) -> str:
    return locator if locator.startswith(f"{filename}:") else f"{filename}:{locator}"


def _excerpt(text: str, query_terms: Counter[str], limit: int = 240) -> str:
    compact = " ".join(text.split())
    if not compact:
        return ""
    lower = compact.lower()
    starts = [lower.find(term) for term in query_terms if term in lower]
    start = min((index for index in starts if index >= 0), default=0)
    prefix = "..." if start > 0 else ""
    excerpt = compact[max(start - 40, 0) : max(start - 40, 0) + limit]
    suffix = "..." if len(compact) > len(excerpt) else ""
    return f"{prefix}{excerpt}{suffix}"
