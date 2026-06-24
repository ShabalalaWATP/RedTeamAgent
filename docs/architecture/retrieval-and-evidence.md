# Retrieval And Evidence

Stage 1 extraction stores source originals outside the public web root and stores extracted text as evidence chunks with source locators.

Supported source types:

- pasted text;
- `.txt`;
- `.md`;
- `.pdf`;
- `.docx`.

The Docker Compose database uses PostgreSQL with pgvector support. Stage 1 stores deterministic placeholder embeddings and full-text-compatible extracted text so retrieval can evolve without changing report evidence contracts.

Every report finding must resolve to one of:

- a concrete source locator;
- an inference;
- an assumption;
- unknown evidence.

Unsupported claims are rejected by the quality gate or labelled explicitly.
