"""REX voice output — ElevenLabs TTS with a browser fallback."""

from app.services.tts import synthesize


def test_no_key_returns_none(monkeypatch):
    # No configured voice → None, the signal for the frontend to use the browser.
    monkeypatch.setattr("app.services.tts.settings.elevenlabs_api_key", "", raising=False)
    assert synthesize("hello") is None


def test_empty_text_returns_none():
    assert synthesize("   ", api_key="k") is None


def test_tts_endpoint_204_without_key(client, monkeypatch):
    # Force no key so the test is deterministic even when a real key is in .env.
    monkeypatch.setattr("app.services.tts.settings.elevenlabs_api_key", "", raising=False)
    resp = client.post("/api/v1/assistant/tts", json={"text": "Recovered Acme's invoice."})
    assert resp.status_code == 204  # no key → browser voice fallback
