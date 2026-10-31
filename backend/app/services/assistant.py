"""The REX assistant — a natural-language front door to the recovery engine.

The user talks to REX in plain English or Hindi; ``interpret`` turns that into a
grounded reply and, when the message asks for one, a structured action from a
fixed set: run a recovery, set a status, add a note, or navigate. Gemini does the
language understanding (classify the intent, pull out a transaction reference);
the action itself is assembled deterministically in code and every reference is
resolved against real rows. If the model is unavailable a keyword parser stands
in, so the assistant always answers — and every data answer is computed from the
live metrics, never invented.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Callable

from sqlalchemy.orm import Session

from app.enums import EscalationStatus, TransactionLifecycleState
from app.models import EscalationQueue, TransactionState
from app.services.reconciliation import compute_metrics

logger = logging.getLogger(__name__)

GenerateFn = Callable[[str], str]

# Intents the assistant can act on. "answer" carries no action. Each of these
# is a real capability that already exists as a button/form elsewhere in the
# dashboard — REX just gives the operator a conversational front door to it.
# Deliberately NOT exposed: editing policy rules (the Policy Inspector is
# explicitly operator-only, by design — "REX can never change these") and
# reseeding the whole demo dataset (destructive + slow; stays behind its own
# topbar button with its own loading state).
_INTENTS = {
    "run_recovery", "set_status", "add_note", "navigate",
    "resolve_escalation", "create_payment_link", "draft_message", "send_message",
    "simulate_case", "call_customer", "start_campaign",
    "answer",
}

# Only a status change is irreversible enough to confirm first. Everything
# else here mirrors a one-click button that already exists elsewhere in the
# UI (send payment link, resolve ticket, simulate a case, etc.) — the
# operator's own chat message is the deliberate action, same as that click.
_CONFIRM_INTENTS = {"set_status"}

_STATUSES = {s.value for s in TransactionLifecycleState}

# Words → canonical route token → real path.
_ROUTE_PATHS = {
    "overview": "/mission-control",
    "transactions": "/mission-control/transactions",
    "escalations": "/mission-control/escalations",
    "audit": "/mission-control/audit",
    "compliance": "/mission-control/compliance",
    "policy": "/mission-control/policy",
    "winback": "/mission-control/winback",
    "whatsapp": "/mission-control/whatsapp",
    "call_customer": "/mission-control/call-customer",
    "customers": "/mission-control/customers",
    "dsr": "/mission-control/dsr",
    "dsr_reconciliation": "/mission-control/dsr/reconciliation",
}
_CLASS_ROUTE = re.compile(r"^class:([1-4])$")

# Deterministic-fallback keyword tables.
_STATUS_WORDS = {
    "escalat": "ESCALATED",
    "cancel": "CANCELLED",
    "recovered": "RECOVERED",
    "resolve": "RECOVERED",
    "failed": "FAILED",
    "fail": "FAILED",
    "intervene": "INTERVENING",
    "intervening": "INTERVENING",
    "pending": "PENDING",
    "unworked": "PENDING",
    "not started": "PENDING",
    "waiting": "WAITING",
}
_RUN_WORDS = ("recover", "handle", "chase", "work on", "work this", "fix", "pursue")
_BATCH_WORDS = ("all", "these", "them", "every", "each", "list", "queue", "bunch", "batch", "everything")
_NAV_WORDS = {
    "overview": "overview", "dashboard": "overview",
    "transaction": "transactions",
    "escalation": "escalations",
    "audit": "audit",
    "compliance": "compliance", "stopping rule": "compliance",
    "policy": "policy",
    "win-back": "winback", "winback": "winback", "win back": "winback",
    "whatsapp": "whatsapp",
    "call customer": "call_customer", "call a customer": "call_customer",
    "customer": "customers",
    "dsr reconciliation": "dsr_reconciliation", "reconciliation": "dsr_reconciliation",
    "dsr": "dsr",
}
_CLASS_KEYWORDS = {
    1: ("failed payment", "payment failure", "class 1"),
    2: ("abandoned checkout", "checkout", "class 2"),
    3: ("subscription", "mandate", "class 3"),
    4: ("overdue invoice", "invoice", "receivable", "class 4"),
}
_THIS_WORDS = {"this", "this one", "current", "it", "the current one", "here"}


# --- reference resolution ---------------------------------------------------

def _serial_from_ref(ref: str) -> int | None:
    """Extract a human serial number from a reference like "transaction 171",
    "#171", or "171". Returns None if the ref isn't a serial."""
    r = ref.strip().lower()
    r = re.sub(r"^(transaction|txn|case|no\.?|number)\s+", "", r).strip()
    r = r.lstrip("#").strip()
    return int(r) if r.isdigit() else None


def resolve_transaction(db: Session, ref: str | None, context: dict) -> str | None:
    """Resolve a spoken reference ("Acme", "this one", a txn id, "#171") to a real
    id. Returns None when nothing matches or a name is ambiguous, so callers can
    ask the user to disambiguate rather than act on the wrong row.
    """
    focused = context.get("focused_transaction_id")
    if not ref:
        return None
    r = ref.strip().lower()
    if r in _THIS_WORDS:
        return focused

    serial = _serial_from_ref(ref)
    if serial is not None:
        row = db.get(TransactionState, serial)
        return row.transaction_id if row else None

    txns = db.query(TransactionState).all()
    for t in txns:  # exact transaction id
        if t.transaction_id.lower() == r:
            return t.transaction_id

    def _name(t) -> str:
        return str((t.metadata_json or {}).get("customer_name", "")).lower()

    # An exact full-name match is the same customer (the seeder repeats names
    # across paired rows), so pick one — preferring a row REX can still work —
    # rather than refusing. A merely partial match that hits several *different*
    # customers stays ambiguous.
    exact = [t for t in txns if _name(t) == r]
    if exact:
        return _prefer_runnable(exact)

    partial = [t for t in txns if r in _name(t)]
    if len(partial) == 1:
        return partial[0].transaction_id
    return None  # no match, or an ambiguous partial across different customers


_RUNNABLE_STATES = {
    TransactionLifecycleState.PENDING,
    TransactionLifecycleState.DIAGNOSING,
    TransactionLifecycleState.INTERVENING,
    TransactionLifecycleState.WAITING,
}


def _prefer_runnable(rows: list[TransactionState]) -> str:
    for t in rows:
        if t.current_state in _RUNNABLE_STATES:
            return t.transaction_id
    return rows[0].transaction_id


def _recovery_candidates(db: Session, ref: str | None, context: dict) -> list[str]:
    """Runnable cases a single-recovery request refers to. A named customer with
    several open cases returns all of them (so REX can ask all-or-one); a unique
    reference returns just one."""
    focused = context.get("focused_transaction_id")
    if not ref or ref.strip().lower() in _THIS_WORDS:
        return [focused] if focused else []

    serial = _serial_from_ref(ref)
    if serial is not None:
        row = db.get(TransactionState, serial)
        return [row.transaction_id] if row and row.current_state in _RUNNABLE_STATES else []

    r = ref.strip().lower()
    txns = [t for t in db.query(TransactionState).all() if t.current_state in _RUNNABLE_STATES]

    for t in txns:  # exact transaction id
        if t.transaction_id.lower() == r:
            return [t.transaction_id]

    def _name(t) -> str:
        return str((t.metadata_json or {}).get("customer_name", "")).lower()

    exact = [t for t in txns if _name(t) == r]
    if exact:
        return [t.transaction_id for t in exact]

    partial = [t for t in txns if r in _name(t)]
    if partial and len({_name(t) for t in partial}) == 1:  # same customer, not ambiguous
        return [t.transaction_id for t in partial]
    return []


def _batch_candidates(db: Session, context: dict, limit: int = 25) -> list[str]:
    """Runnable cases within the operator's current view — the set a batch
    recovery ("recover all / these") targets."""
    cls = context.get("class_filter") or _class_from_route(context.get("route"))
    status = context.get("status_filter")
    out = []
    for t in db.query(TransactionState).all():
        if t.current_state not in _RUNNABLE_STATES:
            continue
        if cls and int(t.failure_class) != int(cls):
            continue
        if status and t.current_state.value != status:
            continue
        out.append(t.transaction_id)
    return out[:limit]


# --- grounding --------------------------------------------------------------

def _catalog(db: Session) -> list[dict]:
    rows = db.query(TransactionState).all()
    out = []
    for t in rows:
        meta = t.metadata_json or {}
        out.append({
            "id": t.transaction_id,
            "serial": t.id,
            "name": meta.get("customer_name"),
            "class": int(t.failure_class),
            "status": t.current_state.value,
            "amount_inr": round(t.amount_minor / 100, 2),
        })
    return out


def _metrics_summary(db: Session) -> dict:
    m = compute_metrics(db)
    worst = None
    best_rate = 2.0
    for cid, c in m.get("by_class", {}).items():
        if c["count"] and c["recovery_rate"] < best_rate:
            best_rate, worst = c["recovery_rate"], cid
    return {
        "grrr": m["grrr"],
        "recovered_inr": m["recovered_inr"],
        "at_risk_inr": m["at_risk_inr"],
        "in_flight_inr": m["in_flight_inr"],
        "lost_inr": m["lost_inr"],
        "worst_class": worst,
    }


def _inr(n: float) -> str:
    return f"₹{int(round(n)):,}"


# --- the model path ---------------------------------------------------------

_INTENT_GUIDE = (
    "Choose exactly one intent:\n"
    "- answer: the operator is asking a question (rate, totals, status, which class is worst, "
    "what a term means). Do NOT emit an action; put the grounded answer in 'reply'.\n"
    "- run_recovery: the operator wants REX to work/recover/chase cases. For ONE named case, "
    "set transaction_ref and scope 'one'. For MULTIPLE ('recover all', 'recover these', 'the "
    "pending ones', 'this whole list'), set scope 'batch' and leave transaction_ref null — the "
    "cases come from the current view.\n"
    "- set_status: the operator wants a case's outcome changed (mark recovered, escalate, "
    "cancel, fail). Set transaction_ref and status. Phrase 'reply' as a PROPOSAL awaiting the "
    "operator's confirmation (e.g. \"I'll escalate this — confirm?\"), never as already done.\n"
    "- add_note: the operator wants to attach a note. Set transaction_ref and note.\n"
    "- navigate: the operator wants to open/show/go to a view (including 'open the call customer "
    "page'). Set route. If they also ask for a specific outcome (e.g. 'recovered failed payments', "
    "'escalated invoices', 'pending / recoverable / not-yet-worked payments'), set status to that "
    "outcome as well — it becomes a filter on the table. Pending cases are the ones REX can still "
    "recover.\n"
    "- resolve_escalation: the operator wants an escalation ticket closed/resolved for a case. "
    "Set transaction_ref.\n"
    "- create_payment_link: the operator wants a fresh payment link generated for a case. Set "
    "transaction_ref.\n"
    "- draft_message: the operator wants to SEE a drafted WhatsApp message without sending it "
    "('draft a reminder for X', 'what would you say to X'). Set transaction_ref and prompt (what "
    "the message should cover, in the operator's own words).\n"
    "- send_message: the operator wants a WhatsApp message actually sent now ('tell X...', 'message "
    "X that...', 'remind X to pay', 'send X a nudge'). Set transaction_ref and prompt (what to say). "
    "If they give exact wording in quotes, put that exact wording in prompt.\n"
    "- simulate_case: the operator wants a new simulated at-risk case created, for a demo ('simulate "
    "a failure', 'create a test overdue invoice'). Set failure_class if a category is named "
    "(1=Failed Payments, 2=Abandoned Checkouts, 3=Failed Subscriptions, 4=Overdue Invoices), else "
    "leave it null for a random one.\n"
    "- call_customer: the operator wants REX to actually place a simulated voice call to a named "
    "customer right now ('call Mohan about his late payment', 'ring up Priya and ask about her "
    "subscription') — this is different from navigate's call_customer route, which only opens the "
    "picker page. Set customer_name (as best you can tell from the message) and call_reason (why "
    "you're calling, in a short phrase).\n"
    "- start_campaign: the operator wants REX to CREATE, DRAFT, or SEND a WhatsApp broadcast "
    "campaign ('send a Diwali greeting to all customers', 'create a win-back campaign', 'draft a "
    "promo for VIP customers') — this is different from navigate's whatsapp route, which only opens "
    "the page to look at it. Set prompt to what they want to send, in their own words (REX will "
    "draft a template and keep asking about discounts/audience/confirmation from here).\n"
)

_ROUTE_GUIDE = (
    "route is one of: overview, transactions, escalations, audit, compliance, policy, winback, "
    "whatsapp, call_customer, customers, dsr, dsr_reconciliation — or class:N for one payment "
    "category, where 1=Failed Payments, 2=Abandoned Checkouts, 3=Failed Subscriptions/Mandates, "
    "4=Overdue Invoices (B2B receivables). "
    "winback = the Customer Win-Back page (dormancy/re-engagement offers). "
    "whatsapp = the WhatsApp Campaigns page (broadcast templates, including the voice-drafted "
    "campaign flow). call_customer = the Call Customer page (pick a customer + reason, REX places "
    "a simulated voice call). customers = the Customers directory (profiles, spend, payment "
    "history). dsr = the DSR Sheet. dsr_reconciliation = the DSR Reconciliation page. "
    "When the operator names a category (e.g. 'overdue invoices', 'failed subscriptions', "
    "'abandoned checkouts', 'failed payments'), you MUST use the matching class:N, not "
    "'transactions'. Use 'transactions' only for the unfiltered list."
)

_REF_GUIDE = (
    "transaction_ref identifies the case: use the customer's FULL name exactly as it appears "
    "in Transactions when named; use the serial number (e.g. \"171\") when the operator refers "
    "to a transaction by number; use \"this\" when the operator says this/that/current/it and a "
    "transaction is open; otherwise null."
)

_SCHEMA_HINT = (
    'Return ONLY minified JSON with these keys: '
    '{"intent": one of ["run_recovery","set_status","add_note","navigate","resolve_escalation",'
    '"create_payment_link","draft_message","send_message","simulate_case","call_customer",'
    '"start_campaign","answer"], '
    '"transaction_ref": string|null, '
    '"status": one of ["PENDING","DIAGNOSING","INTERVENING","WAITING","RECOVERED","ESCALATED",'
    '"CANCELLED","FAILED"]|null (PENDING = the not-yet-worked / recoverable queue), '
    '"note": string|null, '
    '"route": string|null, '
    '"scope": one of ["one","batch"]|null (only for run_recovery), '
    '"prompt": string|null (what to draft/send/create — for draft_message, send_message and '
    'start_campaign), '
    '"failure_class": integer|null (1-4, for simulate_case only), '
    '"customer_name": string|null (for call_customer only), '
    '"call_reason": string|null (for call_customer only), '
    '"reply": a short natural-language reply in the operator\'s language}. '
    "No prose outside the JSON."
)


_CLASS_NAMES = {
    1: "Failed Payments", 2: "Abandoned Checkouts",
    3: "Failed Subscriptions", 4: "Overdue Invoices",
}
_PAGE_NAMES = {
    "/mission-control": "Overview",
    "/mission-control/transactions": "Transactions",
    "/mission-control/escalations": "Escalations",
    "/mission-control/audit": "Audit Log",
    "/mission-control/compliance": "Stopping Rules",
    "/mission-control/policy": "Policy Inspector",
    "/mission-control/winback": "Customer Win-Back",
    "/mission-control/whatsapp": "WhatsApp Campaigns",
    "/mission-control/call-customer": "Call Customer",
    "/mission-control/customers": "Customers",
    "/mission-control/dsr": "DSR Sheet",
    "/mission-control/dsr/reconciliation": "DSR Reconciliation",
}


def _class_from_route(route: str | None) -> int | None:
    m = re.search(r"/mission-control/class/([1-4])", route or "")
    return int(m.group(1)) if m else None


def _describe_screen(context: dict) -> str:
    route = context.get("route") or ""
    cls = context.get("class_filter") or _class_from_route(route)
    status = context.get("status_filter")
    search = context.get("search")
    if cls:
        where = f"the {_CLASS_NAMES.get(int(cls), 'class ' + str(cls))} page"
    else:
        where = _PAGE_NAMES.get(route, "the dashboard")
    bits = [f"The operator is viewing {where}"]
    if status:
        bits.append(f"filtered to status {status}")
    if search:
        bits.append(f"searching for {search!r}")
    return ", ".join(bits) + "."


def _prompt(message: str, db: Session, context: dict, locale: str) -> str:
    catalog = _catalog(db)
    metrics = _metrics_summary(db)
    lang = "Hindi (Devanagari script)" if locale == "hi" else "English"
    focused = context.get("focused_transaction_id")
    return (
        "You are REX, an autonomous revenue-recovery agent embedded in a payments "
        "operations dashboard. Read the operator's message and decide whether they are "
        "asking a question or telling you to act, then respond as JSON.\n\n"
        f"{_INTENT_GUIDE}\n"
        f"{_REF_GUIDE}\n\n"
        f"{_ROUTE_GUIDE}\n\n"
        f"Reply in {lang}, in one or two short sentences, warm and professional. Refer to cases "
        "by the customer's name — never surface raw transaction IDs in the reply. Ground every "
        "number in the metrics below — never invent figures, names, or amounts. If a request is "
        "ambiguous or names a case you cannot find in Transactions, ask a brief clarifying "
        "question with intent 'answer' and no action.\n\n"
        f"Live metrics: {json.dumps(metrics)}\n"
        f"Transactions: {json.dumps(catalog)}\n"
        f"Current view: {_describe_screen(context)} "
        "When the operator says 'this page', 'these', 'this list', 'here', or 'what I'm "
        "looking at', they mean this view — its class and filter scope the cases they mean.\n"
        f"Currently open transaction id: {focused!r} (this is what 'this'/'current' refer to).\n\n"
        f"Operator message: {message!r}\n\n"
        f"{_SCHEMA_HINT}"
    )


def _parse_with_model(message: str, db: Session, context: dict, locale: str,
                      generate: GenerateFn) -> dict | None:
    try:
        raw = generate(_prompt(message, db, context, locale))
        data = json.loads(raw)
        if isinstance(data, dict) and data.get("intent") in _INTENTS:
            return data
    except Exception as exc:  # SDK/network/JSON error → deterministic fallback
        logger.warning("Assistant model parse failed (%s); using fallback.", exc)
    return None


# --- the deterministic fallback ---------------------------------------------

_QUESTION_STARTS = {"how", "what", "which", "why", "where", "when", "who", "is", "are", "do", "does", "can"}


def _is_question(text: str) -> bool:
    first = text.split()[0] if text.split() else ""
    return text.endswith("?") or first in _QUESTION_STARTS


def _fallback_parse(message: str, db: Session, context: dict, locale: str) -> dict:
    text = message.lower().strip()
    question = _is_question(text)

    # These all have a keyword that the later, broader checks would otherwise
    # swallow ("resolve"/"escalat" → set_status, "send"/"call" → navigate-ish
    # words), so they're checked first.
    if not question and re.search(r"\bcall\b", text):
        m = re.search(r"\bcall\s+(?:up\s+)?([a-z]+)", text)
        name = m.group(1) if m else ""
        reason_m = re.search(r"\b(?:about|regarding|re:?|for)\s+(.+)$", text)
        reason = reason_m.group(1).strip() if reason_m else ""
        if name:
            return {"intent": "call_customer", "customer_name": name, "call_reason": reason,
                    "reply": _reply_for("call_customer", locale)}

    if not question and (
        "campaign" in text or "broadcast" in text
        or ("send" in text and any(w in text for w in ("all customers", "everyone", "customers")))
    ):
        return {"intent": "start_campaign", "prompt": message, "reply": _reply_for("start_campaign", locale)}

    if "escalation" in text and any(w in text for w in ("resolve", "close", "clear")):
        return {"intent": "resolve_escalation", "transaction_ref": _ref_from_text(text, context),
                "reply": _reply_for("resolve_escalation", locale)}

    if not question and ("payment link" in text or "pay link" in text):
        return {"intent": "create_payment_link", "transaction_ref": _ref_from_text(text, context),
                "reply": _reply_for("create_payment_link", locale)}

    if not question and "simulat" in text:
        failure_class = None
        for cid, words in _CLASS_KEYWORDS.items():
            if any(w in text for w in words):
                failure_class = cid
                break
        return {"intent": "simulate_case", "failure_class": failure_class,
                "reply": _reply_for("simulate_case", locale)}

    if not question and any(w in text for w in ("draft a message", "draft a reminder", "write a message", "draft")):
        return {"intent": "draft_message", "transaction_ref": _ref_from_text(text, context),
                "prompt": message, "reply": _reply_for("draft_message", locale)}

    if not question and (
        any(w in text for w in ("send a message", "send a nudge", "message him", "message her", "remind ", "nudge "))
        or re.search(r"\btell\s+\w", text)
    ):
        return {"intent": "send_message", "transaction_ref": _ref_from_text(text, context),
                "prompt": message, "reply": _reply_for("send_message", locale)}

    # A status change wins over "recover" so "mark this recovered" isn't a run.
    if any(w in text for w in ("mark", "set ", "escalat", "cancel", "resolve")) or text.startswith("set"):
        status = next((v for k, v in _STATUS_WORDS.items() if k in text), "RECOVERED")
        return {"intent": "set_status", "transaction_ref": _ref_from_text(text, context),
                "status": status, "reply": _reply_for("set_status", locale, status=status)}

    if "note" in text:
        note = message.split(":", 1)[1].strip() if ":" in message else message
        return {"intent": "add_note", "transaction_ref": _ref_from_text(text, context),
                "note": note, "reply": _reply_for("add_note", locale)}

    if not question and any(w in text for w in _RUN_WORDS):
        batch = any(w in text for w in _BATCH_WORDS)
        return {"intent": "run_recovery", "scope": "batch" if batch else "one",
                "transaction_ref": None if batch else _ref_from_text(text, context),
                "reply": _reply_for("run_recovery", locale)}

    if any(w in text for w in ("show", "open", "go to", "take me", "navigate", "filter")):
        route = _route_from_text(text)
        if route:
            # "failed"/"fail" name class 1 (Failed Payments), not a FAILED filter,
            # so they don't count as a status filter on navigation.
            status = next(
                (v for k, v in _STATUS_WORDS.items() if k in text and k not in ("fail", "failed")),
                None,
            )
            return {"intent": "navigate", "route": route, "status": status,
                    "reply": _reply_for("navigate", locale)}

    # Otherwise it's a question — answer it from the live metrics.
    return {"intent": "answer", "reply": _answer_from_metrics(text, db, locale)}


def _ref_from_text(text: str, context: dict) -> str | None:
    for w in _THIS_WORDS:
        if re.search(rf"\b{re.escape(w)}\b", text):
            return "this"
    # crude name pick: a capitalized-ish token the resolver can match on
    m = re.search(
        r"\b(?:recover|handle|chase|fix|escalate|mark|for|tell|send|message|remind|nudge)\s+"
        r"(?:the\s+|a\s+|an\s+)?([a-z][a-z0-9]+)",
        text,
    )
    return m.group(1) if m else None


def _route_from_text(text: str) -> str | None:
    for cid, words in _CLASS_KEYWORDS.items():
        if any(w in text for w in words):
            return f"class:{cid}"
    for word, token in _NAV_WORDS.items():
        if word in text:
            return token
    return None


def _answer_from_metrics(text: str, db: Session, locale: str) -> str:
    m = _metrics_summary(db)
    hi = locale == "hi"
    if any(w in text for w in ("rate", "grrr", "how well", "performing")):
        pct = f"{m['grrr'] * 100:.0f}%"
        return (f"अभी तक की रिकवरी दर (GRRR) {pct} है।" if hi
                else f"Our recovery rate (GRRR) is {pct} of at-risk revenue.")
    if any(w in text for w in ("pending", "at risk", "at-risk", "outstanding", "in flight", "in-flight")):
        return (f"जोखिम में {m['at_risk_inr']}, इनमें से {m['in_flight_inr']} अभी प्रक्रिया में है।" if hi
                else f"{_inr(m['at_risk_inr'])} is at risk, of which {_inr(m['in_flight_inr'])} is in-flight.")
    if any(w in text for w in ("lost", "write-off", "writeoff")):
        return (f"{_inr(m['lost_inr'])} अब तक बट्टे खाते में।" if hi
                else f"{_inr(m['lost_inr'])} has been written off so far.")
    # default: recovered figure
    return (f"अब तक {_inr(m['recovered_inr'])} वसूल किए गए ({m['grrr'] * 100:.0f}% GRRR)।" if hi
            else f"We've recovered {_inr(m['recovered_inr'])} so far ({m['grrr'] * 100:.0f}% GRRR).")


def _reply_for(intent: str, locale: str, *, status: str | None = None) -> str:
    hi = locale == "hi"
    if intent == "run_recovery":
        return "इस केस पर वसूली शुरू करूँ — पुष्टि करें?" if hi else "Shall I start recovery on this case — confirm?"
    if intent == "set_status":
        return (f"इसे {status} पर सेट करूँ — पुष्टि करें?" if hi
                else f"I'll set this to {status} — confirm?")
    if intent == "add_note":
        return "नोट जोड़ दिया।" if hi else "Noted."
    if intent == "navigate":
        return "खोल रहा हूँ…" if hi else "Opening that view…"
    if intent == "resolve_escalation":
        return "एस्केलेशन हल कर दिया।" if hi else "Escalation resolved."
    if intent == "create_payment_link":
        return "पेमेंट लिंक बना रहा हूँ…" if hi else "Generating a payment link…"
    if intent == "draft_message":
        return "ड्राफ्ट तैयार कर रहा हूँ…" if hi else "Drafting that…"
    if intent == "send_message":
        return "भेज रहा हूँ…" if hi else "Sending that now…"
    if intent == "simulate_case":
        return "एक नया केस बना रहा हूँ…" if hi else "Creating a simulated case…"
    if intent == "call_customer":
        return "कॉल शुरू कर रहा हूँ…" if hi else "Starting that call…"
    if intent == "start_campaign":
        return "कैंपेन बना रहा हूँ…" if hi else "Drafting that campaign…"
    return "" if hi else ""


# --- assembly ---------------------------------------------------------------

def _route_path(token: str | None) -> str | None:
    if not token:
        return None
    if token in _ROUTE_PATHS:
        return _ROUTE_PATHS[token]
    m = _CLASS_ROUTE.match(token)
    if m:
        return f"/mission-control/class/{m.group(1)}"
    if token.startswith("/mission-control"):
        return token
    return None


def _build(db: Session, parsed: dict, context: dict, locale: str) -> dict:
    intent = parsed.get("intent", "answer")
    reply = (parsed.get("reply") or "").strip()

    if intent == "answer":
        return {"reply": reply or _answer_from_metrics("", db, locale), "action": None}

    if intent == "navigate":
        path = _route_path(parsed.get("route"))
        if not path:
            return {"reply": reply or _reply_for("navigate", locale), "action": None}
        # A navigate can carry a status filter ("recovered failed payments"); the
        # frontend applies it to the transactions table on arrival.
        status_filter = parsed.get("status") if parsed.get("status") in _STATUSES else None
        return {"reply": reply or _reply_for("navigate", locale),
                "action": {"type": "navigate", "route": path, "requires_confirmation": False,
                           "transaction_id": None, "status": status_filter, "note": None}}

    if intent == "run_recovery":
        # A plural request is scoped to the current view; otherwise to the
        # referenced customer (who may have several open cases).
        if parsed.get("scope") == "batch":
            ids = _batch_candidates(db, context)
        else:
            ids = _recovery_candidates(db, parsed.get("transaction_ref"), context)

        if not ids:
            msg = ("इसके लिए कोई वसूली-योग्य केस नहीं मिला। नाम बताइए या कोई केस खोलिए।"
                   if locale == "hi"
                   else "I couldn't find a recoverable case for that. Name one, or open one.")
            return {"reply": reply or msg, "action": None}

        if len(ids) > 1:  # several cases → let the operator choose all-or-one
            n = len(ids)
            ask = (f"इसके लिए {n} वसूली-योग्य केस हैं। सभी {n} वसूल करूँ, या सिर्फ़ एक?"
                   if locale == "hi"
                   else f"There are {n} recoverable cases here. Recover all {n}, or just one?")
            return {"reply": reply or ask,
                    "action": {"type": "run_recovery", "scope": "batch", "transaction_ids": ids,
                               "transaction_id": ids[0], "status": None, "note": None,
                               "route": None, "requires_confirmation": False}}

        # Exactly one case → confirm before REX starts.
        return {"reply": reply or _reply_for("run_recovery", locale),
                "action": {"type": "run_recovery", "scope": "one", "transaction_id": ids[0],
                           "transaction_ids": None, "status": None, "note": None, "route": None,
                           "requires_confirmation": True}}

    if intent == "simulate_case":
        fc = parsed.get("failure_class")
        failure_class = int(fc) if isinstance(fc, (int, str)) and str(fc) in {"1", "2", "3", "4"} else None
        return {"reply": reply or _reply_for("simulate_case", locale),
                "action": {"type": "simulate_case", "failure_class": failure_class,
                           "transaction_id": None, "status": None, "note": None, "route": None,
                           "requires_confirmation": False}}

    if intent == "call_customer":
        name = (parsed.get("customer_name") or "").strip()
        if not name:
            clarify = ("किसे कॉल करना है?" if locale == "hi" else "Who would you like REX to call?")
            return {"reply": clarify, "action": None}
        call_reason = (parsed.get("call_reason") or "").strip()
        # Resolved against the frontend's own customer directory (it's dummy
        # data with no backend record) — this just hands the name/reason over.
        return {"reply": reply or _reply_for("call_customer", locale),
                "action": {"type": "call_customer", "customer_name": name, "call_reason": call_reason,
                           "transaction_id": None, "status": None, "note": None, "route": None,
                           "requires_confirmation": False}}

    if intent == "start_campaign":
        prompt = (parsed.get("prompt") or "").strip()
        if not prompt:
            clarify = ("क्या भेजना है?" if locale == "hi" else "What would you like REX to send?")
            return {"reply": clarify, "action": None}
        from app.services.campaign_drafting import draft_campaign

        draft = draft_campaign(prompt, history=[], template=None, audience=None, locale=locale)
        turn_history = [
            {"role": "user", "text": prompt},
            {"role": "rex", "text": draft["reply_text"]},
        ]
        # The campaign conversation is driven entirely by draft_campaign's own
        # reply (it owns this turn), not the general-assistant 'reply' field.
        return {"reply": draft["reply_text"],
                "action": {"type": "start_campaign", "template": draft["template"],
                           "audience": draft.get("audience"), "ready_to_send": draft.get("ready_to_send", False),
                           "history": turn_history, "transaction_id": None, "status": None,
                           "note": None, "route": None, "requires_confirmation": False}}

    # Every remaining intent acts on one specific transaction.
    txn_id = resolve_transaction(db, parsed.get("transaction_ref"), context)
    if not txn_id:
        clarify = ("किस ट्रांज़ैक्शन के लिए? नाम या आईडी बताइए।" if locale == "hi"
                   else "Which transaction do you mean? Tell me a name or open one.")
        return {"reply": clarify, "action": None}

    if intent == "set_status":
        status = parsed.get("status")
        if status not in _STATUSES:
            return {"reply": reply or "Which status?", "action": None}
        return {"reply": reply or _reply_for("set_status", locale, status=status),
                "action": {"type": "set_status", "transaction_id": txn_id, "status": status,
                           "note": None, "route": None, "requires_confirmation": True}}

    if intent == "resolve_escalation":
        ticket = (
            db.query(EscalationQueue)
            .filter_by(transaction_id=txn_id, status=EscalationStatus.OPEN)
            .order_by(EscalationQueue.created_at.desc())
            .first()
        )
        if not ticket:
            msg = ("इस केस के लिए कोई खुला एस्केलेशन नहीं है।" if locale == "hi"
                   else "There's no open escalation for that case.")
            return {"reply": msg, "action": None}
        return {"reply": reply or _reply_for("resolve_escalation", locale),
                "action": {"type": "resolve_escalation", "transaction_id": txn_id,
                           "escalation_id": ticket.id, "status": None, "note": None, "route": None,
                           "requires_confirmation": False}}

    if intent == "create_payment_link":
        return {"reply": reply or _reply_for("create_payment_link", locale),
                "action": {"type": "create_payment_link", "transaction_id": txn_id,
                           "status": None, "note": None, "route": None,
                           "requires_confirmation": False}}

    if intent in ("draft_message", "send_message"):
        prompt = (parsed.get("prompt") or "").strip()
        return {"reply": reply or _reply_for(intent, locale),
                "action": {"type": intent, "transaction_id": txn_id, "prompt": prompt,
                           "status": None, "note": None, "route": None,
                           "requires_confirmation": False}}

    # add_note (everything else handled above)
    note = (parsed.get("note") or "").strip()
    return {"reply": reply or _reply_for("add_note", locale),
            "action": {"type": "add_note", "transaction_id": txn_id, "note": note,
                       "status": None, "route": None, "requires_confirmation": False}}


_UNSET = object()  # "no generator supplied" — build the default; None means offline.


def interpret(db: Session, message: str, *, locale: str = "en",
              context: dict | None = None, generate=_UNSET) -> dict:
    """Interpret a chat message → {"reply": str, "action": dict|None}.

    ``generate`` unset builds the live model; pass ``None`` to force the offline
    keyword fallback (used by tests and when the SDK can't be wired).
    """
    ctx = context or {}
    loc = "hi" if locale == "hi" else "en"
    gen = _default_generate() if generate is _UNSET else generate

    parsed = _parse_with_model(message, db, ctx, loc, gen) if gen is not None else None
    if parsed is None:
        parsed = _fallback_parse(message, db, ctx, loc)
    return _build(db, parsed, ctx, loc)


def _default_generate() -> GenerateFn | None:
    try:
        from app.services.gemini_client import build_generate

        return build_generate()  # forces JSON output — ideal for intent parsing
    except Exception:  # pragma: no cover - import/SDK issues fall back to keywords
        return None
