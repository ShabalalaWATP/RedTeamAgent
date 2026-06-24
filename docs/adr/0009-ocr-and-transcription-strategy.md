# ADR 0009: OCR And Transcription Strategy

## Status

Accepted.

## Context

Stage 2 supports images, scanned documents, audio, video and browser voice notes. CI must remain deterministic and must not require live OCR or speech-provider credentials.

## Decision

OCR and transcription sit behind source-ingestor and provider contracts. The local Stage 2 implementation produces deterministic extracted text, timestamp or block locators, and quality warnings. Live OCR, transcription and image-capable model providers can be added through the existing provider capability contracts without changing review workflows.

## Consequences

- Tests can verify source handling and report behaviour without live credentials.
- Quality warnings are visible to users and reports do not imply perfect extraction.
- Production-grade recognition accuracy depends on later provider configuration and operational policy.
