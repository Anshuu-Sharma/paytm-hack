import type { Locale } from "@/lib/i18n/dictionary";

/**
 * Nayantara's story — the narrative spine of the demo.
 *
 * She bootstrapped "Rooh", a homegrown SaaS product (a design tool for brands):
 * self-serve one-off purchases, monthly team subscriptions (Rooh Pro / Team /
 * Studio / Plus), and enterprise clients billed on invoices — the exact shapes
 * in the seeded data (subscription plans + B2B buyers like Zomato, Swiggy,
 * Blinkit, Nykaa). So her revenue leaks in all four failure classes at once.
 * Each class beat ends with that class's card, which links to the live console.
 *
 * Every beat is bilingual (en/hi) so the [ EN | HI ] toggle switches the whole story.
 */

export type Pose =
  | "wave"
  | "worried"
  | "confused"
  | "facepalm"
  | "hips"
  | "tired"
  | "hopeful";

export interface StoryBeat {
  id: string;
  pose: Pose;
  /** Speech-cloud lines per locale, revealed together for this beat. */
  lines: Record<Locale, string[]>;
  /** When set, the class solution card slides in after the lines. */
  classId?: 1 | 2 | 3 | 4;
}

export const STORY: StoryBeat[] = [
  {
    id: "intro",
    pose: "wave",
    lines: {
      en: [
        "Hi, I'm Nayantara.",
        "I bootstrapped Rooh, my little design software startup, right from my kitchen table.",
      ],
      hi: [
        "नमस्ते, मैं नयनतारा हूँ।",
        "मैंने Rooh, अपना छोटा-सा डिज़ाइन सॉफ़्टवेयर स्टार्टअप, अपनी किचन टेबल से ही खड़ा किया।",
      ],
    },
  },
  {
    id: "ache",
    pose: "worried",
    lines: {
      en: [
        "But every month, money just… disappears.",
        "Payments fail. Sign-ups vanish. Invoices go quiet. And I never know why.",
      ],
      hi: [
        "पर हर महीने पैसे बस… गायब हो जाते हैं।",
        "पेमेंट फेल होते हैं। साइन-अप गायब हो जाते हैं। इनवॉइस चुप। और मुझे कभी पता ही नहीं चलता क्यों।",
      ],
    },
  },
  {
    id: "class-1",
    pose: "confused",
    lines: {
      en: [
        "During a big launch, Meera tried to buy Rooh Pro — the bank's UPI switch timed out.",
        "She did everything right… and now she thinks I charged her twice.",
      ],
      hi: [
        "एक बड़े लॉन्च के दौरान, मीरा ने Rooh Pro खरीदने की कोशिश की — बैंक का UPI स्विच टाइमआउट हो गया।",
        "उसने सब कुछ सही किया… और अब उसे लगता है मैंने उससे दो बार पैसे ले लिए।",
      ],
    },
    classId: 1,
  },
  {
    id: "class-2",
    pose: "facepalm",
    lines: {
      en: [
        "Another customer picked a plan, reached the OTP screen…",
        "…switched apps to read the code, and the checkout was gone. High intent. Zero sale.",
      ],
      hi: [
        "एक और ग्राहक ने प्लान चुना, OTP स्क्रीन तक पहुँचा…",
        "…कोड पढ़ने के लिए ऐप बदला, और चेकआउट गायब। पूरा इरादा। बिक्री शून्य।",
      ],
    },
    classId: 2,
  },
  {
    id: "class-3",
    pose: "hips",
    lines: {
      en: [
        "My subscribers' auto-debits fail at month-end — salary's not in yet.",
        "I retry the next morning. Fails again. They cancel. Every. Single. Month.",
      ],
      hi: [
        "मेरे सब्सक्राइबर्स के ऑटो-डेबिट महीने के अंत में फेल हो जाते हैं — सैलरी अभी आई नहीं होती।",
        "मैं अगली सुबह रीट्राई करती हूँ। फिर फेल। वे कैंसल कर देते हैं। हर। एक। महीने।",
      ],
    },
    classId: 3,
  },
  {
    id: "class-4",
    pose: "tired",
    lines: {
      en: [
        "My biggest client — one of India's giant delivery apps — is 45 days late on a ₹2.1 lakh invoice.",
        "“Next week,” they keep saying. My team's spent hours chasing a promise.",
      ],
      hi: [
        "मेरा सबसे बड़ा क्लाइंट — भारत की एक बड़ी डिलीवरी ऐप — ₹2.1 लाख के इनवॉइस पर 45 दिन लेट है।",
        "“अगले हफ़्ते,” वे कहते रहते हैं। मेरी टीम घंटों बस एक वादे के पीछे भागती रहती है।",
      ],
    },
    classId: 4,
  },
  {
    id: "turn",
    pose: "hopeful",
    lines: {
      en: [
        "Revenue doesn't break in one clean snap. It drains through a hundred tiny cracks I can't see or chase.",
        "I don't need more people. I need something that thinks, and recovers, on its own.",
      ],
      hi: [
        "रेवेन्यू एक झटके में नहीं टूटता। यह सौ छोटी-छोटी दरारों से रिसता है जिन्हें मैं न देख सकती हूँ, न पकड़ सकती हूँ।",
        "मुझे और लोग नहीं चाहिए। मुझे कुछ ऐसा चाहिए जो खुद सोचे — और खुद रिकवर करे।",
      ],
    },
  },
  {
    id: "rex",
    pose: "hopeful",
    lines: {
      en: ["Meet REX — my Revenue Execution Engine."],
      hi: ["मिलिए REX से — मेरा Revenue Execution Engine।"],
    },
  },
];
