# Phase 7 (Deployment) — Operations runbook

A practical "how do I actually run this thing" reference — local
development, redeploying each service, checking on them, and the most
likely things to go wrong. Read `01_aws_setup_log.md` for how this was
built and `02_concepts_explained.md` for what each piece is; this doc is
for day-to-day use afterwards.

---

## The three environments, at a glance

| | Local dev | `claude` (staging) | `main` (production) |
|---|---|---|---|
| Frontend | `localhost:3000` | `evidenceos-web-git-claude-nani8790s-projects.vercel.app` (stable — same URL every deploy) | `https://evidenceos-web.vercel.app` |
| Backend | `localhost:8010` | `https://18.196.98.199.sslip.io` | **same EC2 box** — no separate production backend exists |
| Database | same Supabase project for all three — no environment separation yet | | |
| Deploys how | you run it | **frontend**: automatic on every push to `claude`. **backend**: manual, `apps/api/deploy.sh` | **frontend**: automatic on every push/merge to `main`. **backend**: same manual script, same box, affects both staging and production at once |

That "same Supabase project" and "same EC2 box" are both worth
remembering: local dev, staging, and production right now all read and
write the *same* database and hit the *same* backend process. There's no
environment separation yet — a real document uploaded from any of the
three is real data visible to all of them, and restarting the backend
(`deploy.sh`, or editing `/etc/evidenceos/api.env`) affects staging and
production simultaneously since it's one process serving both.

---

## Running everything locally

```bash
# Terminal 1 — backend
cd apps/api
.venv/Scripts/activate      # or source .venv/bin/activate on Mac/Linux
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010

# Terminal 2 — frontend
cd apps/web
npx next dev --webpack      # --webpack: Turbopack crashes on this Windows setup
```

Both read their secrets from `apps/api/.env` and `apps/web/.env.local`
respectively — never committed, copy from the matching `.env.example` if
starting fresh.

---

## Redeploying the frontend (Vercel)

**Normal path — just push:**

```bash
git push origin claude   # -> Preview deployment
git push origin main     # (or merge a PR) -> Production deployment
```

Vercel is connected to GitHub (`veera-vsn/EvidenceOS`, Root Directory =
`apps/web`) and auto-builds/deploys on every push — `main` goes to
**Production**, every other branch (including `claude`) goes to
**Preview**. Watch it build at
<https://vercel.com/nani8790s-projects/evidenceos-web/deployments>.

**⚠️ `main` is real production now**, not a theoretical future thing —
it was merged and deployed live during initial setup. Treat pushes/merges
to `main` accordingly.

**Manual path (if you need a deploy without a git push — e.g. testing an
uncommitted change):** run from the **repo root**, not from inside
`apps/web` — the project's Root Directory setting (`apps/web`) gets
applied on top of wherever the CLI already is, so running it from inside
`apps/web` doubles the path and fails with "path does not exist." This
needs a `.vercel/project.json` at the repo root too (gitignored, matching
the one already in `apps/web/.vercel/` — copy it there once if it's
missing).

```bash
cd EvidenceOS               # repo root, not apps/web
npx vercel deploy           # Preview
npx vercel deploy --prod    # Production — confirm with whoever's asking before running this
```

**Environment variables** live in the Vercel dashboard (Settings →
Environment Variables), and must be set **separately for each
environment** (Preview and Production don't share values — this is what
broke the first production deploy, see `CHALLENGES.md` C4/C6). To change
one everywhere it's used:

```bash
cd apps/web
npx vercel env rm NEXT_PUBLIC_API_BASE_URL preview
echo "https://new-value" | npx vercel env add NEXT_PUBLIC_API_BASE_URL preview
npx vercel env rm NEXT_PUBLIC_API_BASE_URL production
echo "https://new-value" | npx vercel env add NEXT_PUBLIC_API_BASE_URL production
```

A new deployment is needed to pick up an env var change — it's baked in
at build time for `NEXT_PUBLIC_*` vars, not read at request time.

---

## Redeploying the backend (EC2)

**There is no auto-deploy here on purpose** (see `01_aws_setup_log.md`
§8 for why — no git credential lives on the server). Every backend change
needs:

```bash
cd apps/api
./deploy.sh
```

What it does, in order: copies the current `apps/api` folder to the
server (excluding `.venv`/`.env`/caches), reinstalls dependencies (no-op
if `requirements.txt` didn't change), restarts the `evidenceos-api`
systemd service, and checks `/health` to confirm it came back up. Takes
about 15-20 seconds.

**If you change an environment variable** (a new API key, a changed
`CORS_ORIGINS`, etc.), `deploy.sh` alone won't pick it up — that lives in
`/etc/evidenceos/api.env` on the server, not in the repo, and is
completely separate from `apps/api/.env` used locally. Adding a var to
`apps/api/.env` and forgetting `/etc/evidenceos/api.env` is exactly what
crash-looped the service in `CHALLENGES.md` C9 — if `apps/api/app/core/
config.py`'s `Settings` gained a new *required* field, check this file
has it **before** running `./deploy.sh`, not after. Edit it directly:

```bash
ssh -i ~/.ssh/evidenceos-api-key.pem ec2-user@18.196.98.199
sudo nano /etc/evidenceos/api.env     # make your edit, save (Ctrl+O, Enter, Ctrl+X)
sudo systemctl restart evidenceos-api
exit
```

---

## Checking on things

**Is the backend up?**

```bash
curl https://18.196.98.199.sslip.io/health
# {"status":"ok","env":"production","version":"0.1.0","timestamp":"..."}
```

**Backend service status / logs (SSH in first):**

```bash
ssh -i ~/.ssh/evidenceos-api-key.pem ec2-user@18.196.98.199

sudo systemctl status evidenceos-api      # is it running, when did it last restart
sudo journalctl -u evidenceos-api -f      # live-tail its logs (Ctrl+C to stop)
sudo journalctl -u evidenceos-api -n 100  # last 100 log lines, no follow
```

**nginx status / logs (same SSH session):**

```bash
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

**Is the TLS certificate healthy?**

```bash
curl -vI https://18.196.98.199.sslip.io/health 2>&1 | grep -A2 "expire\|SSL certificate"
# or just check it hasn't renewed unexpectedly recently:
ssh -i ~/.ssh/evidenceos-api-key.pem ec2-user@18.196.98.199 "sudo systemctl status certbot-renew.timer"
```

**Frontend deployment status:**

```bash
cd apps/web
npx vercel ls                 # recent deployments and their status
npx vercel inspect --logs <deployment-url>   # full build log for one deployment
```

Or just check <https://vercel.com/nani8790s-projects/evidenceos-web/deployments>
in a browser.

---

## Common problems and what to check first

**"The frontend deployed but pages 500."**
Almost always an env var problem. Check Vercel's Runtime Logs for the
specific deployment (dashboard → the deployment → Logs). If it's a
`fetch failed` / `ECONNREFUSED` calling the API, confirm
`NEXT_PUBLIC_API_BASE_URL` is set correctly and the EC2 backend is
actually up (`curl` its `/health`).

**"The backend won't start after a redeploy" / `deploy.sh` prints
`activating` and stops with no further output.**
```bash
ssh -i ~/.ssh/evidenceos-api-key.pem ec2-user@18.196.98.199
sudo journalctl -u evidenceos-api -n 50
```
Most likely causes: a new dependency in `requirements.txt` that
`deploy.sh`'s `pip install` step failed on (check for errors in that
step's output), or a code error on import (missing env var the code now
requires, syntax error, etc.) — this exact scenario crash-looped the
service in `CHALLENGES.md` C9, where `journalctl` immediately showed the
real `pydantic` error (`Field required — document_encryption_key`).
`deploy.sh`'s health check now polls `/health` directly and dumps
`systemctl is-active` + the last 30 journal lines on failure instead of
aborting silently on a non-`active` state, so a fresh `./deploy.sh` run
should surface this itself — but if you're on an older checkout of the
script, or it still times out without a clear reason, run the two
commands above by hand.

**"Certbot renewal isn't working."**
Check for an orphaned `certbot` process holding the lock (see
`CHALLENGES.md` C3): `ps aux | grep certbot`, `kill -9` any that
shouldn't be there, retry.

**"A GitHub push isn't triggering a Vercel deploy."**
Check Settings → Git shows `veera-vsn/EvidenceOS` as connected (not
disconnected/expired). If a *new* repository ever needs connecting again,
remember GitHub's App permissions have to include it explicitly — see
`CHALLENGES.md` for the walkthrough.

**"I changed something and don't know if it actually deployed."**
Every Vercel deployment page shows the exact commit hash and branch it
built from (`Source` section) — cross-check against `git log` locally.
For the backend, there's no such record; `deploy.sh` doesn't tag or log
what it shipped. Worth git-tagging deploys by hand for now if this starts
mattering (`git tag deployed-backend-$(date +%Y%m%d) && git push --tags`).

---

## Quick reference

| Thing | Value |
|---|---|
| EC2 public IP | `18.196.98.199` |
| Backend URL | `https://18.196.98.199.sslip.io` |
| SSH | `ssh -i ~/.ssh/evidenceos-api-key.pem ec2-user@18.196.98.199` |
| Backend service name | `evidenceos-api` (systemd) |
| Backend code path on server | `/opt/evidenceos-api` |
| Backend env file on server | `/etc/evidenceos/api.env` |
| Frontend Preview URL (stable) | `https://evidenceos-web-git-claude-nani8790s-projects.vercel.app` |
| Frontend Production URL | `https://evidenceos-web.vercel.app` |
| Vercel project | `nani8790s-projects/evidenceos-web` |
| Redeploy backend | `cd apps/api && ./deploy.sh` |
| Redeploy frontend (Preview) | `git push origin claude` (automatic) |
| Redeploy frontend (Production) | `git push origin main` (automatic) |
