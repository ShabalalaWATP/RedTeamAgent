# Stage 1 Performance Budgets

Date: 24 June 2026

These budgets apply to the Stage 1 vertical slice and should be revisited before Stage 2 adds richer evidence ingestion.

| Area | Budget | Current evidence |
| --- | --- | --- |
| Frontend JavaScript bundle | At most 400 kB before gzip | `npm run build --prefix apps/web`, 336.08 kB before gzip |
| Frontend CSS bundle | At most 8 kB before gzip | `npm run build --prefix apps/web`, 5.94 kB before gzip |
| Core local app shell render | Auth and dashboard visible during Playwright e2e without timeout | `npm run e2e --prefix apps/web`, passed |
| Keyboard and click interactions | Core mocked-browser journey completes without blocked controls or timeout | `npm run e2e --prefix apps/web`, passed |
| Report rendering | 50 findings render in less than 2 seconds in the React test environment | `npm run test:coverage --prefix apps/web`, large-report test passed |
| Docker local health | API, web, PostgreSQL, Redis and MinIO become healthy on an isolated Compose stack | `docker compose -p redteamagent-final up -d --build`, passed |

These are local release budgets, not production service-level objectives. Stage 2 should add richer budgets for OCR, repository ingestion, external research and larger reports.
