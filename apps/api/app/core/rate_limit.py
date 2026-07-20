"""Rate limiting for cost-sensitive endpoints.

2026-07-18 production audit finding (API A2): /pipeline/runs/{id}/trigger
kicks off real, billed OpenAI extraction with no throttle of any kind.
The 2026-07-19 internal-auth fix (see internal_auth.py) closed the
"anyone on the internet can call this" hole, which was the primary risk
-- but a shared secret is still one leaked value away from the same
exposure, and a buggy retry loop in our own frontend is a real,
mundane failure mode a rate limit catches cheaply. Defense-in-depth,
not a replacement for the auth fix.

Uses the default `get_remote_address` key function (source IP). Every
legitimate caller today is this project's own Next.js server calling
through nginx, not an arbitrary browser, so this behaves closer to a
single global throttle on the endpoint than a per-end-user quota --
that's an acceptable, even simpler, fit for the current threat model
(bound a runaway loop or leaked-secret scenario), not an attempt at
fine-grained per-tenant fairness.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
