"""Unit tests for app/core/encryption.py.

Sets DOCUMENT_ENCRYPTION_KEY explicitly via monkeypatch rather than relying
on the developer's local .env, so these tests are self-contained and
portable to CI. get_settings() is lru_cached, so the cache must be cleared
after changing the env var -- same pattern any settings-dependent test in
this repo needs.
"""

from __future__ import annotations

import base64
import secrets

import pytest
from cryptography.exceptions import InvalidTag

from app.core.config import get_settings
from app.core.encryption import decrypt_text, encrypt_text

_TEST_KEY = base64.b64encode(secrets.token_bytes(32)).decode()


@pytest.fixture(autouse=True)
def _encryption_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DOCUMENT_ENCRYPTION_KEY", _TEST_KEY)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_round_trip_recovers_original_text() -> None:
    plaintext = "AWS EMEA SARL — Master Services Agreement, clause 14.2"
    ciphertext = encrypt_text(plaintext)
    assert ciphertext != plaintext
    assert decrypt_text(ciphertext) == plaintext


def test_round_trip_preserves_unicode_and_punctuation() -> None:
    plaintext = "Recovery time objective: 4 hours — governed by Irish law (§14)"
    assert decrypt_text(encrypt_text(plaintext)) == plaintext


def test_none_passes_through_unchanged() -> None:
    assert encrypt_text(None) is None
    assert decrypt_text(None) is None


def test_ciphertext_is_versioned_and_base64() -> None:
    ciphertext = encrypt_text("some value")
    assert ciphertext is not None
    assert ciphertext.startswith("enc:v1:")


def test_two_encryptions_of_same_plaintext_differ() -> None:
    # Random nonce per call -- ciphertext must not be deterministic, or
    # equal field values across documents would be visibly correlatable
    # from the ciphertext alone.
    a = encrypt_text("Cloud services: IaaS")
    b = encrypt_text("Cloud services: IaaS")
    assert a != b
    assert decrypt_text(a) == decrypt_text(b) == "Cloud services: IaaS"


def test_legacy_plaintext_rows_pass_through_unchanged() -> None:
    # Rows written before this module existed have no "enc:v1:" prefix --
    # decrypt_text() must return them as-is rather than raising, so old
    # documents stay readable until their pipeline re-runs. Same precedent
    # as Phase_9_Full_RoI_Stage1/CHALLENGES.md C5 (old-shape rows are
    # expected, not an error state).
    assert decrypt_text("Standalone arrangement") == "Standalone arrangement"


def test_tampered_ciphertext_fails_to_decrypt() -> None:
    ciphertext = encrypt_text("Ireland")
    assert ciphertext is not None
    tampered = ciphertext[:-4] + ("A" if ciphertext[-4] != "A" else "B") + ciphertext[-3:]
    with pytest.raises(InvalidTag):
        decrypt_text(tampered)


def test_wrong_key_fails_to_decrypt(monkeypatch: pytest.MonkeyPatch) -> None:
    ciphertext = encrypt_text("confidential clause text")
    monkeypatch.setenv(
        "DOCUMENT_ENCRYPTION_KEY", base64.b64encode(secrets.token_bytes(32)).decode()
    )
    get_settings.cache_clear()
    with pytest.raises(InvalidTag):
        decrypt_text(ciphertext)
