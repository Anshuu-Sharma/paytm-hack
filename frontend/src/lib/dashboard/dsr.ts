/** DSR (Daily Sale Report) + Bank Reconciliation — dummy data + shared config.
 *
 * Ported from the Sports Planet DSR spreadsheet (brand-wise FTW/APP/ACC sale
 * tracking) and its bank-reconciliation match view, restyled to this app's
 * visual language. This is a UI-only port: no backend, no persistence — all
 * data below is a deterministic (seeded) dummy dataset for the current demo
 * month, and edits in the DSR Sheet page only update local component state.
 */

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const TODAY = new Date("2026-10-31");
const DSR_YEAR = TODAY.getFullYear();
const DSR_MONTH_INDEX = TODAY.getMonth(); // 0-based, October
export const DSR_MONTH_LABEL = TODAY.toLocaleDateString("en-IN", { month: "long", year: "numeric" }).toUpperCase();

export const DAYS_OF_WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/* ── Brand config (exact order from the source Excel) ────────────────── */
export const DSR_BRANDS = [
  "REEBOK", "ASICS", "ADIDAS", "PUMA", "HRX", "KISAN", "SKECHERS", "MAF", "TOMMY", "DUKE",
] as const;
export type DsrBrand = (typeof DSR_BRANDS)[number];

export const BRAND_COLOR: Record<DsrBrand, string> = {
  REEBOK: "#2563eb",
  ASICS: "#16a34a",
  ADIDAS: "#ea580c",
  PUMA: "#dc2626",
  HRX: "#9333ea",
  KISAN: "#0891b2",
  SKECHERS: "#f59e0b",
  MAF: "#ec4899",
  TOMMY: "#0ea5e9",
  DUKE: "#84cc16",
};

/* Relative size of each brand's daily sales, so the dummy sheet doesn't look
 * flat — bigger sportswear brands sell more than the smaller ones. */
const BRAND_WEIGHT: Record<DsrBrand, number> = {
  REEBOK: 1.1, ASICS: 0.7, ADIDAS: 1.4, PUMA: 1.3, HRX: 0.6,
  KISAN: 0.3, SKECHERS: 0.8, MAF: 0.35, TOMMY: 0.5, DUKE: 0.9,
};

export interface DsrBrandFigures {
  ftwQty: number; ftwValue: number;
  appQty: number; appValue: number;
  accQty: number; accValue: number;
  totalQty: number; totalValue: number;
}

export interface DsrDayRow {
  date: string; // ISO yyyy-MM-dd
  day: string; // SUN..SAT
  brands: Record<DsrBrand, DsrBrandFigures>;
  grandTotalQty: number;
  grandTotalValue: number;
  logicSale: number; // grand total value minus DUKE's value
  dukeSale: number; // DUKE brand's total value
}

function dayName(d: Date): string {
  return DAYS_OF_WEEK[d.getDay()];
}

/** Pure: recalculates every brand's totals + the row's grand total / logic
 * sale / duke sale from its ftw/app/acc figures, without mutating the input
 * (callers may share brand-figure objects with other rows/state snapshots). */
function recomputeRow(row: DsrDayRow): DsrDayRow {
  let grandTotalQty = 0;
  let grandTotalValue = 0;
  let dukeTotalValue = 0;

  const brands = {} as Record<DsrBrand, DsrBrandFigures>;
  DSR_BRANDS.forEach((brand) => {
    const b = row.brands[brand];
    const totalQty = b.ftwQty + b.appQty + b.accQty;
    const totalValue = b.ftwValue + b.appValue + b.accValue;
    brands[brand] = { ...b, totalQty, totalValue };
    grandTotalQty += totalQty;
    grandTotalValue += totalValue;
    if (brand === "DUKE") dukeTotalValue = totalValue;
  });

  return {
    ...row,
    brands,
    grandTotalQty,
    grandTotalValue,
    dukeSale: dukeTotalValue,
    logicSale: grandTotalValue - dukeTotalValue,
  };
}

function buildBrandFigures(rng: () => number, weight: number, weekendBoost: number): DsrBrandFigures {
  const scale = weight * weekendBoost;
  const ftwQty = Math.round((2 + rng() * 6) * scale);
  const appQty = Math.round((1 + rng() * 4) * scale);
  const accQty = Math.round((1 + rng() * 5) * scale);
  const ftwValue = Math.round(ftwQty * (1800 + rng() * 1400));
  const appValue = Math.round(appQty * (900 + rng() * 900));
  const accValue = Math.round(accQty * (300 + rng() * 500));
  return {
    ftwQty, ftwValue, appQty, appValue, accQty, accValue,
    totalQty: ftwQty + appQty + accQty,
    totalValue: ftwValue + appValue + accValue,
  };
}

/** Deterministic dummy DSR sheet for the demo month (31 days). */
export function generateDsrMonth(year: number, monthIndex: number): DsrDayRow[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const rng = seeded(7331);
  const rows: DsrDayRow[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const weekendBoost = isWeekend ? 1.35 : 1;

    const brands = {} as Record<DsrBrand, DsrBrandFigures>;
    DSR_BRANDS.forEach((brand) => {
      brands[brand] = buildBrandFigures(rng, BRAND_WEIGHT[brand], weekendBoost);
    });

    rows.push(
      recomputeRow({
        date: date.toISOString().slice(0, 10),
        day: dayName(date),
        brands,
        grandTotalQty: 0,
        grandTotalValue: 0,
        logicSale: 0,
        dukeSale: 0,
      }),
    );
  }
  return rows;
}

export function recomputeDsrRow(row: DsrDayRow): DsrDayRow {
  return recomputeRow(row);
}

export const DSR_ROWS: DsrDayRow[] = generateDsrMonth(DSR_YEAR, DSR_MONTH_INDEX);

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

/* ── Bank reconciliation — dummy match results for the same month ───── */
export type ReconStatus = "MATCHED" | "DISCREPANCY" | "MISSING_DSR" | "MISSING_BANK";
export type AlertLevel = "GREEN" | "YELLOW" | "RED";

export interface ReconDayRow {
  date: string;
  day: string;
  software: { card: number; cash: number; upi: number };
  cardMachineTotal: number;
  bank: { card: number; cash: number; upi: number };
  status: ReconStatus;
  discrepancy: number; // software total - bank total
  alertLevel: AlertLevel;
}

export function alertLevel(discrepancy: number): AlertLevel {
  const abs = Math.abs(discrepancy);
  if (abs < 500) return "GREEN";
  if (abs <= 1000) return "YELLOW";
  return "RED";
}

/** Deterministic dummy reconciliation match results for the demo month. */
export function generateReconciliationMonth(year: number, monthIndex: number): ReconDayRow[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const rng = seeded(5109);
  const rows: ReconDayRow[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const scale = isWeekend ? 1.35 : 1;

    const softwareCard = Math.round((8000 + rng() * 9000) * scale);
    const softwareCash = Math.round((3000 + rng() * 4000) * scale);
    const softwareUpi = Math.round((4000 + rng() * 5000) * scale);
    const cardMachineTotal = Math.round(softwareCard * (0.98 + rng() * 0.04));

    const roll = rng();
    let status: ReconStatus;
    let bankCard = softwareCard;
    let bankCash = softwareCash;
    let bankUpi = softwareUpi;

    if (roll < 0.62) {
      status = "MATCHED";
      bankCard = softwareCard + Math.round((rng() - 0.5) * 60);
    } else if (roll < 0.82) {
      status = "DISCREPANCY";
      bankCard = softwareCard - Math.round(400 + rng() * 2200);
    } else if (roll < 0.92) {
      status = "MISSING_BANK";
      bankCard = 0; bankCash = 0; bankUpi = 0;
    } else {
      status = "MISSING_DSR";
      // Bank shows a deposit but DSR has no matching software sales recorded for the day.
      bankCard = Math.round(5000 + rng() * 6000);
    }

    const softwareTotal = softwareCard + softwareCash + softwareUpi;
    const bankTotal = bankCard + bankCash + bankUpi;
    const discrepancy = softwareTotal - bankTotal;

    rows.push({
      date: date.toISOString().slice(0, 10),
      day: dayName(date),
      software: { card: softwareCard, cash: softwareCash, upi: softwareUpi },
      cardMachineTotal,
      bank: { card: bankCard, cash: bankCash, upi: bankUpi },
      status,
      discrepancy,
      alertLevel: alertLevel(discrepancy),
    });
  }
  return rows;
}

export const RECON_ROWS: ReconDayRow[] = generateReconciliationMonth(DSR_YEAR, DSR_MONTH_INDEX);
