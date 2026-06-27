# Account Types And Product Usage

RedTeamAgent has three site account types: Owner, Admin and User. Workspace membership roles also exist inside organisation workspaces. Site account type controls platform-level administration. Workspace role controls access inside a specific workspace.

## Site Account Types

| Account type | Main purpose | Can manage users | Usage quota |
|---|---|---|---|
| Owner | Platform owner and final authority | Yes, all users and admins | Unlimited |
| Admin | Delegated site administrator | Yes, selected users or all standard users depending on scope | Three times standard quota |
| User | Normal product user | No | Standard quota |

Standard quotas:

- 5 projects per user.
- 20 stored workflows per user.
- 10 workflow starts per week.

Deleting a project or workflow frees stored quota. Weekly workflow starts are counted from recent audit history and do not reset when a workflow is deleted.

## Owner

The owner can:

- promote a user to admin;
- demote an admin to user;
- suspend, ban or delete users and admins;
- choose whether an admin manages all users or selected users;
- view site admin telemetry, including registered and anonymous visits;
- configure provider governance, retention and enterprise settings where the owner is also a workspace administrator.

The owner should be created deliberately with `SITE_OWNER_BOOTSTRAP_TOKEN`. Production disables automatic first-user owner bootstrap.

## Admin

An admin can manage users only within their configured site-admin scope:

- `all`: all standard users;
- `selected`: only the user IDs assigned by the owner;
- `none`: no delegated user scope.

Admins cannot manage owners. Admin visibility excludes privileged users and anonymous rows unless the owner grants broader controls in code later.

Admin accounts receive `ADMIN_USAGE_MULTIPLIER` times the standard project and workflow limits.

## User

Users can:

- create projects;
- create standalone workflows or workflows inside projects;
- upload or paste source material;
- add website or repository sources where policy allows;
- run reviews;
- inspect reports;
- export reports where authorised;
- manage their own security settings, including optional MFA.

Users cannot see stored provider credentials. Provider credentials are write-only from the browser perspective.

## Account Status

| Status | Meaning |
|---|---|
| `active` | User can log in and use authorised features. |
| `suspended` | Login is blocked with a user-facing account status message. |
| `banned` | Login is blocked with a user-facing account status message. |
| `deleted` | Account is disabled and sessions are invalidated. |

Password reset and site-admin status changes invalidate relevant sessions so old sessions do not remain usable after sensitive account changes.

## First Signup And Email Verification

Production signup:

1. User opens `/auth`.
2. User enters an email address and password.
3. Cloudflare Turnstile must be completed.
4. The API sends an email verification link.
5. The user verifies the email address.
6. The user logs in.

Production must not return verification or reset tokens in API responses. Local tests can opt into token exposure, but production rejects `EXPOSE_AUTH_TOKENS=true`.

Password rules:

- 12 to 128 characters.
- At least one uppercase letter.
- At least one lowercase letter.
- At least one number.
- At least one symbol.

## Creating A Review

1. Create a project, or start a standalone workflow where the UI exposes it.
2. Create a review with a title and optional focus chips.
3. Add sources:
   - pasted text;
   - TXT, Markdown, PDF, DOCX, PPTX, CSV, XLSX;
   - PNG, JPEG, WebP;
   - common audio and video formats;
   - ZIP or TAR source archives;
   - public website URLs;
   - public Git repository URLs.
4. Choose research and privacy settings.
5. Start the workflow.
6. Read the report, evidence quality, risk matrix, disagreements, actions and decision journal.

Reports are decision support. They are not legal, medical, financial, regulatory, security, engineering or delivery sign-off.

## Projects And Workflow History

Workflows can be attached to a project or kept standalone. Previous workflows remain visible so users can reopen past work instead of recreating the same review.

Deletion behaviour:

- deleting a workflow frees the stored workflow count;
- deleting a project frees the project count;
- weekly starts still count until they age out of the weekly window.

## Admin Settings

The `Settings` view is admin-only. It includes:

- provider setup;
- model registration;
- agent model profiles;
- organisation settings;
- member management;
- invitations;
- provider governance;
- identity and SCIM-ready fields;
- data retention;
- audit inspection;
- action notifications;
- custom agents;
- rubrics;
- report templates;
- API tokens;
- webhooks;
- scheduled re-review;
- outcome tracking;
- operations summaries;
- model comparison.

Regular users do not see the settings navigation and server-side endpoints reject non-admin access.

## Exports

Reports support structured and document-style export paths where authorised. The product direction includes printer-friendly output, PDF and document export, and email delivery workflows. Exports must preserve source provenance and avoid exposing provider credentials or hidden model reasoning.
