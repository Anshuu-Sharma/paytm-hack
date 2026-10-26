from app.enums import InterventionAction, InterventionChannel
from app.services.policy_sandbox import PolicySandbox, ProposedAction

# A representative merchant policy used across the sandbox tests.
POLICY = {
    "max_discount_pct": 15,
    "max_intervention_amount_minor": 1_000_000,
    "allowed_channels": ["WHATSAPP", "VOICE", "PAYMENT_LINK"],
    "allowed_actions": [
        "SEND_WHATSAPP",
        "VOICE_CALL",
        "OFFER_FEE_WAIVER",
        "GENERATE_PAYMENT_LINK",
        "RETRY_CHARGE",
        "CANCEL_SUBSCRIPTION",
    ],
}


def _sandbox():
    return PolicySandbox(POLICY)


def test_allows_a_compliant_whatsapp_nudge():
    action = ProposedAction(
        action=InterventionAction.SEND_WHATSAPP,
        channel=InterventionChannel.WHATSAPP,
    )
    decision = _sandbox().validate(action)
    assert decision.approved is True


def test_blocks_discount_above_cap():
    # The LLM tries to give away 50% - policy cap is 15%.
    action = ProposedAction(
        action=InterventionAction.OFFER_FEE_WAIVER,
        channel=InterventionChannel.WHATSAPP,
        discount_pct=50,
    )
    decision = _sandbox().validate(action)
    assert decision.approved is False
    assert "discount" in decision.reason.lower()


def test_blocks_disallowed_channel():
    action = ProposedAction(
        action=InterventionAction.SEND_WHATSAPP,
        channel="SMS",  # not in allowed_channels
    )
    decision = _sandbox().validate(action)
    assert decision.approved is False


def test_blocks_amount_above_ceiling():
    action = ProposedAction(
        action=InterventionAction.GENERATE_PAYMENT_LINK,
        channel=InterventionChannel.PAYMENT_LINK,
        amount_minor=5_000_000,
    )
    decision = _sandbox().validate(action)
    assert decision.approved is False


def test_amount_ceiling_ignores_non_money_actions():
    # A WhatsApp/voice reminder moves no money, so the value of the underlying
    # invoice is irrelevant - a large B2B receivable can still be nudged. The
    # ceiling only gates actions that actually charge or pay out.
    nudge = ProposedAction(
        action=InterventionAction.SEND_WHATSAPP,
        channel=InterventionChannel.WHATSAPP,
        amount_minor=8_400_000,  # ₹84k invoice, far above the ceiling
    )
    assert _sandbox().validate(nudge).approved is True


def test_amount_ceiling_still_blocks_a_large_charge():
    charge = ProposedAction(
        action=InterventionAction.RETRY_CHARGE,
        amount_minor=8_400_000,
    )
    assert _sandbox().validate(charge).approved is False


def test_prompt_injection_cannot_elevate_a_full_waiver():
    # Even if a jailbroken LLM proposes a 100% waiver, the deterministic gate
    # refuses it. Money cannot move outside policy regardless of the prompt.
    action = ProposedAction(
        action=InterventionAction.OFFER_FEE_WAIVER,
        channel=InterventionChannel.WHATSAPP,
        discount_pct=100,
    )
    assert _sandbox().validate(action).approved is False


def test_default_sandbox_loads_shipped_policy_file():
    # The bundled merchant_policy.json must be valid and load cleanly.
    sandbox = PolicySandbox.from_default_policy()
    action = ProposedAction(
        action=InterventionAction.SEND_WHATSAPP,
        channel=InterventionChannel.WHATSAPP,
    )
    assert sandbox.validate(action).approved is True
