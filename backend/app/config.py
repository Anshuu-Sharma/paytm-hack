from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchor paths to this file's location so the app behaves identically no matter
# what working directory it's launched from (previously the SQLite file landed
# in a different place depending on CWD).
BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    app_name: str = "REX — Paytm Merchant Growth AI"
    database_url: str = f"sqlite:///{BACKEND_DIR / 'recovery_engine.db'}"

    # Comma-separated list of origins allowed by CORS. Wildcard is intentionally
    # avoided because it is invalid together with credentialed requests.
    cors_origins: str = "http://localhost:3000"

    # Fernet key for encrypting PII at rest. Empty -> ephemeral dev key.
    encryption_key: str = ""

    # Paytm Merchant Settings
    paytm_mid: str = ""
    paytm_merchant_key: str = ""
    paytm_webhook_secret: str = ""

    # Gemini (cognitive layer). Model is overridable so the deployment can track
    # whichever Flash model the API key has access to.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"
    # Message drafting is high-volume and low-stakes, so it uses the cheapest
    # Flash-Lite tier. Overridable; drafting degrades to a template if the model
    # is unavailable, so an unknown name never breaks the demo.
    gemini_draft_model: str = "gemini-flash-lite-latest"

    # Sarvam AI — Indian-language voice stack (TTS + STT). When the key is absent
    # the /assistant/tts endpoint returns no audio (browser voice fallback) and
    # the /assistant/stt endpoint returns an error. The live voice-call pipeline
    # also requires this key to connect to Sarvam WebSocket endpoints.
    #
    # TTS: Bulbul v4-flash — 200+ Indian-language persona voices, low latency.
    # STT: Saaras v4 — 22+ Indian languages + codemix (Hinglish) support.
    sarvam_api_key: str = ""
    # bulbul:v4-flash speaker IDs use <persona>_<lang>_<style> format.
    # amit_hi_conversational is a soft-spoken, warm conversational agent for Hindi.
    sarvam_tts_speaker: str = "amit_hi_conversational"
    sarvam_tts_model: str = "bulbul:v4-flash"
    sarvam_tts_language: str = "hi-IN"
    sarvam_stt_model: str = "saaras:v4"

    # Sarvam Voice Agents — Instant Outbound API (real PSTN calls, separate
    # product from the STT/TTS pair above). All five values come from the
    # Sarvam dashboard: Voice Agents > your app > Deploy. Call is a no-op
    # (raises) until all are set.
    sarvam_org_id: str = ""
    sarvam_workspace_id: str = ""
    sarvam_outbound_app_id: str = ""
    sarvam_outbound_connection_id: str = ""
    sarvam_outbound_agent_phone_number: str = ""

    # When false, channel adapters simulate dispatch instead of making real
    # outbound calls. Kept off by default so the batch harness never spams.
    live_mode: bool = False

    # Twilio WhatsApp (live channel). from_ is the sandbox/business number.
    # Two auth modes are supported: classic Account SID + Auth Token, or an API
    # Key (SK...) + secret, which still needs the Account SID (AC...) alongside it.
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_api_key_sid: str = ""
    twilio_api_key_secret: str = ""
    twilio_whatsapp_from: str = "whatsapp:+14155238886"  # Twilio sandbox default

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
