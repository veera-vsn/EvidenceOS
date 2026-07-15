# Phase 7 (Deployment) — concepts explained

A plain-language glossary of every piece of infrastructure touched while
deploying `apps/api` to AWS EC2, written for someone learning AWS/Linux
deployment for the first time. Read `01_aws_setup_log.md` first for the
narrative of *what we did in what order*; this doc is the reference for
*what each piece actually is and why it exists at all*.

---

## The big picture first

Before any of the individual pieces make sense, here's the shape of the
whole thing:

```
Browser (you)
    │  HTTPS
    ▼
Vercel (runs the Next.js app)
    │  HTTPS, server-to-server — the browser never sees this call
    ▼
nginx  (listens on the internet, port 443)
    │  plain HTTP, only reachable from inside the same machine (127.0.0.1)
    ▼
uvicorn / FastAPI  (your actual Python code, port 8000)
    │
    ▼
Supabase (the database, a separate managed service)
```

Two separate deploys (Vercel for the frontend, EC2 for the backend), and
on the EC2 box itself, **two separate processes** (nginx and uvicorn)
doing two different jobs. That split — a reverse proxy in front of your
actual app — is one of the most standard patterns in all of backend
deployment, and almost everything below exists to explain *why* that split
is worth the extra moving part.

---

## AWS / IAM concepts

**AWS account root user** — the "owner" login for the whole AWS account,
created when you first sign up. It has *no* permission boundary: it can
create/delete anything, including changing who else has access and how
much the account can spend. Because of that, the standard practice is to
almost never use it day-to-day.

**IAM (Identity and Access Management)** — AWS's system for creating
*other* logins ("IAM users") that have only the permissions you explicitly
grant them, instead of everyone sharing the all-powerful root login. This
is the same idea as not giving every employee at a company the master key
to the building — you give each person a key that opens only the doors
they need.

**IAM policy** — the actual document describing what an IAM user is
allowed to do (e.g. "can launch EC2 instances" but "cannot touch billing
or other services"). We attached `AmazonEC2FullAccess`, an AWS-maintained
policy scoped to EC2 only.

**MFA (Multi-Factor Authentication)** — requiring a second proof of
identity beyond a password (here, a 6-digit code from an authenticator
app that changes every 30 seconds). Enabled on the root account
specifically, since that's the single account where a password leak alone
would be catastrophic.

**Region** — AWS runs its infrastructure out of physically separate data
centre clusters around the world (Frankfurt, Ireland, N. Virginia, Tokyo,
...). Every resource you create (an EC2 instance, a security group) lives
in exactly one region. We used **eu-central-1** (Frankfurt) specifically
because that's where the project's Supabase database already runs, and
because DORA/GDPR both care about *where* EU customer data is physically
processed.

---

## The EC2 instance itself

**EC2 (Elastic Compute Cloud)** — AWS's "rent a computer" service. You
pick a size and an operating system, click launch, and a few seconds
later you have a real (virtual) machine with a public IP address that you
can SSH into, just like a physical server sitting in a data centre
somewhere — because that's essentially what it is, just shared/virtualised
hardware.

**AMI (Amazon Machine Image)** — the "operating system installer" for an
EC2 instance — a pre-built disk image AWS boots your instance from. We
used **Amazon Linux 2023**, AWS's own maintained Linux distribution.

**Instance type** (`t2.micro`/`t3.micro`) — how much CPU/RAM the virtual
machine gets. The "t" family is AWS's smallest, cheapest, burstable-CPU
tier — exactly what the free tier covers, and plenty for a low-traffic
API.

**Key pair** — EC2 instances don't log in with a password by default; they
use SSH public-key cryptography instead. When you "create a key pair," AWS
generates a matched pair of keys: the **public key** gets baked into the
instance at launch (AWS handles this automatically), and the **private
key** (the `.pem` file you downloaded) is the only thing that can prove
you're allowed to connect. This is *why* AWS only lets you download it
once — it never keeps a copy of your private key at all, by design.

**Public IPv4 address** — the address on the public internet that reaches
your instance, e.g. `18.196.98.199`. It's assigned when the instance
starts and stays the same as long as the instance keeps running
continuously — it only changes if you stop and restart the instance
(unless you pay for a static "Elastic IP," which we deliberately avoided
here to stay free).

---

## Networking / security

**Security group** — a firewall attached to your EC2 instance, made of
"inbound rules" (what's allowed to *reach* the instance) and "outbound
rules" (what the instance is allowed to *reach out to*, usually left open
by default). Every port is closed unless a rule explicitly opens it — the
opposite of "open everything, then lock down what's risky."

**Port** — think of the instance's IP address as a building's street
address, and each port as a specific numbered door into it. Different
doors are conventionally used for different purposes: 22 for SSH (remote
terminal access), 80 for plain-HTTP web traffic, 443 for encrypted
HTTPS web traffic. Our security group opens exactly these three and
nothing else.

**`/32`** — CIDR notation for "exactly one specific IP address, no
range." When we scoped the SSH rule to "My IP," AWS wrote it as
`<your-ip>/32` — as opposed to something like `0.0.0.0/0`, which means
"every possible IP address on the internet."

---

## Connecting: SSH

**SSH (Secure Shell)** — a protocol for getting a secure, encrypted remote
terminal on another computer over the network. `ssh -i keyfile.pem
ec2-user@<ip>` means: "connect to the machine at this IP, prove who I am
using this private key file, and give me a shell as the user `ec2-user`"
(the default admin username Amazon Linux images use).

**Why the key file needs locked-down permissions** — if any other user or
process on *your own* machine could read your private key file, they
could impersonate you to every server that trusts that key. SSH clients
(including Windows' OpenSSH) refuse to even use a key file that's readable
by more than its owner, specifically to force this good habit rather than
let it be a silent risk.

**`known_hosts`** — the first time you connect to a new server, SSH asks
you to confirm you trust it (you'll have seen a "Warning: Permanently
added ... to the list of known hosts" message) and remembers its
cryptographic fingerprint. This protects against a specific attack where
someone impersonates the server on a later connection — SSH will refuse
to connect and loudly warn you if the fingerprint ever changes
unexpectedly.

---

## The software stack on the box

**`dnf`** — Amazon Linux's package manager (the same role `apt` plays on
Ubuntu, or `npm` plays for Node packages) — a command for installing
pre-built software from AWS's repositories without manually downloading
and compiling anything.

**Python virtual environment (`venv`)** — an isolated folder containing
its own copy of Python and its own separate set of installed packages,
completely independent from the system's Python and from any other
project's venv on the same machine. Without this, two different Python
projects on the same server needing different versions of the same
library would conflict with each other. Both the app itself
(`/opt/evidenceos-api/.venv`) and Certbot (`/opt/certbot/`) each get their
own venv for exactly this reason.

**`pip`** — Python's package installer, the tool that actually reads
`requirements.txt` and downloads/installs each listed library into the
active venv.

**uvicorn** — the actual program that runs your FastAPI Python code and
turns it into something that can answer HTTP requests. FastAPI is a
*framework* (code you write against); uvicorn is the *server* that
executes it. This is the same relationship as, say, a web browser (the
engine that runs it) versus a website's HTML/JS (what it runs).

---

## systemd — keeping the app running

**systemd** — Linux's standard service manager: the thing responsible for
starting programs when the machine boots, restarting them if they crash,
and giving you commands (`systemctl start/stop/status`) to control them.
Without it, running `uvicorn ...` directly in an SSH session would mean
the app dies the moment you disconnect, and never restarts itself if it
crashes at 3am.

**Unit file** (`evidenceos-api.service`) — a small config file telling
systemd about one specific program to manage: what command starts it
(`ExecStart`), which user it should run as (`User=ec2-user` — deliberately
*not* root, so a bug in the app can't do root-level damage to the whole
machine), and what to do if it crashes (`Restart=on-failure`).

**`EnvironmentFile`** — a systemd directive that loads a file of
`KEY=value` lines as environment variables for the process it's about to
start, before it starts it. This is how the app gets its secrets (Supabase
keys, OpenAI key, etc.) without those secrets being written into the unit
file itself or the app's code directory.

**Enabling vs. starting a service** — `systemctl start` runs it *right
now*; `systemctl enable` additionally tells systemd to start it
automatically every time the machine reboots. `enable --now` does both at
once — which is what we want for something meant to be a permanent
background service, not a one-off command.

---

## nginx — the reverse proxy

**nginx** — a very fast, battle-tested web server, used here specifically
as a **reverse proxy**: something that sits in front of your actual
application, receives the real internet traffic, and forwards
("proxies") it inward to the app running privately behind it.

**Why not just let uvicorn face the internet directly?** You technically
could (`uvicorn ... --host 0.0.0.0`), but nginx in front of it buys you
several things uvicorn isn't designed to handle well on its own:
- **TLS/HTTPS termination** — nginx (with Certbot's help) handles all the
  encryption/certificate complexity in one well-tested place, so your
  Python code never has to think about it.
- A battle-tested layer absorbing malformed requests, slow clients, and
  basic abuse patterns before they ever reach your application code.
- The ability to add more services behind the same box later (another
  app, a static file server) without changing how the outside world
  reaches you.

In our config, nginx listens on 443 (HTTPS, the public-facing side) and
forwards every request to `127.0.0.1:8000` — the `127.0.0.1` (aka
"localhost") address means "only reachable from this same machine,"
so uvicorn is never directly exposed to the internet at all, only nginx
is.

**`proxy_pass` / `proxy_set_header`** — the actual nginx config lines that
do the forwarding, and that also forward along useful information the
backend wouldn't otherwise know (like the visitor's real IP address,
since from uvicorn's point of view every request now technically "comes
from" nginx on the same machine).

---

## TLS/HTTPS and Certbot

**TLS (Transport Layer Security)** — the encryption protocol that makes
`https://` connections private and tamper-proof between browser and
server (the "S" in HTTPS, technically the successor to the older "SSL").
Without it, anything sent over the connection — including login sessions
and the document data this app handles — could be read or altered by
anyone on the network path in between.

**Certificate** — a small signed file that proves "this server really is
who it claims to be" for a specific hostname, issued by a trusted
**Certificate Authority (CA)**. Browsers ship with a built-in list of CAs
they trust; if a certificate wasn't signed by one of them, the browser
shows a scary warning instead of connecting quietly.

**Let's Encrypt** — a free, automated Certificate Authority. Before it
existed (pre-2016), getting a trusted certificate cost real money and
required manual steps; Let's Encrypt made it free and scriptable, which is
a large part of why HTTPS is now the default across the whole web instead
of the exception.

**Certbot** — the standard command-line tool for talking to Let's
Encrypt: proving you control a given hostname, requesting the certificate,
and (with the `--nginx` flag we used) automatically editing nginx's config
to install it and set up an HTTP→HTTPS redirect.

**HTTP-01 challenge** — the specific way Certbot proves domain control:
Let's Encrypt asks it to make a specific file briefly available at a
specific URL on port 80, then Let's Encrypt itself fetches that URL from
the public internet to confirm the server answering really controls that
hostname. This is exactly why port 80 had to stay open in the security
group, even though we redirect everything to 443 afterwards — Certbot
needs it for this handshake, and for renewals later.

**Certificate expiry and renewal** — Let's Encrypt certificates are
deliberately short-lived (90 days), to limit the damage if one is ever
compromised and to keep the renewal process well-exercised rather than a
rare, rusty, once-a-year event. Renewal has to happen before expiry or the
site starts showing "insecure" warnings — which is why we set up the
`certbot-renew.timer` to check twice a day automatically rather than
relying on remembering to do it by hand.

**`sslip.io`** — a free public DNS service with a clever trick: it answers
*any* hostname of the form `<some-ip>.sslip.io` by resolving it straight
to `<some-ip>`. We needed this because Let's Encrypt can only issue a
certificate for a real hostname, never a bare IP address — `sslip.io`
gave us a legitimate, resolvable hostname (`18.196.98.199.sslip.io`) for
free, with zero registration, standing in for a real domain until this
project has one.

---

## Deployment mechanics

**`tar`** — a Linux tool for bundling a folder of files into one archive
(the name is short for "tape archive," from the era of literal magnetic
tape backups). Piped through `ssh`, `tar czf - . | ssh ... "tar xzf -"`
streams a whole folder to a remote machine and unpacks it there in one
step, without ever writing an intermediate `.tar.gz` file to disk on
either end.

**Why we didn't `git clone` on the server** — cloning would require
putting some form of GitHub credential (a personal access token, or an SSH
deploy key) onto the EC2 box just to fetch the code once. Copying the
already-checked-out folder directly needed no new credential at all, at
the cost of it being a one-time copy rather than a live repo you can `git
pull` on — a real tradeoff, reasonable for a first deploy, worth revisiting
if deploys start happening often.

---

## The frontend side: Vercel

**Vercel** — a hosting platform built specifically around Next.js (made by
the same company that builds Next.js). Unlike EC2, you don't manage a
server at all — you push code, and Vercel handles build, deploy, TLS,
and global distribution automatically.

**Preview vs. Production deployment** — Vercel treats one branch
(commonly `main`) as "Production," and every other branch or manual
deploy as a "Preview" — a fully working, separately-URLed copy of the app
for testing, that doesn't affect whatever's live at your main production
URL. We deliberately used a Preview deployment for the `claude` branch,
keeping Production untouched until there's a deliberate decision to
promote something there.

**Environment variables scoped by environment** — Vercel lets you set a
variable's value differently (or not at all) per Production/Preview/
Development. We scoped ours to Preview only, matching the
Preview-only deployment we actually did.

**`NEXT_PUBLIC_` prefix** — a Next.js convention: any environment variable
named with this prefix gets bundled into the JavaScript sent to the
browser, meaning it's visible to anyone who opens your site and looks.
Every other variable name stays server-only, invisible to visitors. This
is why the Supabase *anon* key (meant to be public — Supabase's Row-Level
Security is what actually protects data, not secrecy of this key) uses
the prefix, while the Supabase *service role* key (a true secret, used
only in the EC2 backend, never in the web app at all) never would.

---

## Why the pieces fit together this way

Zoom back out: the reason this whole shape — Vercel talking to nginx
talking to uvicorn, rather than something simpler — exists is that each
layer does one job well and stays replaceable on its own:

- Swap EC2 for Fly.io/Cloud Run later? Only the DNS/CORS config on the
  frontend side changes.
- Get a real domain later instead of `sslip.io`? Only nginx's
  `server_name` and Certbot's `-d` flag change.
- App needs to scale beyond one box? nginx's job (TLS, routing) stays
  the same even if what's "behind" it becomes several app instances
  instead of one.

None of that flexibility was needed *today* — but it's what "boring,
standard architecture" buys you for free, which is exactly why it's the
standard.
