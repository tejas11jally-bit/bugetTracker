# Ledgerly progress

PRD.md is the source of truth. CHANGELOG.md tracks PRD revisions.

## Phases

| Phase | Status |
| --- | --- |
| 0. Setup | Built, awaiting user's iPhone test (see README "Phase 0 test") |
| 1. Logging core | Not started |
| 2. Reminders and Shortcuts | Not started |
| 3. Budgets and bills | Not started |
| 4. Depth | Not started |
| 5. Polish | Not started |

## Phase 0 contents

- Next.js 15.5.4 (App Router, TypeScript, `src/`), Tailwind 4, ESLint. `output: "standalone"`.
- Test page `/`: shows host, protocol, server time (Asia/Dubai) and `window.isSecureContext`.
- `GET /api/health`: status, start time, current time, timezone. Used by the Docker healthcheck; becomes the base for F13 server health.
- Dockerfile (multi-stage, `node:22-alpine`, non-root `node` user; builds on amd64 and arm64).
- `compose.yaml`: `restart: unless-stopped`, port bound to `127.0.0.1:3000` only, `./data` and `./backups` volumes, `TZ=Asia/Dubai`, healthcheck.
- README: macOS / Linux / Windows host prep, Tailscale HTTPS + `tailscale serve --bg 3000`, iPhone setup, test steps, troubleshooting.

Verified in the build sandbox: lint and build pass; container reports `healthy`, restart policy `unless-stopped`, port published on 127.0.0.1 only, container clock in GMT+4. Not verifiable in the sandbox: Tailscale, the ts.net certificate, the iPhone.

## Decisions

| Date | Decision |
| --- | --- |
| 20/10/2026 | Repo: tejas11jally-bit/bugetTracker (private). |
| 20/10/2026 | Server: an always-on home office machine sends reminders (PRD design kept). OS not yet confirmed, so README covers macOS, Linux and Windows. |
| 20/10/2026 | Container port bound to 127.0.0.1 so the LAN cannot bypass Tailscale. |
| 20/10/2026 | No `tzdata` package: Node's bundled ICU handles Asia/Dubai (verified). |
| 20/10/2026 | System font stack instead of `next/font/google`, so builds need no font download and the iPhone shows its native font. |
| 20/10/2026 | Proposed (pending user approval): Phase 1 toast (F3) shows "Saved: <category> AED X · AED Y spent this month". Remaining budget is added in Phase 3 (F9), streak in Phase 2 (F26). Resolves CHANGELOG open issue 4. |

## Known issues

- Home machine OS not confirmed; README can be trimmed once known.
- Windows hosts: Docker Desktop needs a user sign-in after reboot. This is a reliability risk for the 95% reminder target.
- CHANGELOG open issues 1, 2 and 3 remain open (email fallback, measurable perf target, delivery measurement). Issue 5 resolved: home office machine.
