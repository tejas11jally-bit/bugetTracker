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

## Phase 0 test

1. On the iPhone, turn **Wi-Fi off** (mobile data only).
2. Open Safari and go to `https://ledgerly.<your-tailnet>.ts.net`.
3. Pass when all three hold:
   - Safari shows the lock icon with no certificate warning.
   - **Host** on the page ends in `.ts.net` and **Protocol** shows `https`.
   - **Secure context** shows **Yes**.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Safari "cannot connect" | Tailscale on the iPhone is off, or the home machine is asleep. Run `tailscale status` on both. |
| Certificate warning | HTTPS Certificates is not enabled (step 2), or you opened the raw `100.x.y.z` IP instead of the `.ts.net` name. |
| `502` from the ts.net address | The container is down. Run `docker compose ps` and `docker compose logs ledgerly`. |
| Address shows a different machine name | Rename the machine (step 2.4), then run `tailscale serve --bg 3000` again. |

## Development

```sh
npm install
npm run dev     # http://localhost:3000
npm run lint
npm run build
```
