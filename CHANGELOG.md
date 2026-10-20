# Ledgerly PRD changelog

Visual map with full change list: Ledgerly PRD Map artifact.

## v2: PRD.md (20/10/2026)
Rewritten from a plain-language PRD into a Claude Code build spec. 48 tracked changes vs v1 (8 added, 30 changed, 10 removed).

**Added**
- Instructions for Claude Code (phase gates, F-ID mapping, ask before new dependencies, PROGRESS.md)
- Phase 5 Polish: F18, F19, F29 (unscheduled in v1)
- Screens: getting-started checklist, Review queue, Shortcut tokens
- Fields: users.password_hash, reminders.last_sent_at, recurring_items.currency

**Changed (main)**
- F1 currency code in quick add; F7 account currency; F9 Left to Budget banner; F11 optional auto-post; F13 server health; F20 iOS 17+ and POST /api/ingest; F21 in-app setup steps; F26 "Nothing today" keeps streak
- Requirement tables and data model tables merged into single tables (13 tables)
- Midday nudge off by default; weekly review shows items in Review
- Backup target: mounted backup folder; passkey optional; tokens stored hashed

**Removed**
- Per-row user_id; delete-account promise; Android notification actions; Phase 1 paste prompt; Sources; name decision

**Open issues introduced or exposed by v2**
1. Failed push no longer falls back to email (v1 did). Restore email fallback for the 21:00 reminder when SMTP is configured.
2. Performance target "under 300 ms perceived" became "feels instant". Restore a measurable target.
3. Reliability metric lost "tracked by open receipts". Define how delivery is measured.
4. F3 toast (Phase 1) depends on F9 budgets (Phase 3) and F26 streaks (Phase 2). Scope the Phase 1 toast down.
5. Always-on machine still undecided.

## v1: Cowork doc "Ledgerly Budget Tracker PRD", revision 34 (20/10/2026)
Baseline.
