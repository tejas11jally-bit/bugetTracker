# Ledgerly

Self-hosted, single-user budget tracker. Runs on an always-on home machine in Docker and is opened on the iPhone as a Home Screen app over Tailscale HTTPS. Nothing is exposed to the public internet.

- Product spec: [PRD.md](PRD.md)
- Build status and decisions: [PROGRESS.md](PROGRESS.md)

## How it fits together

```
iPhone (Tailscale app, On Demand)
   │  https://ledgerly.<tailnet>.ts.net   ← trusted HTTPS cert, tailnet only
   ▼
Home machine: tailscale serve  →  http://127.0.0.1:3000  →  Docker container "ledgerly"
```

The container listens on `127.0.0.1:3000` only, so other devices on your home Wi-Fi cannot reach it directly. `tailscale serve` is the only way in.

## 1. Prepare the home machine

The machine must stay awake 24/7, because it sends the reminders. Follow the section for your OS.

### macOS (Mac mini or MacBook)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [OrbStack](https://orbstack.dev/). In its settings, turn on **Start at login**.
2. Install Tailscale from <https://tailscale.com/download/mac> and sign in.
3. Disable sleep and auto-restart after a power cut:
   ```sh
   sudo pmset -a sleep 0 disksleep 0 autorestart 1
   ```
   System Settings → Users & Groups → turn on automatic login, so Docker starts after a reboot without anyone typing a password. A MacBook must stay plugged in with the lid open, or connected to an external display.
4. The Tailscale CLI on macOS is at `/Applications/Tailscale.app/Contents/MacOS/Tailscale`. Add an alias:
   ```sh
   alias tailscale=/Applications/Tailscale.app/Contents/MacOS/Tailscale
   ```

### Linux (Ubuntu, Debian, Raspberry Pi OS 64-bit)

1. Install Docker Engine and Tailscale:
   ```sh
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # log out and back in
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
2. Disable sleep:
   ```sh
   sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
   ```
   On a laptop, edit `/etc/systemd/logind.conf`, set `HandleLidSwitch=ignore` and `HandleLidSwitchExternalPower=ignore`, then run `sudo systemctl restart systemd-logind`.

### Windows

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (WSL 2 backend). Settings → General → turn on **Start Docker Desktop when you sign in**.
2. Install Tailscale from <https://tailscale.com/download/windows> and sign in.
3. Settings → System → Power → set **Sleep** to **Never** while plugged in. On a laptop, Control Panel → Power Options → "Choose what closing the lid does" → **Do nothing**.
4. Docker Desktop starts only after a Windows sign-in. Set up automatic sign-in, or after every reboot the app stays down until you log in.

## 2. Enable HTTPS in Tailscale (once per tailnet)

1. Open <https://login.tailscale.com/admin/dns>.
2. Make sure **MagicDNS** is on.
3. Under **HTTPS Certificates**, click **Enable HTTPS**.
4. Open <https://login.tailscale.com/admin/machines>, find the home machine, choose **Edit machine name**, and set it to `ledgerly`. Your address becomes `https://ledgerly.<your-tailnet>.ts.net`.

## 3. Run Ledgerly

```sh
git clone https://github.com/tejas11jally-bit/bugetTracker.git ledgerly
cd ledgerly
docker compose up -d --build
curl http://127.0.0.1:3000/api/health     # expect {"status":"ok",...}
```

The repo is private, so `git clone` asks for credentials. Either run `gh auth login` first ([GitHub CLI](https://cli.github.com/)), or use your GitHub username with a [personal access token](https://github.com/settings/tokens) as the password.

`restart: unless-stopped` brings the container back after reboots and crashes. SQLite data will live in `./data` and nightly backups in `./backups` (from Phase 1).

To update later:

```sh
git pull
docker compose up -d --build
```

## 4. Publish it to your tailnet

```sh
tailscale serve --bg 3000          # use sudo on Linux
tailscale serve status             # shows https://ledgerly.<tailnet>.ts.net → 127.0.0.1:3000
```

`--bg` keeps the setting across reboots. The first HTTPS request can take up to a minute while Tailscale issues the certificate.

**Never run `tailscale funnel`.** Funnel publishes the app to the public internet. Ledgerly uses `serve` only.

## 5. Set up the iPhone

1. Install **Tailscale** from the App Store and sign in with the same account.
2. In the Tailscale app → Settings → **VPN On Demand** → turn it on, so the phone stays connected away from home.

## 6. First run

1. On the iPhone (Tailscale connected), open `https://ledgerly.<your-tailnet>.ts.net` in **Safari**.
2. Create your account: name, email, password, starter categories, and your accounts with today's balances (credit cards: amount owed).
3. Follow **Set up your phone**: Share → Add to Home Screen → open Ledgerly from the icon → **Enable reminders** (iOS only allows this from the Home Screen app, after a tap).
4. Log something: tap **+**, type `32 @coffee`, press return.
5. Optional: Settings → **Shortcuts & tokens** for Apple Pay capture and the Quick Log shortcut (step-by-step instructions are in the app).
6. Optional: Settings → **Sign-in** → **Add Face ID / passkey**.

Quick add grammar: `45 @groceries Carrefour`, `20 USD @coffee`, `+15000 @salary`, `12 @lunch #work`, `300 !cash @groceries`, `… note: anything`.

## Acceptance tests (PRD "Done when")

The PRD's per-phase gates were run together at the end at the owner's request. Check each one on your own setup:

| Phase | Test | Pass when |
| --- | --- | --- |
| 0 | iPhone on mobile data (Wi-Fi off) opens the ts.net address | Lock icon, no certificate warning |
| 1 | Install from Home Screen, log 10 real purchases | Each takes under 10 seconds |
| 2 | Leave reminders on for 7 nights, phone locked | A 21:00 push arrives each night; Settings → Reminders shows the delivery log |
| 2 | Pay with Apple Pay | Purchase appears in Review within 10 seconds |
| 3 | Make one purchase in a foreign currency, then compare Left to Budget with the breakdown on the Budget screen | Left to Budget = from last month + income − assigned − uncategorised |
| 4 | After a month, reconcile every account | Gap under 2% on each (Accounts shows the gap) |
| 5 | Receipt photo, 90-day forecast, dark mode and accent colour | Your sign-off |

## Backups and restore

- **Nightly:** at 03:00 the database is copied to `./backups/ledgerly-YYYY-MM-DD.db`; 30 days are kept. Settings → Import, export & backup has **Back up now** and download links.
- **Full export:** Settings → Import, export & backup → *Full backup (JSON)* and *Transactions (CSV)*.
- **Also keep a copy of `./data/secrets.json`.** It holds the push (VAPID) keys and the login signing key. Without it, phones must re-enable reminders and you sign in again.

Restore from a nightly backup:

```sh
docker compose down
cp backups/ledgerly-2026-10-20.db data/ledgerly.db
rm -f data/ledgerly.db-wal data/ledgerly.db-shm
docker compose up -d
```

Restore from a JSON export: Settings → Import, export & backup → Restore (type RESTORE). A database snapshot is saved to `./backups` first.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Safari "cannot connect" | Tailscale on the iPhone is off, or the home machine is asleep. Run `tailscale status` on both. |
| Certificate warning | HTTPS Certificates is not enabled (step 2), or you opened the raw `100.x.y.z` IP instead of the `.ts.net` name. |
| `502` from the ts.net address | The container is down. Run `docker compose ps` and `docker compose logs ledgerly`. |
| No reminders | Dashboard → Server health must say Online. Settings → Reminders → Send test notification. If the device shows Inactive, open Ledgerly on that phone and tap Re-enable. |
| Apple Pay shortcut says 401 | The token was revoked or mistyped. Create a new one in Settings → Shortcuts & tokens. |
| Forgot password | `docker compose exec ledgerly node scripts/reset-password.mjs 'new password'` (also removes passkeys; add Face ID again after). |
| Address shows a different machine name | Rename the machine (step 2.4), then run `tailscale serve --bg 3000` again. |

## Development

```sh
npm install
npm run dev        # applies migrations, then http://localhost:3000 (data in ./data)
npm test           # parser, budget and scheduler tests, each on a throwaway database
npm run typecheck
npm run lint
npm run build
```

Layout: `src/lib` holds the logic (ledger, budget, reminders, push, fx, reports), `src/app/(app)` the signed-in screens, `src/app/api` the JSON endpoints (`/api/ingest` for Shortcuts), `prisma/` the schema and migrations. Set `LEDGERLY_SCHEDULER=off` to run without the reminder scheduler.
