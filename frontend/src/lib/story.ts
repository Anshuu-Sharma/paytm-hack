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
    id: "reach",
    pose: "confused",
    lines: {
      en: [
        "So I stopped trying to catch every leak myself.",
        "REX doesn't just flag the problem — it reaches out. On WhatsApp, by phone, wherever the customer actually is.",
      ],
      hi: [
        "तो मैंने हर रिसाव को खुद पकड़ने की कोशिश छोड़ दी।",
        "REX सिर्फ़ समस्या नहीं बताता — वह खुद संपर्क करता है। WhatsApp पर, फ़ोन पर, जहाँ भी ग्राहक असल में मौजूद हो।",
      ],
    },
  },
  {
    id: "whatsapp-campaign",
    pose: "hips",
    lines: {
      en: [
        "Meera's failed UPI payment? A WhatsApp nudge with a 1-tap retry link lands before she even notices.",
        "Customers who've gone quiet for weeks get a warm, personal-sounding win-back message — not a generic blast.",
      ],
      hi: [
        "मीरा का फेल UPI पेमेंट? उसे पता चलने से पहले ही एक 1-टैप रीट्राई लिंक वाला WhatsApp मैसेज पहुँच जाता है।",
        "हफ़्तों से चुप बैठे ग्राहकों को एक गर्मजोशी भरा, निजी-सा लगने वाला विन-बैक मैसेज मिलता है — कोई जेनेरिक ब्रॉडकास्ट नहीं।",
      ],
    },
  },
  {
    id: "voice-call",
    pose: "hips",
    lines: {
      en: [
        "When a customer needs more than a message, REX picks up the phone itself and calls — in Hinglish, like a real support call.",
        "No script-reading. It listens, negotiates, and gets a Promise-to-Pay or closes the sale, live.",
      ],
      hi: [
        "जब किसी ग्राहक को सिर्फ़ मैसेज से ज़्यादा चाहिए — REX खुद फ़ोन उठाता है और कॉल करता है, हिंग्लिश में, एक असली सपोर्ट कॉल की तरह।",
        "कोई रटा-रटाया स्क्रिप्ट नहीं। यह सुनता है, बातचीत करता है, और लाइव में Promise-to-Pay लेता है या बिक्री पूरी करता है।",
      ],
    },
  },
  {
    id: "cua-reveal",
    pose: "hopeful",
    lines: {
      en: [
        "But messaging and calling are just two things it can do. REX can actually use a computer — click, type, navigate — exactly like I would.",
        "Log into the bank's dispute portal and file a chargeback. Update my Paytm dashboard. Re-order stock on a supplier's site. On its own, end to end.",
      ],
      hi: [
        "पर मैसेज भेजना और कॉल करना तो सिर्फ़ दो काम हैं जो यह कर सकता है। REX असल में कंप्यूटर इस्तेमाल कर सकता है — क्लिक करना, टाइप करना, नेविगेट करना — बिल्कुल मेरी तरह।",
        "बैंक के डिस्प्यूट पोर्टल में लॉगिन करके चार्जबैक फाइल करना। मेरा Paytm डैशबोर्ड अपडेट करना। सप्लायर की साइट से स्टॉक दोबारा ऑर्डर करना। खुद से, शुरू से आख़िर तक।",
      ],
    },
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
      en: ["Meet REX — a Computer-Use Agent built to run my revenue, not just talk about it."],
      hi: ["मिलिए REX से — एक Computer-Use Agent, जो सिर्फ़ बात नहीं करता, मेरा रेवेन्यू खुद चलाता है।"],
    },
  },
];
