"""Application-layer encryption for document content.

Supabase already encrypts data at rest at the disk level. This module adds a
second, independent layer on top for the two columns that hold raw customer
document content -- `document_text.content` and
`extraction_results.extracted_value` -- so that anyone who obtains raw
database read access without also compromising this application's
encryption key sees ciphertext, not contract text.

Design: AES-256-GCM (authenticated encryption) with a single shared key
loaded from `DOCUMENT_ENCRYPTION_KEY`. The same key and wire format
(version-prefixed base64 of nonce || ciphertext || tag) are used by the
frontend's decrypt-only counterpart in
`apps/web/src/lib/crypto/document-encryption.ts` -- the review and pipeline
pages read `extraction_results.extracted_value` directly from Supabase and
must decrypt it themselves rather than going through this backend.

Known trade-off, documented rather than hidden: this is a shared
application secret, not KMS-brokered envelope encryption -- anyone who
compromises the app's own environment gets the key along with it. It still
raises the bar against the more common threat at this stage (DB-only
access via a leaked read-only credential or a misconfigured RLS policy)
without the operational overhead of standing up a KMS integration for a
pre-revenue product. Migrating to per-value data keys wrapped by a KMS
master key is a natural hardening step once a paying customer's security
review asks for it -- see
Project_Docs/Learnings/Phase_12_Encryption/CHALLENGES.md.
"""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import get_settings

_PREFIX = "enc:v1:"
_NONCE_LEN = 12  # 96-bit nonce, the size AES-GCM is designed for.


def _get_aesgcm() -> AESGCM:
    settings = get_settings()
    if not settings.document_encryption_key:
        raise RuntimeError(
            "DOCUMENT_ENCRYPTION_KEY is not configured. Add it to apps/api/.env "
            '-- generate one with: python -c "import secrets,base64; '
            'print(base64.b64encode(secrets.token_bytes(32)).decode())"'
        )
    key = base64.b64decode(settings.document_encryption_key)
    if len(key) != 32:
        raise RuntimeError(
            "DOCUMENT_ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits)."
        )
    return AESGCM(key)


def encrypt_text(plaintext: str | None) -> str | None:
    """Encrypt *plaintext* for storage. `None` passes through unchanged --
    extraction fields the model didn't find have no value to protect."""
    if plaintext is None:
        return None
    aesgcm = _get_aesgcm()
    nonce = os.urandom(_NONCE_LEN)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return _PREFIX + base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_text(value: str | None) -> str | None:
    """Decrypt a value written by `encrypt_text()`.

    Values without the version prefix are historical rows written before
    this module existed -- returned unchanged rather than raising, so old
    documents stay readable until their pipeline re-runs and re-encrypts
    them. See Phase_9_Full_RoI_Stage1/CHALLENGES.md C5 for the precedent:
    this project already treats "old rows in a new shape" as expected
    behaviour to handle gracefully, not an error state.
    """
    if value is None:
        return None
    if not value.startswith(_PREFIX):
        return value
    aesgcm = _get_aesgcm()
    raw = base64.b64decode(value[len(_PREFIX) :])
    nonce, ciphertext = raw[:_NONCE_LEN], raw[_NONCE_LEN:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")
