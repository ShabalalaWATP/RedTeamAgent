# Stage 3 User Guide

Organisation users can invite colleagues, manage project access, comment on reports, assign actions, record decision rationale and share reports through expiring links. Reports remain provisional decision support and should not be treated as legal, medical, financial, engineering or regulatory certification.

Administrators manage AI provider setup, provider governance, retention, approved research domains, custom agents, rubrics, templates, API tokens, webhooks and scheduled re-reviews from the admin-only `Settings` view. Regular members use projects, workflows, reviews and reports without seeing provider credentials or workspace administration controls.

First signup starts at `/auth`: enter an email and a 12-character-or-longer password with uppercase, lowercase, a number and a symbol, register, verify the email link, then log in. Local development may show a verification token directly; production sends verification and reset links by SMTP. Owner and Admin accounts must keep authenticator-app MFA enabled and verify a passkey before using privileged app routes. Standard users can enable MFA and passkeys voluntarily from `Settings`.

Standard accounts can keep 5 projects, keep 20 workflows and start 10 workflows per week. Admin accounts receive triple those quotas and owner accounts are unlimited. Deleting a project or workflow frees stored quota, but weekly workflow starts are counted from audit history until the weekly reset. Public auth, upload, source-ingestion and review-run endpoints also use rate limits to reduce automated abuse. Account creation and password reset can require either Cloudflare Turnstile or the built-in one-question challenge.

For the detailed account-type, quota, first-signup, admin-settings and workflow guide, see `docs/user/account-types-and-usage.md`.
