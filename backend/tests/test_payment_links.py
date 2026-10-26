"""Real (test-mode) Paytm payment-link creation, posted to the WhatsApp thread.

The Paytm client is injected/monkeypatched so the tests never hit the network.
"""

import pytest

from app.models import Message, TransactionState
from app.services import payment_links


class _FakePaymentLink:
    def create(self, payload):
        assert payload["amount"] == 49900
        assert payload["currency"] == "INR"
        return {"id": "plink_TEST123", "short_url": "https://paytm.me/testABC"}


class _FakeClient:
    payment_link = _FakePaymentLink()


@pytest.fixture()
def txn(db_session):
    t = TransactionState(
        transaction_id="pl_1",
        paytm_payment_id="pay_pl_1",
        failure_class=1,
        merchant_id="m",
        customer_contact="+919900000000",
        amount_minor=49900,
        metadata_json={"customer_name": "Anika Bose"},
    )
    db_session.add(t)
    db_session.commit()
    return t


def test_create_real_link_posts_clickable_whatsapp_message(db_session, txn):
    result = payment_links.create_payment_link(db_session, "pl_1", client=_FakeClient())

    assert result["simulated"] is False
    assert result["url"] == "https://paytm.me/testABC"
    assert result["paytm_id"] == "plink_TEST123"

    # It lands in the thread as an outbound message carrying the link in meta,
    # which is what the WhatsApp UI turns into a clickable card.
    msg = db_session.query(Message).filter_by(transaction_id="pl_1").order_by(Message.seq.desc()).first()
    assert msg.direction.value == "OUTBOUND"
    assert msg.meta_json["payment_link"] == "https://paytm.me/testABC"
    assert "https://paytm.me/testABC" in msg.body


def test_falls_back_to_simulated_link_without_keys(db_session, txn, monkeypatch):
    monkeypatch.setattr(payment_links.settings, "paytm_mid", "", raising=False)
    monkeypatch.setattr(payment_links.settings, "paytm_merchant_key", "", raising=False)

    result = payment_links.create_payment_link(db_session, "pl_1")

    assert result["simulated"] is True
    assert result["url"].startswith("https://paytm.me/")


def test_endpoint_returns_link_and_thread_shows_it(client, db_session, txn, monkeypatch):
    monkeypatch.setattr(payment_links, "_build_client", lambda: _FakeClient())
    monkeypatch.setattr(payment_links.settings, "paytm_mid", "ptm_test_x", raising=False)
    monkeypatch.setattr(payment_links.settings, "paytm_merchant_key", "secret", raising=False)

    resp = client.post("/api/v1/transactions/pl_1/payment-link")
    assert resp.status_code == 201
    body = resp.json()
    assert body["url"] == "https://paytm.me/testABC"
    assert body["simulated"] is False
    assert body["message"]["meta"]["payment_link"] == "https://paytm.me/testABC"

    convo = client.get("/api/v1/transactions/pl_1/conversation").json()
    assert convo["messages"][-1]["meta"]["payment_link"] == "https://paytm.me/testABC"


def test_endpoint_404_for_unknown_txn(client):
    assert client.post("/api/v1/transactions/nope/payment-link").status_code == 404


class _FetchClient:
    """Stub whose payment_link.fetch returns a preset status."""

    def __init__(self, status):
        self._status = status

        class _PL:
            def create(_self, payload):
                return {"id": "plink_TEST123", "short_url": "https://paytm.me/testABC"}

            def fetch(_self, pid):
                assert pid == "plink_TEST123"
                return {"id": pid, "status": self._status}

        self.payment_link = _PL()


def test_status_marks_recovered_when_paid(db_session, txn):
    payment_links.create_payment_link(db_session, "pl_1", client=_FetchClient("created"))

    result = payment_links.payment_link_status(db_session, "pl_1", client=_FetchClient("paid"))

    assert result["paid"] is True
    assert result["current_state"] == "RECOVERED"
    t = db_session.query(TransactionState).filter_by(transaction_id="pl_1").one()
    assert t.current_state.value == "RECOVERED"
    # A system "payment received" beat lands in the thread.
    msgs = db_session.query(Message).filter_by(transaction_id="pl_1").all()
    assert any(m.sender.value == "SYSTEM" for m in msgs)


def test_status_not_paid_leaves_state(db_session, txn):
    payment_links.create_payment_link(db_session, "pl_1", client=_FetchClient("created"))

    result = payment_links.payment_link_status(db_session, "pl_1", client=_FetchClient("created"))

    assert result["paid"] is False
    t = db_session.query(TransactionState).filter_by(transaction_id="pl_1").one()
    assert t.current_state.value != "RECOVERED"


def test_status_without_link_is_graceful(db_session, txn):
    result = payment_links.payment_link_status(db_session, "pl_1")
    assert result["paid"] is False
    assert result["status"] == "no_link"


def test_status_endpoint_flags_paid(client, db_session, txn, monkeypatch):
    monkeypatch.setattr(payment_links, "_build_client", lambda: _FetchClient("paid"))
    monkeypatch.setattr(payment_links.settings, "paytm_mid", "ptm_test_x", raising=False)
    monkeypatch.setattr(payment_links.settings, "paytm_merchant_key", "secret", raising=False)
    payment_links.create_payment_link(db_session, "pl_1", client=_FetchClient("created"))

    resp = client.get("/api/v1/transactions/pl_1/payment-link/status")
    assert resp.status_code == 200
    assert resp.json()["paid"] is True
    assert resp.json()["current_state"] == "RECOVERED"
