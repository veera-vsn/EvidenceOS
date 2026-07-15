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
| Frontend | `localhost:3000` | `evidenceos-web-git-claude-nani8790s-projects.vercel.app` (stable — same URL every deploy) | not deployed yet |
| Backend | `localhost:8010` | `https://18.196.98.199.sslip.io` | not deployed yet |
| Database | same Supabase project for all three — no environment separation yet | | |
| Deploys how | you run it | **frontend**: automatic on every push to `claude`. **backend**: manual, `apps/api/deploy.sh` | not set up |

That "same Supabase project for all three" is worth remembering: local
dev, the `claude` staging deploy, and (eventually) production all read
and write the *same* database today. There's no test/prod data
separation yet — a real document uploaded on staging is real data in the
same place your local dev environment sees.

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
git push origin claude
```

That's it. Vercel is connected to GitHub (`veera-vsn/EvidenceOS`,
Root Directory = `apps/web`) and auto-builds/deploys every push to
`claude` as a **Preview** deployment. Watch it build at
<https://vercel.com/nani8790s-projects/evidenceos-web/deployments>, or
just wait ~30-60s and hit the stable URL.

**Manual path (if you need a deploy without a git push — e.g. testing an
uncommitted change):**

```bash
cd apps/web
npx vercel deploy          # Preview
npx vercel deploy --prod   # Production — do NOT run this casually, see warning below
```

**⚠️ `main`/Production is untouched by design.** Environments →
Production tracks `main` specifically; `claude` (and any other branch)
falls under Preview automatically. Don't run `vercel deploy --prod` or
merge to `main` without deciding to do that on purpose.

**Environment variables** live in the Vercel dashboard (Settings →
Environment Variables), scoped to Preview only right now. To change one:

```bash
cd apps/web
npx vercel env rm NEXT_PUBLIC_API_BASE_URL preview
echo "https://new-value" | npx vercel env add NEXT_PUBLIC_API_BASE_URL preview
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
`/etc/evidenceos/api.env` on the server, not in the repo. Edit it
directly:

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

**"The backend won't start after a redeploy."**
```bash
ssh -i ~/.ssh/evidenceos-api-key.pem ec2-user@18.196.98.199
sudo journalctl -u evidenceos-api -n 50
```
Most likely causes: a new dependency in `requirements.txt` that
`deploy.sh`'s `pip install` step failed on (check for errors in that
step's output), or a code error on import (missing env var the code now
requires, syntax error, etc.).

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
| Vercel project | `nani8790s-projects/evidenceos-web` |
| Redeploy backend | `cd apps/api && ./deploy.sh` |
| Redeploy frontend | `git push origin claude` (automatic) |
