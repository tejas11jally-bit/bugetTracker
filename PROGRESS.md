# Ledgerly progress

PRD.md is the source of truth. CHANGELOG.md tracks PRD revisions.

## Status

All phases (0–5) are built. On 20/10/2026 the owner asked to skip the per-phase stops and review only the final result, so the PRD's "Done when" checks were not run phase by phase. They are listed in README → "Acceptance tests" and still need to be run on the real home machine and iPhone.

| Phase | Requirements | Built | Owner test |
| --- | --- | --- | --- |
| 0. Setup | Scaffold, Docker Compose, Tailscale README | ✓ | Pending |
| 1. Logging core | F1, F2, F3, F4, F6, F7, F23, login, PWA, nightly backup | ✓ | Pending |
| 2. Reminders and Shortcuts | F16, F20, F21, F26 | ✓ | Pending |
| 3. Budgets and bills | F9, F11, F13, F28 | ✓ | Pending |
| 4. Depth | F5, F8, F10, F12, F14, F15, F17, F22, F24, F25, F27 | ✓ | Pending |
| 5. Polish | F18, F19, F29 | ✓ | Pending |

## Where each requirement lives

| ID | Where |
| --- | --- |
| F1 quick add line | `src/lib/quick-add.ts`, `src/components/quick-add.tsx`, `POST /api/transactions`; + button on every screen, `N` key on desktop |
| F2 keypad form | `src/components/quick-add.tsx` (Keypad tab: 6 recent categories first, save = tap category + Save) |
| F3 save toast | `src/lib/toast.ts` ("Coffee: AED 118 left this month. 12-day streak.") |
| F4 transactions | `/transactions` (running balance, search, filters, bulk recategorise), `/transactions/[id]` (edit, duplicate, delete) |
| F5 splits | Split editor on `/transactions/[id]`; `split` parent + child rows |
| F6 transfers | Keypad → Transfer; excluded from spending and budgets |
| F7 accounts | `/accounts`, `/accounts/[id]` (currency, opening balance, statement/due day) |
| F8 reconcile | `/accounts/[id]` (live gap, % gap, optional adjustment entry) |
| F9 budget | `/budget`, `src/lib/budget.ts` (Left to Budget banner with breakdown, daily allowance) |
| F10 overspend | Carry/Reset per category, "Cover from…", "Copy last month" |
| F11 recurring | `/bills` (list, calendar, Mark paid, Skip, auto-post at 06:00 with a notification) |
| F12, F25 goals | `/goals` (14 templates + custom, monthly amount needed, link an account) |
| F13 dashboard | `/` (safe to spend, month vs budget, top 5, bills in 7 days, streak, server health) |
| F14, F27 reports | `/reports` tabs |
| F15 alerts | Bell → `/alerts`; `src/lib/alerts.ts` |
| F16 reminders | `src/lib/reminders.ts`, `src/lib/push.ts`, `/settings/reminders` |
| F17 data | `/settings/data`, `/api/export/*`, `/api/import`, `/api/restore` |
| F18 receipts | `/transactions/[id]` upload; files in `data/receipts`, served via `/api/receipts/[id]` (session only) |
| F19 forecast | `/reports?tab=forecast` |
| F20, F21 Shortcuts | `POST /api/ingest`, `/settings/shortcuts` (tokens + step-by-step setup) |
| F22 rules | Learned on manual entry and Review corrections; `/settings/rules` |
| F23 currencies | `src/lib/money.ts`, `src/lib/fx.ts`, `/settings/rates`; rate editable per transaction |
| F24 net worth | `/accounts`, `/reports?tab=networth` |
| F26 streaks | `src/lib/ledger.ts` (check-ins, milestones 7/30/100/365, weekly strip); "Nothing to log today" |
| F28 checklist | Dashboard "Getting started" |
| F29 appearance | Settings → Appearance (light/dark/system, 7 accent colours) |

## Decisions

| Date | Decision |
| --- | --- |
| 20/10/2026 | Repo: tejas11jally-bit/bugetTracker (private). |
| 20/10/2026 | Server: an always-on home office machine (OS not confirmed; README covers macOS, Linux, Windows). |
| 20/10/2026 | Owner: build all phases, stop only for the final result. |
| 20/10/2026 | Extra dependency approved: `@simplewebauthn` (passkeys). Not approved: `nodemailer`, so there is no email fallback (CHANGELOG open issue 1 remains open). |
| 20/10/2026 | Charts, CSV and password hashing (scrypt) are hand-written to avoid new dependencies. |
| 20/10/2026 | Exchange rates: open.er-api.com (free, no key, covers AED), fetched daily at 06:00. Built-in approximate rates (flagged "Approximate") until the first fetch. |
| 20/10/2026 | F3 toast shows the full PRD wording (remaining + streak) because all phases shipped together (resolves CHANGELOG open issue 4). Unbudgeted categories show "AED X spent this month" instead. |
| 20/10/2026 | Budget model: per-category available = carry-in + assigned − spent. "Reset" categories return leftover (or overspend) to Left to Budget next month. Uncategorised spending reduces Left to Budget. |
| 20/10/2026 | Daily-log reminder is still sent if something was logged that day, but the wording changes ("Logged 2 today. Anything else?"). This keeps the Phase 2 test (7 nights of 21:00 reminders) observable. |
| 20/10/2026 | Reminder delivery is measured in `push_log` (reached at least one device vs attempted), shown in Settings → Reminders. Addresses CHANGELOG open issue 3. |
| 20/10/2026 | Sessions are signed cookies (HMAC, 1 year), so there is no sessions table. Secrets (session key, VAPID keys) are generated into `data/secrets.json`. |
| 20/10/2026 | Container port bound to 127.0.0.1; `tailscale serve` is the only way in. |
| 20/10/2026 | Next.js 15.5.27 + React 19.1.9 (patched for CVE-2025-55182). React 19.2 was tried and dropped. |

## Data model additions beyond the PRD table

- `transactions.category_id` (missing from the PRD table but needed), `transfer_amount` (cross-currency transfers), `split`, `recurring_item_id`.
- `accounts.reconciled_at`, `reconciled_balance`, `reconcile_gap_bp` (Accuracy metric).
- `users`: week start, theme, accent, push amount privacy toggle, max pushes per day, last account, forecast threshold, install flag, checklist dismissed.
- New tables: `passkeys`, `alerts`, `app_state` (heartbeat, job runs, last backup), `push_log` (daily cap and delivery rate).
- `goals.archived`, `recurring_items.archived`, `push_subscriptions.last_error`.

## Verification done in the build sandbox

- `npm run lint`, `npm run typecheck`, `npm run build` all pass.
- `npm test`: quick-add and Apple Pay amount parsing; currency maths; budget carry/reset/cover/copy across months with a USD purchase; scheduler (21:00 send, no repeat, outage → one catch-up, quiet hours, catch-up held until 08:00, daily cap of 3, failed-delivery logging).
- Browser walkthrough at iPhone size and desktop (Playwright, against both the standalone server and the Docker image): setup, quick add line and keypad (about 130 ms per save), transfer, Nothing today, budget, bills + calendar, goals, splits, every settings and report page, dark mode, desktop quick add.
- API: ingest (AED string, "12,50 €", Quick Log), bad token → 401, signed-out API → 401, ingest about 20 ms.
- Data: CSV export, CSV import with debit/credit mapping and duplicate skip, JSON export → restore round trip, nightly SQLite backup → file restore.
- Docker: image builds; container migrates on start, reports healthy, restarts `unless-stopped`.

Not verifiable in the sandbox: Tailscale, the ts.net certificate, real push delivery to an iPhone, Apple Pay Shortcuts, passkeys on a real device, the live exchange-rate fetch (blocked here).

## Known issues and risks

- **Untested on real hardware.** See the acceptance tests in README.
- **Fixed during the build:** a `<Suspense>` boundary around the app shell made the screen silently fail to refresh after a save whenever the page took more than about 50 ms to render. The data was saved, but the UI looked unchanged, which invites duplicate taps. Removed; 15/15 saves now refresh in testing.
- **Next.js race (upstream):** a save tapped within roughly 300 ms of a page loading can occasionally miss its redirect (seen on the new-goal form). The data is saved. Unlikely with human timing.
- **npm audit:** remaining findings are build-time only (`postcss` inside Next, `deepmerge-ts` via the Prisma CLI). Fixing them needs Next 16 / Prisma 7 (major upgrades).
- **No email fallback** for failed pushes (dependency not approved).
- **Windows hosts:** Docker Desktop needs a user sign-in after reboot. This risks the 95% reminder target.
- **Performance target** (CHANGELOG open issue 2): measured locally at about 130 ms per quick-add save; not yet measured over Tailscale on 4G.
- Receipt HEIC photos are stored and downloadable but not previewed inline (browsers other than Safari can't show HEIC).
