# Phase 7 (Deployment) — AWS setup log

A running log of every AWS decision made while deploying `apps/api` to EC2,
written as we go since this is also a first-time AWS learning exercise, not
just a deployment. Each section explains what we did and **why**, in the
order we actually did it. See `Project_Docs/Learnings/00_STACK_DECISIONS.md`
§8 for the original (pre-deploy) hosting decision, and the plan referenced
in this session for the full deployment scope.

## Why AWS EC2, and why this deploy differs from the original plan

`00_STACK_DECISIONS.md` originally picked Fly.io/Railway for the backend.
Both dropped their meaningful free tiers after that doc was written, so
this deploy uses **AWS EC2's free tier** instead — 750 hours/month of a
`t2.micro`/`t3.micro` instance, free for the account's first 12 months.
The tradeoff versus Fly.io: EC2 is a raw VM, not a managed platform, so we
own nginx, systemd, and TLS certificates ourselves instead of a `git push`
deploy. That's the real cost of "free" here — more moving parts to
understand and maintain, which is also why this is a good learning
exercise.

## 1. Root account: MFA

Enabled multi-factor authentication on the AWS **root** account
(IAM → Security credentials → Assign MFA device, authenticator app).

**Why:** the root account has no permission boundary — it can do anything,
including changing billing, deleting the whole account, or granting itself
any IAM permission. It's the single highest-value target if credentials
ever leak. MFA is the standard first mitigation, and AWS's own
recommendation is to do this *before* creating anything else.

**Interview Q: "Why not just use root for everything, it's simpler?"**
**A:** Because "simpler" here means "no permission boundary and no audit
trail of who did what." A compromised root credential is a compromised
AWS bill and every resource in the account. A compromised IAM user
credential is contained to whatever that user's policy allows.

## 2. IAM user for actual work

Created an IAM user (`evidenceos-deploy`) instead of doing EC2 work as
root:
- Console access enabled (custom password).
- Permissions: AWS managed policy **`AmazonEC2FullAccess`** attached
  directly (not a custom policy).

**Why a managed policy instead of a hand-scoped one:** a true least-privilege
policy would enumerate exact actions (`ec2:RunInstances`,
`ec2:AuthorizeSecurityGroupIngress`, etc.). `AmazonEC2FullAccess` is
broader than that, but it's still fully scoped to EC2 — this user cannot
touch IAM, billing, S3, or any other service, which is the property that
actually matters for blast-radius reduction. Tightening this to a custom
policy is a reasonable later exercise once we know exactly which EC2
actions we use day-to-day.

**Why console access with a password, not access keys:** we're doing this
deploy by hand through the AWS Console (matching how we're learning it),
not scripting it with the AWS CLI. Access keys are a separate credential
type for programmatic/CLI access — only needed if we later automate this
with `aws` CLI or Terraform.

All subsequent AWS work happens signed in as this IAM user, not root.

## 3. Region: eu-central-1 (Frankfurt)

Every resource (the EC2 instance, its security group) is created in
**eu-central-1**, not the account's default region.

**Why:** this matches the region our Supabase project already runs in.
Two reasons that matters: lower network latency between the API and the
database it talks to constantly, and — more importantly for this
product specifically — it's the concrete, checkable answer to "where is
EU customer data processed," which is what DORA/GDPR data-residency
actually requires (see `CLAUDE.md` §7: "All persistent data ... must sit
in EU regions"). Compute isn't "persistent data" in the strict sense, but
keeping it in the same region as the data it processes is the safe,
consistent default rather than something to re-litigate later.

## 4. EC2 instance: `evidenceos-api`

Launched via EC2 → Launch instance:
- **AMI:** Amazon Linux 2023 (free-tier eligible).
- **Instance type:** t2.micro/t3.micro (free-tier eligible — AWS's console
  flags which one is eligible for this account).
- **Key pair:** `evidenceos-api-key`, RSA, `.pem` format, downloaded once
  (AWS never lets you re-download a private key — lost means create a new
  key pair and re-associate, or use EC2 Instance Connect as a fallback).
- **Storage:** default 8 GiB gp3 (well under the 30 GiB free-tier
  allowance).

**Why Amazon Linux 2023 over Ubuntu:** either would work fine here: this
is a personal preference for a first EC2 box since it's AWS's own
maintained AMI (fast security patches, tuned for EC2) and its package
manager (`dnf`) is what we'll use for nginx/certbot/Python installs.
Ubuntu is equally valid — the systemd/nginx/certbot steps later are
nearly identical either way.

## 5. Security group: `evidenceos-api-sg`

Three inbound rules, each scoped to exactly what needs it:

| Port | Source | Why |
|---|---|---|
| 22 (SSH) | **My IP** only (a `/32`, auto-filled by the console) | This is a shell on the box. Left open to `0.0.0.0/0`, every internet-wide SSH-scanning bot finds it and starts brute-forcing. Scoping to one IP means only this machine can even attempt a connection. |
| 80 (HTTP) | `0.0.0.0/0` (anywhere) | Certbot's HTTP-01 challenge needs to be reachable from the public internet to prove we control the host, and nginx will redirect plain HTTP to HTTPS here too. |
| 443 (HTTPS) | `0.0.0.0/0` (anywhere) | The actual API traffic path — Vercel's servers calling this box. |

**Interview Q: "Why not just open all ports and lock it down later?"**
**A:** Because "later" is exactly the window where an internet-wide port
scanner finds an open box before anyone gets around to closing it.
Security groups default-deny everything not explicitly listed, so scoping
rules at creation time costs nothing extra and removes an entire class of
"we'll fix it later" risk.

## 6. SSH access and key hygiene

Connected as `ec2-user@<public-ip>` using the downloaded `.pem` key,
relocated from its original download location into `~/.ssh/` with
inheritance disabled and read access restricted to the owning account only
(Windows OpenSSH refuses to use a key with looser permissions than that —
same idea as `chmod 400` on Linux/Mac).

## 7. Software install: Python 3.13, nginx, Certbot

Amazon Linux 2023's own `dnf` repos carry `python3.13` directly (checked
with `dnf list available 'python3.1*'` first) — no compiling from source
needed, and it matches the `.python-version` pin from step 1 above exactly.
Installed `python3.13`, `nginx`, and `git` via `dnf`.

**Certbot via an isolated pip venv (`/opt/certbot/`), not `dnf install
certbot`:** this is Certbot's own officially recommended install method —
it keeps Certbot's dependencies (which can be version-sensitive) separate
from the system Python and every other package on the box. Symlinked
`/opt/certbot/bin/certbot` to `/usr/bin/certbot` so it's on `$PATH`
normally.

## 8. Deploying the app: tar over SSH, not `git clone`

Copied `apps/api` to `/opt/evidenceos-api/` with `tar` piped through `ssh`
(excluding `.venv`, `__pycache__`, and — critically — `.env`/`.env.local`),
rather than cloning the GitHub repo on the box.

**Why not `git clone`:** cloning would mean putting either a GitHub PAT or
an SSH deploy key on the server just to fetch code once. The `tar`-over-SSH
approach reuses the SSH access we already have for admin work and needs no
extra GitHub credential to exist on the box at all. The tradeoff: this is a
one-shot copy, not a repo — redeploying a new version means re-running the
same tar/ssh command, not `git pull`. Fine for a first deploy; worth
revisiting (`git clone` with a deploy key, or real CI/CD) once deploys
happen often enough that this manual step gets annoying.

Created the venv with `python3.13 -m venv .venv` inside `/opt/evidenceos-api/`
and installed from `requirements.txt` — the same lockfile dev uses, so the
exact same dependency versions run in both places.

## 9. Environment variables: systemd `EnvironmentFile`, not a `.env` file the app reads itself

Wrote production secrets to `/etc/evidenceos/api.env`, permissions locked
to `600 root:root` (unreadable by `ec2-user` or anything else except via
`sudo`), and referenced it from the systemd unit via
`EnvironmentFile=/etc/evidenceos/api.env`.

**Why this instead of an `.env` file next to the code:** systemd reads the
file as root (PID 1) *before* dropping to the unprivileged `User=ec2-user`
that actually runs uvicorn — so the secrets on disk are protected by
filesystem permissions the app process itself can't even read directly,
they only ever exist in that one process's environment once it's running.
This also keeps the file out of `/opt/evidenceos-api/` entirely, so a
future `tar`-redeploy (step 8) can never accidentally overwrite or expose
it.

**A real mistake caught here:** the Langfuse host value initially looked
non-EU (`https://cloud.langfuse.com` "looked like" the generic/US default
compared to a guessed `eu.cloud.langfuse.com`). Checked Langfuse's actual
docs before shipping this belief into production config: **the bare
`cloud.langfuse.com` domain *is* the EU region** — there is no separate
`eu.` subdomain, and `us.cloud.langfuse.com` is the one that's actually
different. The original dev value was already correct. Worth documenting
because it's the kind of plausible-sounding wrong assumption that's easy
to ship without checking the source.

## 10. nginx reverse proxy + Certbot TLS via sslip.io

nginx listens on 80 and proxies to `127.0.0.1:8000` (where uvicorn only
binds — never directly exposed to the internet). Server name:
`<public-ip>.sslip.io`.

**Why `sslip.io` instead of a real domain:** Let's Encrypt needs a
resolvable hostname to issue a certificate against — it can't issue one
for a bare IP address. `sslip.io` is a free wildcard DNS service that
resolves `<any-ip>.sslip.io` straight to `<any-ip>` with no registration
needed, which is exactly enough hostname for Certbot's HTTP-01 challenge
to work without buying a domain for what's currently a staging deploy.

Ran `certbot --nginx -d <ip>.sslip.io --redirect`, which both obtained the
certificate *and* rewrote the nginx config to add the HTTPS server block
and an HTTP→HTTPS redirect automatically.

**Auto-renewal:** Let's Encrypt certs are valid 90 days. The `dnf`-packaged
Certbot ships a renewal timer automatically; the pip-venv install (step 7)
does not, so one was created by hand — a `certbot-renew.service` (runs
`certbot renew --quiet` with an nginx-reload deploy hook) plus a
`certbot-renew.timer` firing twice daily. `certbot renew` itself is a
no-op unless a cert is within 30 days of expiring, so firing it twice a
day is the standard, cheap way to never miss a renewal window without
manual tracking.

**A real operational snag:** every time an SSH command running `certbot`
got interrupted client-side (a local `timeout` wrapper, or the tool's own
call boundary), the remote `certbot` process kept running on the box and
held its lock file, so the *next* certbot invocation failed with "Another
instance of Certbot is already running" even though nothing was visibly
wrong. Fix each time: `ps aux | grep certbot` on the box, `kill -9` the
orphaned PID, retry. Lesson: don't wrap long-running remote commands in an
aggressive client-side timeout if the remote side doesn't get a clean
signal to stop too.

## Result

`https://<public-ip>.sslip.io/health` → `200 {"status":"ok","env":"production",...}`,
confirmed reachable from an outside machine, not just `localhost` on the
box itself.

## 11. Frontend: Vercel

Linked `apps/web` to a new Vercel project (`vercel link`), added the four
`NEXT_PUBLIC_*` env vars scoped to the **Preview** environment only (not
Production — deliberately, since this deploy stays on the `claude` branch
per the plan, `main` is untouched), then deployed.

**A real bug this surfaced:** the very first deploy for a brand-new Vercel
project always targets **Production**, regardless of intent — Vercel's
bootstrap behaviour for a project with no deployments yet. Since only
Preview-scoped env vars existed, that first build failed at
`NEXT_PUBLIC_SUPABASE_URL` (missing). Once *a* deployment existed
(even a failed one), the next `vercel deploy` correctly defaulted to
Preview and picked up the right env vars. Lesson: don't assume the first
deploy's `target` field reflects your actual intent — check it.

Tried connecting the Vercel project to the GitHub repo (`vercel git
connect`) for automatic deploy-on-push — failed, because that requires
installing Vercel's GitHub App on the repo, which is a one-time OAuth
consent step only doable by hand in a browser, not via CLI. Left as an
optional manual follow-up; the CLI-deployed Preview URL is fully live
without it, it just means redeploys need `vercel deploy` run by hand
rather than happening automatically on `git push`.

## 12. Connecting the two: CORS

Backend's `CORS_ORIGINS` env var, originally just `localhost:3000` for
local dev, updated to include the live Vercel Preview URL, then
`systemctl restart evidenceos-api` to pick it up.

**Why this barely matters here, but is still correct to do:** every actual
call from the web app to the API happens **server-to-server** — Next.js's
own server calling the EC2 box directly, never the visitor's browser (see
`export/download/route.ts`). CORS only governs *browser*-initiated
cross-origin requests, so a real security gap here would only exist if
some future code accidentally added a client-side `fetch` straight to the
API. Confirmed this is still true post-deploy: `read_network_requests` on
the live Vercel page showed zero requests to the EC2 host at all.

## Result: full verification

Signed in on the live Vercel URL, real Supabase data loaded correctly
(workspace list, documents, review queue — identical to local dev).
Exercised the full golden path: Documents → Pipeline → Review detail →
Export → **Download**, the exact round trip that broke earlier this
session from a local port mismatch. On the real deployment: `fetch` to
`/dashboard/googleads/export/download` → `200`, `application/zip`, and the
five expected files inside
(`RT_01_01_contractual_arrangements.csv`,
`RT_02_01_ict_third-party_providers.csv`,
`RT_03_01_outsourced_functions.csv`, `evidence_audit_trail.csv`,
`disclaimer_manifest.txt`) — Vercel really did call the EC2 box over
HTTPS, get a real zip back, and serve it to the browser.

**First deployment complete.** See `02_concepts_explained.md` for a plain-
language glossary of every AWS/Linux term used above, and
`CHALLENGES.md` for the bugs hit along the way and what they taught.
