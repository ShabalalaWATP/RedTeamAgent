# Retrieval And Evidence

Stage 1 extraction stores source originals outside the public web root and stores extracted text as evidence chunks with source locators.

Supported source types:

- pasted text;
- `.txt`;
- `.md`;
- `.pdf`;
- `.docx`.

The Docker Compose database uses PostgreSQL with pgvector support. Stage 1 stores deterministic 16-dimension embeddings on each evidence chunk, enables the PostgreSQL `vector` extension at startup and uses PostgreSQL full-text search plus pgvector cosine distance when running on PostgreSQL. SQLite tests use the same deterministic embeddings with an in-process lexical/vector ranker.

Report composition retrieves review-scoped evidence before findings are written. The structured report stores retrieved locators, excerpts, scores and source identifiers under `retrieved_evidence`, and source-backed findings cite one of those locators.

Every report finding must resolve to one of:

- a concrete source locator;
- an inference;
- an assumption;
- unknown evidence.

Unsupported claims are rejected by the quality gate or labelled explicitly.
