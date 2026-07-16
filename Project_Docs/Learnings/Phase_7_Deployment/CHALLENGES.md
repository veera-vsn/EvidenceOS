# Phase 7 (Deployment) — Challenges

Every real bump hit while deploying, in the order encountered. Root cause,
fix, and the lesson worth remembering — matching the format every earlier
phase's `CHALLENGES.md` uses.

---

## C1 — Fly.io/Railway no longer had real free tiers

**Symptom:** the project's own `00_STACK_DECISIONS.md` picked Fly.io
(fallback: Railway) for backend hosting. Both have since dropped their
meaningful free tiers.

**Root cause:** stack decisions age. A doc written at one point in time
records the best choice *then*, not a permanent fact.

**Fix:** switched to AWS EC2's free tier instead (free for the account's
first 12 months), after explicitly discussing the tradeoff with the user —
more manual setup (nginx/systemd/Certbot by hand) in exchange for genuinely
free hosting.

**Lesson:** "the docs already decided this" is a good default, but still
worth a quick sanity check against current reality before committing real
time to it — especially for anything involving a third party's pricing.

---

## C2 — Assumed the wrong Langfuse hostname for EU compliance

**Symptom:** flagged the dev environment's `LANGFUSE_HOST=https://cloud.langfuse.com`
as a DORA/GDPR data-residency violation, assuming `cloud.langfuse.com` was
the generic/US-default and that `eu.cloud.langfuse.com` was the correct
EU-specific hostname. Had the user create a whole new Langfuse project
chasing this.

**Root cause:** the assumption was simply wrong, and wasn't checked against
a source before being acted on. Per Langfuse's own docs, it's the
opposite: **`cloud.langfuse.com` *is* the EU region**; `us.cloud.langfuse.com`
is the separate one for the US. There is no `eu.` subdomain at all — it
silently redirects back to the same EU-hosted `cloud.langfuse.com`, which
is exactly the behaviour that made the mistake look plausible instead of
obviously wrong.

**Fix:** checked Langfuse's actual documentation once the redirect
behaviour looked suspicious, found the real mapping, corrected course, and
told the user directly rather than quietly using the wrong host anyway.
The original dev config turned out to already be compliant — no actual
bug existed, only a wasted detour and the user's time creating an
unnecessary second project.

**Lesson:** a hostname pattern "looking right" (`eu.` prefix = EU, surely?)
is not the same as it *being* right. For anything with real compliance
weight, verify against the vendor's actual docs *before* asking the user
to act on the belief, not after.

---

## C3 — Interrupted SSH commands left orphaned `certbot` processes holding a lock

**Symptom:** `certbot renew --dry-run`, wrapped in a client-side `timeout`
or cut off by a tool call boundary, would leave a `certbot` process still
running *on the EC2 box* even though the local command had already
returned. The next attempt to run certbot then failed immediately with
"Another instance of Certbot is already running," with no obvious
explanation from that error message alone.

**Root cause:** killing the local `ssh` client (via a timeout, or the
connection simply ending) doesn't reliably send a termination signal to
whatever command was running on the *far end* of that SSH session — the
remote process can just keep going, orphaned, still holding certbot's
lock file.

**Fix:** `ps aux | grep certbot` on the box to find the orphaned PID(s),
`kill -9` them, then retry the command cleanly without a client-side
timeout wrapper this time.

**Lesson:** for any remote command expected to run for a while, either let
it run to completion without an aggressive local timeout, or be prepared
to go clean up a possibly-still-running remote process afterwards.

---

## C4 — A brand-new Vercel project's first deploy always targets Production

**Symptom:** the very first `vercel deploy` for the newly-created project
came back with `"target": "production"` and failed with a missing
`NEXT_PUBLIC_SUPABASE_URL` error, even though the plan was explicitly to
deploy a **Preview** (the env vars had deliberately been scoped to Preview
only, to avoid touching Production).

**Root cause:** Vercel bootstraps a brand-new project by making its first
ever deployment Production, regardless of the branch or any flags passed —
there's no Production deployment to compare against yet, so it has to
start somewhere.

**Fix:** once *any* deployment existed for the project (even that failed
one), the next `vercel deploy` correctly defaulted to a Preview
deployment and picked up the right environment variables.

**Lesson:** don't assume a deploy's target matches your intent just
because you didn't pass `--prod` — check the actual response. This one
was self-correcting on retry, but it could just as easily have shipped
something to Production unintentionally on a project where "first deploy"
happens to matter.

---

## C5 — `.pem` key file permissions on Windows

**Not a bug exactly, but a real first-time-AWS-on-Windows snag worth
recording:** SSH refuses to use a private key file with overly permissive
read access — a Linux/Mac user would just `chmod 400 key.pem`, but Windows
has no `chmod`. The equivalent is Windows ACLs: disable inheritance on the
file, then explicitly grant only the current user read access
(`icacls key.pem /inheritance:r` then `icacls key.pem /grant:r "$USER:(R)"`).
Skipping this step produces an "unprotected private key file" error the
first time you try to connect.

---

## C6 — GitHub-connected builds failed: "No Next.js version detected"

**Symptom:** after connecting the Vercel project to GitHub (so pushes to
`claude` auto-deploy), the first real push-triggered build failed
immediately: `Error: No Next.js version detected. Make sure your
package.json has "next" in either "dependencies" or "devDependencies".`
— even though `apps/web/package.json` clearly has it.

**Root cause:** the project's **Root Directory** setting was empty/unset.
Earlier CLI deploys (`vercel deploy`) never hit this, because I ran that
command *from inside* `apps/web` locally, so Vercel only ever saw that
folder. A GitHub-triggered build instead clones the **whole monorepo**
from its root — with no Root Directory set, it looked for a Next.js
`package.json` at the repo root (`EvidenceOS/`), found the wrong one (or
none), and failed.

**Fix:** Project Settings → Build and Deployment → Root Directory →
set to `apps/web`, save, then re-trigger the failed deployment ("Redeploy"
from the deployment's action menu). Confirmed fixed: same commit, same
branch, second attempt built and deployed successfully.

**Lesson:** a CLI deploy run from inside a subdirectory and a
GitHub-integration deploy are not equivalent, even against the same
Vercel project — the former "just works" because your shell's working
directory silently supplies the context that the latter needs an explicit
setting for. Worth setting Root Directory proactively for any monorepo
project, rather than waiting for the first git-triggered build to fail.

## C7 — Production env vars didn't exist at all, so the first real production deploy failed the same way the first Preview deploy did

**Symptom:** the user merged `claude` into `main` directly on GitHub
(their own action). Vercel correctly auto-triggered a **Production**
build (Production tracks `main`) — and it failed with the exact same
`Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL` error
as C4, the very first Preview deploy.

**Root cause:** environment variables were only ever added scoped to
`preview` (`vercel env add ... preview`), deliberately, back when the
plan was "stay on `claude`, don't touch `main`." Once the user made the
independent decision to merge to `main`, nothing had ever populated the
`production` scope — Preview and Production don't share values on
Vercel, they're entirely separate variable sets even within the same
project.

**Fix:** added the same four `NEXT_PUBLIC_*` variables again, this time
scoped to `production` (`vercel env add ... production`), then
redeployed. Also updated the EC2 backend's `CORS_ORIGINS` to include the
new production URL (`https://evidenceos-web.vercel.app`) alongside the
existing staging one.

**Lesson:** "add the env var" is not a one-time action for a multi-environment
project — it's per-environment, and the failure mode for forgetting one
is silent until something actually deploys to that environment. Setting
Preview and Production env vars together at initial setup (even if
Production isn't "supposed" to be used yet) would have caught this
before a real production build failed on it.

## C8 — CLI deploys broke after setting Root Directory: doubled path

**Symptom:** after fixing C6 by setting the project's Root Directory to
`apps/web`, a later `vercel deploy --prod` run from inside `apps/web`
failed instantly: `Error: The provided path
"~\Desktop\DORA_SAAS\EvidenceOS\apps\web\apps\web" does not exist.`

**Root cause:** the CLI combines the Root Directory *project setting*
with wherever it's actually being run from. Earlier CLI deploys worked
specifically because they were run from `apps/web` *before* Root
Directory was set — at that point the setting didn't exist yet, so
there was nothing to double up. Once Root Directory = `apps/web` was
saved (needed for GitHub-triggered builds, see C6), the same "run it from
inside `apps/web`" habit now appends `apps/web` a second time.

**Fix:** copy `apps/web/.vercel/project.json` to a new `.vercel/` folder
at the repo root (already gitignored there, matching `apps/web`'s own
`.gitignore` entry), then run `vercel deploy` commands from the repo
root instead of from `apps/web`.

**Lesson:** a Vercel CLI workflow that "just works" can silently depend
on exactly where you happen to run it from and exactly what project
settings exist at that moment — the same command sequence produced two
different, both-explainable-in-hindsight behaviours purely because a
project setting changed in between. Worth re-testing your normal deploy
command after any change to Root Directory / Build settings, not
assuming it still works the same way.

## What went right without incident

Worth naming, not just the bumps: Python 3.13 was directly available via
Amazon Linux 2023's own package repos (no compiling from source needed),
Certbot's `--nginx` flag correctly auto-configured the HTTPS server block
and redirect in one command, and the full Vercel → EC2 → Vercel → browser
round trip for the Export download worked on the very first successful
attempt once CORS and the environment variables were correctly wired up.
