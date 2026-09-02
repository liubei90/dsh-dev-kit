# Agent Note: User accounts and login

Status: proposed

## Problem

The product needs identity: a person registers with an email and password, logs in, and protected routes can tell who is calling. Nothing exists today — no users table, no auth code, no client wiring — and the apps have no runtime stack yet. This proposal defines the MVP capability (registration, login, logout, current user, auth guard) on the [runtime stack proposal](../architecture/2026-09-02-bootstrap-runtime-stack.md); roles, password reset, email verification, and refresh-token rotation are out of scope for this change.

## Proposal

Data model: a users table (id TEXT primary key holding a crypto.randomUUID value, email TEXT unique and stored lowercased and trimmed, password_hash TEXT, created_at TEXT) created by the first schema migration, with a unique index on email; user ids cross the process boundary as a branded UserId type per the root AGENTS.md id rule.

Passwords hash with Node's built-in crypto.scrypt: a per-user 16-byte random salt, fixed parameters (N=16384, r=8, p=1), stored self-describing as `scrypt$N$r$p$<salt b64>$<hash b64>` so parameters can change later without breaking stored hashes, and verification compares with timingSafeEqual. Registration requires a syntactically valid email and a password of at least 8 characters; the normalization and validation helpers live once in packages/shared and the API applies them at the route boundary.

Auth endpoints, with the wire contract in shared DTOs and every response following the ApiEnvelope shape:

- POST /auth/register { email, password } → 201 with the public user; 400 on EMAIL_INVALID or PASSWORD_TOO_SHORT, 409 on EMAIL_TAKEN.
- POST /auth/login { email, password } → 200 { token, user }; any credential failure returns the same 401 INVALID_CREDENTIALS so login cannot enumerate accounts.
- GET /auth/me with Authorization: Bearer <token> → 200 { user }; 401 UNAUTHORIZED for missing, expired, or invalid tokens.
- POST /auth/logout → 204; with a stateless JWT this endpoint exists to document that the client discards its stored token — it cannot revoke server-side.

Tokens: @fastify/jwt signs HS256 JWTs with the JWT_SECRET env var, payload sub = user id, expiry from the JWT_TTL env var (default 1 hour). An auth guard helper validates the Bearer token, attaches the user, and turns failures into the UNAUTHORIZED envelope; only routes behind the guard see a user. JWT_SECRET is required outside tests and documented in .env.example; tests inject a fixed secret.

Web (apps/web): a login page renders login and register forms in a single MVP view, driven by a small typed fetch wrapper that attaches the Bearer token, stores it in localStorage, and on a 401 response clears it and returns to login. Successful login stores the token and fetches /auth/me to show the signed-in email with a logout action. All visible copy comes from a typed dictionary module in apps/web (Chinese default): field labels, placeholders, buttons, and a stable error-code-to-message map for the codes above, so components hardcode no strings per the root AGENTS.md i18n rule.

Dev wiring: the Vite dev server proxies /auth to the API origin (VITE_API_PROXY_URL env) so the page and API agree on one origin during development; deployed behind a gateway, they serve same-origin.

## Alternatives considered

- **httpOnly session cookies with server-side sessions** — rejected: the product chose stateless JWTs for a simpler cross-origin story and no session table; the cost — no server-side revocation — is accepted and recorded in Risks.
- **Short-lived access JWT plus refresh token** — rejected for MVP: refresh storage and rotation add client and server surface the first slice does not need; revisit when sessions must outlive the TTL.
- **bcrypt or argon2 for password hashing** — rejected: both are native dependencies; scrypt ships in Node, is memory-hard, and with timingSafeEqual comparison satisfies the same requirement without a build step.
- **Registration auto-logs-in by returning a token** — rejected: register and login stay orthogonal, each with one clear contract; the login page makes the two-step flow explicit.
- **Admin-created or invite-only accounts** — rejected for MVP: open registration is the requested shape; roles and invitation belong to a later decision.
- **Auth failures as bare HTTP statuses** — rejected: every response including 401 paths keeps the ApiEnvelope shape so clients have one parse path.

## Acceptance criteria

Over real HTTP with an in-memory database: register → login → /auth/me round-trips; duplicate email registration returns 409 EMAIL_TAKEN; wrong password and unknown email both return the identical 401 INVALID_CREDENTIALS; /auth/me with no, malformed, or expired token returns the UNAUTHORIZED envelope and with a valid token returns the user. Password hashes never equal the raw password and never appear in responses or logs. Web renders the login/register view from the typed dictionary, completes both flows against the dev proxy, shows the signed-in email after /auth/me, and logout returns to login. E2E drives the real page against a real database when the environment allows and self-skips otherwise, per the repository E2E convention. Unit tests cover email normalization, validation rules, and password hash/verify round-trips including wrong-password and tampered-hash cases.

## Risks

Stateless JWTs cannot be revoked: a stolen token stays valid until JWT_TTL expires, and logout only discards the client's copy. Mitigations are the short default TTL and HTTPS in deployed environments; a server-side denylist or refresh rotation is the recorded follow-up if sessions must become revocable.

The token lives in localStorage, so an XSS read can exfiltrate it. Mitigations are React's escaping, no dangerouslySetInnerHTML, and a Content-Security-Policy in the deployed web app; moving the token to an httpOnly cookie is the recorded follow-up if the threat model demands it.

Brute-force protection (rate limiting, lockout) is not in the MVP; the API deploys behind a rate limiter or gains one before public exposure.

Open registration admits anyone with a valid email and leaks which emails are taken via 409 EMAIL_TAKEN; that is inherent to open registration and accepted for MVP.

The password policy is length-only (at least 8 characters); complexity rules and breach-list checks are deferred and can tighten without a schema change because hashes are self-describing.
