"""Text-to-speech for REX's spoken replies (now powered by Sarvam AI).

Maintained for backwards-compatibility; imports and delegates to
``app.services.sarvam_tts``.
"""

from __future__ import annotations

from app.services.sarvam_tts import synthesize

__all__ = ["synthesize"]
