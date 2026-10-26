/**
 * Strict EN/HI dictionary. Every user-facing string on the landing, demo hub,
 * and mission-control shells lives here so the [ EN | HI ] toggle can swap the
 * entire page (and the headline font falls back to Devanagari via :lang(hi)).
 */

export type Locale = "en" | "hi";

export const LOCALES: Locale[] = ["en", "hi"];

export const dictionary = {
  en: {
    nav: {
      getStarted: "Get Started",
      enterConsole: "Enter Console",
    },
    story: {
      kicker: "A REX Story",
      meet: "Meet Nayantara.",
      scroll: "scroll to hear her out ↓",
      back: "← back to REX",
      enterMc: "Enter Mission Control",
      watchLive: "Watch REX recover it — live",
    },
    landing: {
      enterKicker: "Click to enter",
      enterTitle: "Step into the world of payments.",
      surfaceTitle: "Every second, revenue moves in millions of tiny signals.",
      leakTitleA: "Revenue loss rarely happens in one clean step.",
      leakTitleB:
        "For years, we chased failed payments with blind retries — but they fell in isolation.",
      fourTitle: "Four failures. No memory. No coordination.",
      engineKicker: "Introducing",
      engineTitle: "What if one agent could recover payments as a whole?",
      revealKicker: "REX · Paytm",
      revealTitle: "The Revenue Execution Engine.",
      proofOverline: "Bounded. Auditable. Autonomous.",
      proofStatARate: "Recovery Rate",
      proofStatAValue: "+34%",
      proofStatACaption: "net revenue retained",
      proofStatBRate: "Resolution",
      proofStatBValue: "< 90s",
      proofStatBCaption: "median autonomous recovery",
      ctaKicker: "Revenue Execution Engine",
      ctaTitle: "Recover what was already yours.",
      cta: "Run the Simulations",
      scrollHint: "Scroll",
    },
    demo: {
      kicker: "Select a failure class",
      title: "Four failures. One engine.",
      subtitle:
        "Choose a simulation to watch the Revenue Execution Engine resolve a payment failure in real time.",
      problemLabel: "The Problem",
      rescueLabel: "Agent Rescue",
      run: "Run",
    },
    mission: {
      back: "Demo Hub",
      active: "Active Simulation",
      scenario: "Scenario",
      visualizer: "Visualizer",
      visualizerNote: "R3F / React Flow canvas mount point",
      terminal: "Audit Trail Terminal",
      live: "Live",
      awaiting: "Awaiting webhook event stream",
      connecting: "Connecting to REX engine…",
      streamError: "Stream unavailable",
      streamErrorNote:
        "Start the REX backend on :8000 to run the live simulation.",
      recoveryRate: "Recovery Rate",
      recovered: "Recovered",
    },
    states: {
      ingesting: "Ingesting",
      diagnosing: "Diagnosing",
      intervening: "Intervening",
      recovered: "Recovered",
      waiting: "Waiting",
    },
  },
  hi: {
    nav: {
      getStarted: "शुरू करें",
      enterConsole: "कंसोल खोलें",
    },
    story: {
      kicker: "एक REX कहानी",
      meet: "मिलिए नयनतारा से।",
      scroll: "उसकी बात सुनने के लिए स्क्रॉल करें ↓",
      back: "← REX पर वापस",
      enterMc: "मिशन कंट्रोल खोलें",
      watchLive: "REX को लाइव रिकवर करते देखें",
    },
    landing: {
      enterKicker: "प्रवेश करें",
      enterTitle: "भुगतान की दुनिया में कदम रखिए।",
      surfaceTitle: "हर सेकंड, राजस्व लाखों छोटे संकेतों में बहता है।",
      leakTitleA: "राजस्व का नुकसान कभी एक झटके में नहीं होता।",
      leakTitleB:
        "वर्षों तक हमने असफल भुगतानों का पीछा अंधे रीट्राई से किया — पर वे अलग-थलग गिरते रहे।",
      fourTitle: "चार विफलताएँ। न याददाश्त। न तालमेल।",
      engineKicker: "प्रस्तुत है",
      engineTitle: "क्या हो अगर एक एजेंट पूरे भुगतान को संभाल सके?",
      revealKicker: "REX · पेटीएम",
      revealTitle: "रेवेन्यू एग्ज़ीक्यूशन इंजन।",
      proofOverline: "सीमाबद्ध। लेखा-परीक्षण योग्य। स्वायत्त।",
      proofStatARate: "रिकवरी दर",
      proofStatAValue: "+34%",
      proofStatACaption: "शुद्ध राजस्व सुरक्षित",
      proofStatBRate: "समाधान",
      proofStatBValue: "< 90 सेकंड",
      proofStatBCaption: "औसत स्वायत्त रिकवरी",
      ctaKicker: "रेवेन्यू एग्ज़ीक्यूशन इंजन",
      ctaTitle: "जो पहले से आपका था, उसे वापस पाइए।",
      cta: "सिमुलेशन चलाएँ",
      scrollHint: "स्क्रॉल करें",
    },
    demo: {
      kicker: "एक विफलता श्रेणी चुनें",
      title: "चार विफलताएँ। एक इंजन।",
      subtitle:
        "एक सिमुलेशन चुनें और देखें कि रेवेन्यू एग्ज़ीक्यूशन इंजन वास्तविक समय में भुगतान विफलता को कैसे हल करता है।",
      problemLabel: "समस्या",
      rescueLabel: "एजेंट रेस्क्यू",
      run: "चलाएँ",
    },
    mission: {
      back: "डेमो हब",
      active: "सक्रिय सिमुलेशन",
      scenario: "परिदृश्य",
      visualizer: "विज़ुअलाइज़र",
      visualizerNote: "R3F / React Flow कैनवास माउंट पॉइंट",
      terminal: "ऑडिट ट्रेल टर्मिनल",
      live: "लाइव",
      awaiting: "वेबहुक इवेंट स्ट्रीम की प्रतीक्षा",
      connecting: "REX इंजन से कनेक्ट हो रहा है…",
      streamError: "स्ट्रीम अनुपलब्ध",
      streamErrorNote:
        "लाइव सिमुलेशन चलाने के लिए REX बैकएंड :8000 पर शुरू करें।",
      recoveryRate: "रिकवरी दर",
      recovered: "रिकवर किया",
    },
    states: {
      ingesting: "इनजेस्टिंग",
      diagnosing: "डायग्नोसिंग",
      intervening: "इंटरवेनिंग",
      recovered: "रिकवर्ड",
      waiting: "वेटिंग",
    },
  },
} as const;

/** Widen the `as const` literal strings to `string` so `en` and `hi` share one type. */
type Widen<T> = {
  [K in keyof T]: T[K] extends string ? string : Widen<T[K]>;
};

export type Dictionary = Widen<(typeof dictionary)["en"]>;
