# Stage 3 User Guide

Organisation users can invite colleagues, manage project access, comment on reports, assign actions, record decision rationale and share reports through expiring links. Reports remain provisional decision support and should not be treated as legal, medical, financial, engineering or regulatory certification.

Administrators manage AI provider setup, provider governance, retention, approved research domains, custom agents, rubrics, templates, API tokens, webhooks and scheduled re-reviews from the admin-only `Settings` view. Regular members use projects, workflows, reviews and reports without seeing provider credentials or workspace administration controls.

First signup starts at `/auth`: enter an email and a 14-character-or-longer password with uppercase, lowercase, a number and a symbol, register, verify the email link, then log in. Local development may show a verification token directly; production sends verification and reset links by SMTP. Administrators can enable optional two-factor authentication from `Settings`.

Daily AI usage is controlled by `DAILY_REVIEW_RUN_LIMIT`. The server checks this limit before a review run is queued and the review screen shows the user's remaining runs for the current UTC day. Public auth, upload, source-ingestion and review-run endpoints also use rate limits to reduce automated abuse.
