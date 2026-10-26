"""Application-level encryption for sensitive fields (PII at rest).

Customer contact details are PII, so we don't want them sitting in plaintext
inside the SQLite file. ``EncryptedString`` is a SQLAlchemy ``TypeDecorator``
that transparently encrypts on write and decrypts on read using Fernet
(AES-128-CBC + HMAC).

The key comes from ``settings.encryption_key``. For local development a key is
generated on the fly with a warning so the app stays runnable, but that key is
ephemeral (data won't survive a restart) — set ``ENCRYPTION_KEY`` in ``.env``
for anything persistent.
"""

import logging

from cryptography.fernet import Fernet
from sqlalchemy import String, TypeDecorator

from app.config import settings

logger = logging.getLogger(__name__)


def _load_cipher() -> Fernet:
    key = settings.encryption_key
    if not key:
        # Dev fallback: keep the app runnable without forcing key setup, but
        # make the trade-off loud. Persisted rows can't be read after restart.
        key = Fernet.generate_key().decode()
        logger.warning(
            "ENCRYPTION_KEY not set - generated an ephemeral key. Encrypted "
            "fields will NOT be recoverable across restarts. Set ENCRYPTION_KEY "
            "in the environment for persistent data."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


_cipher = _load_cipher()


class EncryptedString(TypeDecorator):
    """Stores a string encrypted at rest, exposes plaintext to the app."""

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return _cipher.encrypt(value.encode()).decode()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return _cipher.decrypt(value.encode()).decode()
