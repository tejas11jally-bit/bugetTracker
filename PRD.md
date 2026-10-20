# Ledgerly: Product Requirements Document

Self-hosted, single-user budget tracking PWA. Recreates Budgeteer: Expense Tracker (iOS) for one user, without voice input or bank sync. Installs on iPhone, reminds the user to log purchases, and shows where every dirham goes.

## Instructions for Claude Code

- This file is the source of truth. Re-read the relevant sections before starting each phase.
- Build one phase at a time (see "Build phases"). Stop at the end of each phase, list what was built, and give the user the exact manual test from the "Done when" column. Do not start the next phase until the user confirms it passed.
- Requirement IDs (F1 to F29) map to phases. Mention the IDs you implemented in each summary.
- Ask before adding any dependency or service not listed in "Tech stack".
- Never expose the app publicly. It is served only through `tailscale serve`.
- Keep a `PROGRESS.md` file updated with completed phases, decisions made, and known issues.

## Constraints that shape the design

1. **Logging friction is the main risk.** No bank sync, so the app only works if logging is fast. Target: any purchase logged in under 10 seconds. Apple Pay capture via iOS Shortcuts (F20) and a Quick Log shortcut (F21) remove most manual entry.
2. **The server must be always on.** Reminders are sent by the server's scheduler. It runs on an always-on home machine (Mac mini, spare laptop with sleep disabled, or Raspberry Pi 5).
3. **The iPhone must reach the server over trusted HTTPS from anywhere.** iOS only allows web push for PWAs added to the Home Screen and opened from there, and PWAs only install from a valid HTTPS origin. `localhost` or a LAN IP will not work. Use Tailscale with `tailscale serve`, which provides a trusted HTTPS address on the private tailnet (for example `https://ledgerly.<tailnet>.ts.net`). Nothing is exposed to the public internet.
4. **Logging loop first.** Reports and goals come after the user has logged daily for several weeks.

## Goals and success metrics

| Goal | Metric | Target |
| --- | --- | --- |
| Habit | Days with at least one entry or a "nothing today" check-in | 25 of 30 days |
| Speed | Time from reminder tap to saved transaction | Under 10 seconds |
| Accuracy | Gap between app balance and real balance at monthly reconcile | Under 2% |
| Control | Categories finishing the month within budget | 80% or more |
| Reliability | Reminders delivered on schedule | 95% or more |

Primary user: one person in Dubai, base currency AED, logging mostly on iPhone and reviewing on desktop.

## Scope

| In v1 | Out of v1 |
| --- | --- |
| Manual entry with one-line quick add | Bank or card sync, SMS parsing |
| Apple Pay capture via an iOS Shortcuts automation | Voice input |
| Quick Log from the iPhone Home Screen or Action Button via a Shortcut, without opening the app | Receipt OCR (photo attachment only) |
| Accounts, transfers, credit card payments, net worth | Home Screen widgets (PWAs cannot create them; Shortcuts cover quick logging) |
| Monthly zero-based budget with Left to Budget | Investments and portfolio tracking |
| 19 currencies per account and per transaction, converted to AED | Multi-user, public hosting, subscriptions or paywalls |
| Recurring transactions, goals with templates, streaks | Native App Store build |
| Reminders via web push, reports, CSV export | AI categorisation (rule-based auto-categorisation is in) |

## Functional requirements

P0 = first build. P1 = first month of use. P2 = once the logging habit holds.

| ID | Module | Requirement | Priority |
| --- | --- | --- | --- |
| F1 | Quick add | One-line entry from any screen and a floating + button: `45 @groceries Carrefour` parses amount, category and payee. Optional currency code (`20 USD @coffee`). Defaults: today's date, last-used account. | P0 |
| F2 | Quick add | Form fallback: amount keypad, category picker (6 most recent first), account, date, payee, note, tags. Saves in 2 taps after amount. | P0 |
| F3 | Quick add | After save, a toast shows the category's remaining amount this month and the current streak. | P0 |
| F4 | Transactions | List with running balance per account, search, filters (date, category, account, tag). Edit, delete, duplicate. | P0 |
| F5 | Transactions | Split one purchase across categories. | P1 |
| F6 | Transactions | Transfers between accounts (including credit card payments), not counted as spending. | P0 |
| F7 | Accounts | Cash, debit, credit card and savings accounts with opening balance and currency. Credit cards track statement day and due day. | P0 |
| F8 | Accounts | Reconcile: enter the bank's balance; the app flags the gap and suggests an adjustment entry. | P1 |
| F9 | Budgets | Monthly budget per category, zero-based (all income assigned). Progress bars, remaining amount, daily allowance left, Left to Budget banner. | P0 |
| F10 | Budgets | Overspend stays in its category; user rolls it forward or covers it from another category. Copy last month in one click. | P1 |
| F11 | Recurring | Income and bills on any cadence (weekly, fortnightly, monthly, quarterly, yearly, custom). Due-date calendar. Mark paid in one tap. Optional auto-post with a notification. | P0 |
| F12 | Goals | Savings goals with target amount, target date, monthly contribution needed, progress bar. | P1 |
| F13 | Dashboard | Top to bottom: safe-to-spend today, month spent vs budget, top 5 categories, bills due in 7 days, streak, server health. | P0 |
| F14 | Reports | Spending by category (month, custom range), 12-month trend, income vs expense, payee ranking. | P1 |
| F15 | Alerts | In-app bell: over budget, 80% of category used, bill due tomorrow, unusually large transaction. | P1 |
| F16 | Reminders | Scheduled web push reminders (see "Phone reminders"). | P0 |
| F17 | Data | CSV export of all transactions; CSV import with column mapping; full JSON backup and restore. | P1 |
| F18 | Data | Receipt photo attached to a transaction (stored locally, no OCR). | P2 |
| F19 | Forecast | 90-day projected balance per account from recurring items, red below a user-set threshold. | P2 |
| F20 | Apple Pay capture | iOS Shortcuts automation on the Wallet "Transaction" trigger (iOS 17+) posts amount, merchant and card to `POST /api/ingest`. App auto-categorises via merchant rules and marks it "Review" until confirmed. | P1 |
| F21 | Quick Log | iOS Shortcut (Home Screen icon or Action Button) asks amount, then category from a list, and posts to `/api/ingest`. No app opening needed. Provide the Shortcut setup steps in-app. | P1 |
| F22 | Auto-categorise | Merchant-to-category rules learned from user corrections. | P1 |
| F23 | Multi-currency | Currencies: AED, USD, EUR, GBP, INR, SAR, QAR, KWD, OMR, BHD, JPY, CNY, CAD, AUD, CHF, SGD, PKR, PHP, EGP. Stored in original currency, converted to AED at that day's rate for budgets and reports. Rate editable per transaction. | P0 |
| F24 | Net worth | Assets minus liabilities across accounts, monthly trend line. | P1 |
| F25 | Goal templates | 14 starter templates (emergency fund, travel, car, wedding, pay off credit card, and others) plus custom. Unlimited goals. | P1 |
| F26 | Streaks | Daily streak with milestones at 7, 30, 100 and 365 days; weekly progress strip. "Nothing today" check-in keeps the streak. | P0 |
| F27 | Reports | Spending by payment method, budget performance by month, cash flow, category trends vs 3-month average. | P1 |
| F28 | Getting started | Dashboard checklist: add accounts, set budget, install app, enable reminders, set up Apple Pay shortcut. | P0 |
| F29 | Appearance | Light, dark and system themes; accent colour choice. | P2 |

## Phone reminders

Reminders use the Web Push API. The app is installed to the iPhone Home Screen as a PWA, notification permission is granted once, and the server sends scheduled pushes that open straight into quick add.

**Self-hosting behaviour**

- The scheduler runs inside the app on the always-on machine and sends each push to Apple's push service; the iPhone receives it anywhere, including off Wi-Fi.
- The iPhone opens the app at the Tailscale HTTPS address. The Tailscale iPhone app stays connected (On Demand) so logging and Apple Pay capture work away from home.
- If the server was offline at a scheduled time, missed reminders collapse into one catch-up push on restart, never a burst.
- Dashboard health check shows "Server last online" and "Last reminder sent".
- Email fallback is optional (user's own Gmail SMTP with an app password). If not configured, skip it.

**Subscription flow**

1. Onboarding detects iPhone and shows a 3-step install guide: Share, Add to Home Screen, open from the icon.
2. Notification permission is requested only inside the installed app, after a button tap (iOS requires a user gesture).
3. The push subscription is stored per device; phone and desktop can both receive reminders.
4. A failed or expired subscription marks that device inactive and shows a re-enable prompt. Settings has a "Send test notification" button and last-delivered time per device.

**Reminder types**

| Reminder | Default schedule | Tap opens |
| --- | --- | --- |
| Daily log check | 21:00 every day | Quick add, with "Nothing to log today" option |
| Midday nudge (optional, off by default) | 14:00 weekdays | Quick add |
| Bill due | 1 day before due date, 09:00 | That bill, with Mark paid |
| Weekly review | Friday 10:00 | Week summary: spent vs budget, items in Review |
| Month close | Last day of month, 20:00 | Budget rollover and next-month setup |
| Inactivity | 48 hours with no entry and no check-in | Quick add |

**Rules**

- All times in the user's time zone (default Asia/Dubai). Quiet hours 23:00 to 08:00.
- Each reminder can be switched off or rescheduled individually. Maximum 3 pushes per day.
- No amounts or balances in notification text by default (lock screen privacy). Toggle to allow.

## Screens and core flows

Bottom tab bar on mobile, left sidebar on desktop.

| Screen | Purpose | Key elements |
| --- | --- | --- |
| Onboarding | Get to the first logged purchase | Currency, accounts with balances, starter categories, install guide, notification permission, reminder time |
| Dashboard | Answer "how am I doing" in 5 seconds | Safe-to-spend, budget bars, upcoming bills, streak, getting-started checklist |
| Quick add | Log fast | Text line or keypad form, recent categories, save + receipt toast |
| Transactions | Review and fix | Filters, search, running balance, Review queue, bulk recategorise |
| Budget | Plan the month | Per category: assigned, spent, left; Left to Budget banner |
| Bills and goals | Obligations and savings | Calendar view, list view, goal cards |
| Reports and settings | Analyse and configure | Charts, export, reminders per device, categories, accounts, Shortcut tokens |

**Core flow: reminder to logged purchase**

1. Push arrives at 21:00: "Anything to log today?"
2. Tap opens the installed app on quick add.
3. User types `32 @coffee` and presses enter, or taps "Nothing today".
4. Toast: "Coffee: AED 118 left this month. 12-day streak."
5. App returns to the dashboard.

## Data model

Every row has `created_at` and `updated_at`. Amounts are integers in minor units, with decimals per currency (AED, USD, EUR: 2; JPY: 0; KWD, OMR, BHD: 3).

| Table | Key fields |
| --- | --- |
| users | id, email, name, password_hash, base_currency (AED), timezone, quiet_hours_start, quiet_hours_end, streak_count, last_log_date |
| accounts | id, name, type (cash, debit, credit, savings), currency, opening_balance, statement_day, due_day, archived |
| categories | id, name, group (Essentials, Lifestyle, Savings, Income), icon, colour, sort_order, archived |
| transactions | id, account_id, date, currency, amount_original (negative = spend), fx_rate, amount_base (AED fils), payee, note, tags, type (expense, income, transfer), transfer_account_id, source (manual, apple_pay, quick_log, recurring, import), status (confirmed, review), card_label, receipt_path, parent_id (splits) |
| budgets | id, category_id, month (YYYY-MM), assigned_amount, rollover_mode (carry, reset) |
| recurring_items | id, name, amount, currency, account_id, category_id, cadence, interval, next_due_date, auto_post |
| goals | id, name, template_key, target_amount, target_date, linked_account_id, saved_amount |
| reminders | id, type, schedule, enabled, channel (push, email), last_sent_at |
| push_subscriptions | id, device_label, endpoint, keys, last_success_at, active |
| checkins | id, date, type (logged, nothing_today) |
| fx_rates | date, currency, rate_to_aed, source (auto, manual). Fetched daily; last known rate reused when offline |
| merchant_rules | id, match_text, category_id, hit_count |
| api_tokens | id, label, token_hash, last_used_at, revoked. Bearer tokens for Shortcuts |

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js (App Router, TypeScript) + Tailwind; PWA manifest + service worker | One codebase for iPhone and desktop; installs to the Home Screen |
| Database | SQLite via Prisma, one file in a mounted volume | Single user needs no database server; backup is one file |
| Auth | Single account: password, then optional passkey (Face ID); long-lived session | Only one user; Face ID makes reopening instant |
| Push | `web-push` library with VAPID keys | Standard Web Push; works for Home Screen PWAs on iOS 16.4+ |
| Scheduler | `node-cron` inside the app process, checks every minute | No extra service |
| Exchange rates | Daily fetch from a free rates API that covers AED, with manual override | Accurate AED budgets for foreign spending |
| Shortcuts API | `POST /api/ingest` with a bearer token per Shortcut | Apple Pay and Quick Log shortcuts post transactions |
| Runtime | Docker Compose, restart policy `unless-stopped` | Survives reboots; easy to move machines |
| Private access | Tailscale + `tailscale serve` to port 3000 | Trusted HTTPS for install and push; no public exposure |

**Non-functional requirements**

- Security: password plus passkey login; reachable only inside the tailnet; Shortcut tokens revocable and stored hashed; no financial data in URLs or notification text by default.
- Performance: dashboard under 1.5 seconds on 4G; quick add feels instant (optimistic UI).
- Offline: quick add works offline and syncs when back online (queued in IndexedDB).
- Accessibility: WCAG AA contrast; all actions keyboard-reachable on desktop.
- Data ownership: one-click full export (CSV + JSON).
- Locale: AED default, dates DD/MM/YYYY, week starts Monday (configurable).
- Backup: nightly copy of the SQLite file to a mounted backup folder, keeping 30 days. Restore tested in phase 1.

## Build phases

| Phase | Delivers | Done when |
| --- | --- | --- |
| 0. Setup | Project scaffold, Docker Compose, README with Tailscale + `tailscale serve` setup steps | iPhone Safari (on mobile data) opens a test page at the ts.net address with a valid lock icon |
| 1. Logging core | Login, accounts with currency, categories, quick add, transactions list, transfers, PWA install, nightly backup (F1 to F4, F6, F7, F23) | Installed from the Home Screen, 10 real purchases logged, each in under 10 seconds |
| 2. Reminders and Shortcuts | Push, scheduler, reminder types, streaks, ingest API, Shortcut setup guides (F16, F20, F21, F26) | 7 nights of 21:00 reminders on a locked phone; an Apple Pay tap appears as "Review" within 10 seconds |
| 3. Budgets and bills | Zero-based budget, recurring items, dashboard, getting-started checklist (F9, F11, F13, F28) | Left to Budget matches a manual check, including one foreign-currency purchase |
| 4. Depth | Splits, reconcile, goals, net worth, reports, rules, alerts, import/export (F5, F8, F10, F12, F14, F15, F17, F22, F24, F25, F27) | After a full month, reconcile gap under 2% on every account |
| 5. Polish | Receipt photos, forecast, themes (F18, F19, F29) | User sign-off |

## Decisions

| Question | Decision |
| --- | --- |
| Reference app | Budgeteer: Expense Tracker (iOS), https://apps.apple.com/ca/app/budgeteer-expense-tracker/id6757654153. Voice tracking and receipt OCR excluded |
| Device | iPhone; Home Screen install and Tailscale are required |
| Builder and stack | Claude Code; Next.js + SQLite in Docker, accessed via Tailscale |
| Currencies | 19 major currencies, converted to AED |
| Hosting | Self-hosted, single user |

Open: which always-on machine runs the server. Ask the user before writing machine-specific setup.
