import type { Locale } from "./i18n/dictionary";

export type MicroViz = "reroute" | "otp" | "calendar" | "invoice";

export interface FailureClassCopy {
  tag: string; // e.g. "Class 1 · Infrastructure Triage"
  title: string;
  problem: string;
  rescue: string;
}

export interface FailureClass {
  id: 1 | 2 | 3 | 4;
  accent: "cyan" | "violet" | "wait" | "blue";
  microViz: MicroViz;
  copy: Record<Locale, FailureClassCopy>;
}

export const FAILURE_CLASSES: FailureClass[] = [
  {
    id: 1,
    accent: "cyan",
    microViz: "reroute",
    copy: {
      en: {
        tag: "Class 1 · Infrastructure Triage",
        title: "Failed Payments",
        problem: "UPI switch timeouts and gateway drops.",
        rescue:
          "Detects latency and dynamically re-routes to healthy fallback rails, instantly.",
      },
      hi: {
        tag: "श्रेणी 1 · इंफ्रास्ट्रक्चर ट्राइएज",
        title: "असफल भुगतान",
        problem: "UPI स्विच टाइमआउट और गेटवे ड्रॉप।",
        rescue:
          "लेटेंसी का पता लगाकर तुरंत स्वस्थ फॉलबैक रेल्स पर री-रूट करता है।",
      },
    },
  },
  {
    id: 2,
    accent: "blue",
    microViz: "otp",
    copy: {
      en: {
        tag: "Class 2 · Friction Rescue",
        title: "Abandoned Checkouts",
        problem: "Users dropping at the OTP / 3DS step.",
        rescue:
          "Dispatches a 1-tap UPI Autopay link via WhatsApp, bypassing card friction.",
      },
      hi: {
        tag: "श्रेणी 2 · फ्रिक्शन रेस्क्यू",
        title: "छोड़े गए चेकआउट",
        problem: "OTP / 3DS चरण पर उपयोगकर्ता छोड़ रहे हैं।",
        rescue:
          "WhatsApp के ज़रिए 1-टैप UPI ऑटोपे लिंक भेजता है, कार्ड फ्रिक्शन से बचते हुए।",
      },
    },
  },
  {
    id: 3,
    accent: "wait",
    microViz: "calendar",
    copy: {
      en: {
        tag: "Class 3 · Smart Sequencer",
        title: "Failed Subscriptions",
        problem: "Auto-debits failing on month-end low balance.",
        rescue:
          "Defers the retry to align with the user's salary-credit window.",
      },
      hi: {
        tag: "श्रेणी 3 · स्मार्ट सीक्वेंसर",
        title: "असफल सब्सक्रिप्शन",
        problem: "महीने के अंत में कम बैलेंस से ऑटो-डेबिट विफल।",
        rescue:
          "रीट्राई को उपयोगकर्ता की सैलरी-क्रेडिट विंडो के साथ संरेखित करने के लिए स्थगित करता है।",
      },
    },
  },
  {
    id: 4,
    accent: "violet",
    microViz: "invoice",
    copy: {
      en: {
        tag: "Class 4 · P2P Tracker",
        title: "Overdue Invoices",
        problem: "Overdue Net-30 invoices awaiting manual follow-up.",
        rescue:
          "Negotiates and extracts a hard Promise-to-Pay (P2P) date.",
      },
      hi: {
        tag: "श्रेणी 4 · P2P ट्रैकर",
        title: "बकाया इनवॉइस",
        problem: "मैन्युअल फॉलो-अप की प्रतीक्षा में अतिदेय Net-30 चालान।",
        rescue:
          "बातचीत करके एक ठोस Promise-to-Pay (P2P) तिथि प्राप्त करता है।",
      },
    },
  },
];

export const getFailureClass = (id: number): FailureClass =>
  FAILURE_CLASSES.find((c) => c.id === id) ?? FAILURE_CLASSES[0];
