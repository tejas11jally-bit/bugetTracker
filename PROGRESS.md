# Ledgerly progress

PRD.md is the source of truth. CHANGELOG.md tracks PRD revisions.

## Phases

| Phase | Status |
| --- | --- |
| 0. Setup | In progress: Next.js 15 + TypeScript + Tailwind scaffold committed. Docker Compose, test page and Tailscale README not started. |
| 1. Logging core | Not started |
| 2. Reminders and Shortcuts | Not started |
| 3. Budgets and bills | Not started |
| 4. Depth | Not started |
| 5. Polish | Not started |

## Decisions

| Date | Decision |
| --- | --- |
| 20/10/2026 | Repo: tejas11jally-bit/bugetTracker (private). |
| 20/10/2026 | Scaffold: Next.js 15.5.4 (App Router, TypeScript, `src/` dir), Tailwind 4, ESLint. |
| 20/10/2026 | Proposed (pending user approval): Phase 1 toast (F3) shows "Saved: <category> AED X · AED Y spent this month". Remaining budget is added in Phase 3 (F9), streak in Phase 2 (F26). Resolves CHANGELOG open issue 4. |

## Blocking decision

**Where the server runs.** The user wants Ledgerly to "run on my iPhone". Two readings:

1. **PRD as written.** The app is used on the iPhone (Home Screen PWA). A home machine (Mac mini, Pi 5 or Linux laptop) runs Docker and sends pushes.
2. **iPhone only, no server.** Data stored on the device. This loses server-scheduled push (F16), breaks Apple Pay and Quick Log ingest (F20, F21), loses nightly backup, and needs public static hosting. Needs a PRD rewrite before building.

Phase 0 Docker, Tailscale and README work waits on this answer.

## Known issues

- CHANGELOG open issues 1, 2, 3 and 5 remain open.
