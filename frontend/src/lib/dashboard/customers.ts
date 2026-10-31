/** Shared dummy customer directory — payments + stats per customer.
 *
 * This is the single source of truth for "who REX's customers are" across the
 * app: the Customers page lists and drills into them, and the WhatsApp
 * Campaigns flow (both the manual "+ New Campaign" form and the voice-drafted
 * one) targets them by the same segment categories, so the audience sizes
 * shown everywhere ("sending to 8 VIP customers…") come from this one list
 * instead of being made up per-page. */

/** Deterministic seeded RNG (no Math.random → no hydration mismatch). */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export type Segment = "vip" | "dormant" | "regular";
/** The four audience choices offered in the WhatsApp Campaigns flow.
 * "all" is every customer; "custom" maps to the regular (non-VIP,
 * non-dormant) segment in this demo. */
export type AudienceKey = "all" | "dormant" | "vip" | "custom";

export interface Payment {
  id: number;
  date: string; // ISO
  amount: number; // ₹
  method: "UPI" | "Card" | "Net Banking" | "Wallet";
  status: "SUCCESS" | "FAILED" | "REFUNDED";
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  segment: Segment;
  joinedDate: string; // ISO
  lastVisit: string; // ISO
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  payments: Payment[];
}

const FIRST_NAMES = [
  "Priya", "Rajesh", "Anita", "Mohan", "Sunita", "Amit", "Kavita", "Vikram",
  "Deepa", "Suresh", "Pooja", "Ravi", "Geeta", "Ashok", "Nirmala", "Arjun",
  "Meera", "Sanjay", "Lakshmi", "Vijay", "Radha", "Manoj", "Shalini", "Kiran",
  "Rohit", "Neha", "Aditya", "Swati", "Harish", "Pallavi", "Naveen", "Divya",
  "Rakesh", "Sneha", "Girish", "Anjali", "Tarun", "Komal", "Yogesh", "Ritu",
  "Prakash", "Jyoti", "Deepak", "Shreya", "Mahesh", "Preeti", "Gaurav", "Anju",
];
const LAST_NAMES = [
  "Sharma", "Kumar", "Singh", "Verma", "Patel", "Gupta", "Nair", "Rao",
  "Joshi", "Mehta", "Agarwal", "Chopra", "Mishra", "Tiwari", "Yadav", "Reddy",
];

const TODAY = new Date("2026-10-31");
function daysAgoISO(days: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const METHODS: Payment["method"][] = ["UPI", "Card", "Net Banking", "Wallet"];

function buildPayments(rng: () => number, segment: Segment, idBase: number): Payment[] {
  const count = segment === "vip" ? 7 + Math.floor(rng() * 6) : segment === "regular" ? 3 + Math.floor(rng() * 5) : 2 + Math.floor(rng() * 3);
  const baseAmount = segment === "vip" ? 1800 : segment === "regular" ? 600 : 450;
  // Dormant customers' most recent payment is well in the past; others recent.
  const mostRecentGap = segment === "dormant" ? 46 + Math.floor(rng() * 60) : Math.floor(rng() * 10);

  const payments: Payment[] = [];
  let gap = mostRecentGap;
  for (let i = 0; i < count; i++) {
    const roll = rng();
    const status: Payment["status"] = roll < 0.08 ? "FAILED" : roll < 0.13 ? "REFUNDED" : "SUCCESS";
    payments.push({
      id: idBase * 100 + i,
      date: daysAgoISO(gap),
      amount: Math.round(baseAmount * (0.6 + rng() * 1.1)),
      method: METHODS[Math.floor(rng() * METHODS.length)],
      status,
    });
    gap += 4 + Math.floor(rng() * 12);
  }
  return payments.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function buildCustomer(index: number, segment: Segment): CustomerProfile {
  const rng = seeded(1000 + index * 37);
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length + index) % LAST_NAMES.length];
  const payments = buildPayments(rng, segment, index + 1);
  const successful = payments.filter((p) => p.status === "SUCCESS");
  const totalSpend = successful.reduce((s, p) => s + p.amount, 0);
  const phoneTail = 70000 + index * 137 + Math.floor(rng() * 900);

  return {
    id: `cust-${index + 1}`,
    name: `${first} ${last}`,
    phone: `+91 9${String(phoneTail).padStart(8, "0")}`,
    segment,
    joinedDate: daysAgoISO(200 + Math.floor(rng() * 500)),
    lastVisit: payments[0]?.date ?? daysAgoISO(90),
    totalSpend,
    orderCount: payments.length,
    avgOrderValue: successful.length ? Math.round(totalSpend / successful.length) : 0,
    payments,
  };
}

const VIP_COUNT = 8;
const DORMANT_COUNT = 16;
const REGULAR_COUNT = 24;

export const CUSTOMERS: CustomerProfile[] = [
  ...Array.from({ length: VIP_COUNT }, (_, i) => buildCustomer(i, "vip")),
  ...Array.from({ length: DORMANT_COUNT }, (_, i) => buildCustomer(VIP_COUNT + i, "dormant")),
  ...Array.from({ length: REGULAR_COUNT }, (_, i) => buildCustomer(VIP_COUNT + DORMANT_COUNT + i, "regular")),
];

export const AUDIENCE_COUNT: Record<AudienceKey, number> = {
  all: CUSTOMERS.length,
  vip: VIP_COUNT,
  dormant: DORMANT_COUNT,
  custom: REGULAR_COUNT,
};

export const AUDIENCE_LABEL: Record<AudienceKey, string> = {
  all: "All Customers",
  dormant: "Dormant Customers",
  vip: "VIP / Top Spenders",
  custom: "Regular Customers",
};

const SEGMENT_FOR_AUDIENCE: Record<AudienceKey, Segment | null> = {
  all: null,
  vip: "vip",
  dormant: "dormant",
  custom: "regular",
};

/** The customers a given campaign audience would actually reach. */
export function customersInAudience(key: AudienceKey): CustomerProfile[] {
  const segment = SEGMENT_FOR_AUDIENCE[key];
  return segment === null ? CUSTOMERS : CUSTOMERS.filter((c) => c.segment === segment);
}
