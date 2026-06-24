# Stage 3 Performance Budgets

Date: 24 June 2026

These budgets apply to the local Stage 3 release gate. They are not production service-level objectives.

| Area | Budget | Current evidence |
| --- | --- | --- |
| Frontend JavaScript bundle | At most 500 kB before gzip | `npm run build --prefix apps/web`, 367.07 kB before gzip |
| Frontend CSS bundle | At most 20 kB before gzip | `npm run build --prefix apps/web`, 7.40 kB before gzip |
| Core local app shell render | Auth and dashboard visible during Playwright e2e without timeout | `npm run e2e --prefix apps/web`, passed |
| Keyboard and click interactions | Core mocked-browser journey completes without blocked controls or timeout | `npm run e2e --prefix apps/web`, passed |
| OCR and image extraction | Deterministic local extraction returns metadata and quality warnings without external calls | `.\.venv\Scripts\python -m pytest apps\api`, passed |
| Audio and video transcription | Deterministic local transcript includes timestamp locators and warnings within API test timeout | `.\.venv\Scripts\python -m pytest apps\api`, passed |
| Website ingestion | Hardened fetch path applies timeout and size caps, stores a snapshot locator and blocks private targets | `.\.venv\Scripts\python -m pytest apps\api`, passed |
| Repository indexing | Public Git paths create manifest, language summary, dependency/config index and file locators without checkout or code execution | Docker-backed workflow ingested `https://github.com/octocat/Hello-World.git` |
| Large report rendering | 50 findings plus Stage 2 report sections render in less than 2 seconds in the React test environment | `npm run test:coverage --prefix apps/web`, passed |
| PDF export | Export endpoint returns PDF-safe bytes during Stage 2 API tests | `.\.venv\Scripts\python -m pytest apps\api`, passed |
| Docker local health | API, web, PostgreSQL, Redis and MinIO become healthy on an isolated Compose stack | `docker compose -p redteamagent-stage3 up -d --build`, measured in Stage 3 verification |
| Organisation dashboard | Enterprise screen loads mocked governance, members, audit, operations and model comparison without timeout | `npm run e2e --prefix apps/web`, measured in Stage 3 verification |
| Audit search and inspection | Audit endpoint returns structured redacted events under normal test fixture size | `.\.venv\Scripts\python -m pytest apps\api`, passed |
| Scheduled re-review queue | Idempotent due-schedule processing creates one notification per due schedule and advances timestamps | `.\.venv\Scripts\python -m pytest apps\api`, passed |
| Model comparison | Model dashboard renders quality, cost, latency, failure-rate and capability coverage rows on mobile and desktop | `npm run e2e --prefix apps/web`, measured in Stage 3 verification |
