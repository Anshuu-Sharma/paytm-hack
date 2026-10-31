"use client";

import { Fragment, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { container, item } from "@/lib/dashboard/motion";
import { Card, CardHeader, Chip } from "@/components/dashboard/Card";
import PageHeader from "@/components/dashboard/PageHeader";
import { shortDate } from "@/lib/dashboard/format";
import {
  DSR_BRANDS,
  BRAND_COLOR,
  DSR_ROWS,
  DSR_MONTH_LABEL,
  recomputeDsrRow,
  formatINR,
  type DsrDayRow,
  type DsrBrand,
} from "@/lib/dashboard/dsr";

type EditableField = "ftwQty" | "ftwValue" | "appQty" | "appValue" | "accQty" | "accValue";
type TotalField = "totalQty" | "totalValue";

const EDITABLE_FIELDS: Array<{ field: EditableField; label: string }> = [
  { field: "ftwQty", label: "FTW QTY" },
  { field: "ftwValue", label: "FTW VALUE" },
  { field: "appQty", label: "APP QTY" },
  { field: "appValue", label: "APP VALUE" },
  { field: "accQty", label: "ACC QTY" },
  { field: "accValue", label: "ACC VALUE" },
];
const TOTAL_FIELDS: Array<{ field: TotalField; label: string }> = [
  { field: "totalQty", label: "TOTAL QTY" },
  { field: "totalValue", label: "TOTAL VALUE" },
];

const STICKY_DATE_W = 92;
const STICKY_DAY_W = 48;

function EditableCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const n = e.target.value === "" ? 0 : Number(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
      className="w-full rounded-sm bg-transparent px-1 py-1 text-right text-[11px] outline-none transition-colors focus:bg-[var(--d-accent-soft)]"
      style={{ color: "var(--d-ink)" }}
    />
  );
}

export default function DsrSheetPage() {
  const [rows, setRows] = useState<DsrDayRow[]>(DSR_ROWS);

  const handleChange = (rowIdx: number, brand: DsrBrand, field: EditableField, value: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i !== rowIdx
          ? r
          : recomputeDsrRow({ ...r, brands: { ...r.brands, [brand]: { ...r.brands[brand], [field]: value } } }),
      ),
    );
  };

  // Brand-wise summary (MTD) — quantities only, like the source sheet's summary table.
  const summaryTotals = useMemo(() => {
    const totals: Record<DsrBrand, { ftw: number; app: number; acc: number; total: number }> = {} as never;
    DSR_BRANDS.forEach((b) => (totals[b] = { ftw: 0, app: 0, acc: 0, total: 0 }));
    rows.forEach((row) => {
      DSR_BRANDS.forEach((b) => {
        totals[b].ftw += row.brands[b].ftwQty;
        totals[b].app += row.brands[b].appQty;
        totals[b].acc += row.brands[b].accQty;
        totals[b].total += row.brands[b].totalQty;
      });
    });
    return totals;
  }, [rows]);

  const categoryTotals = useMemo(() => {
    let ftw = 0, app = 0, acc = 0;
    DSR_BRANDS.forEach((b) => {
      ftw += summaryTotals[b].ftw;
      app += summaryTotals[b].app;
      acc += summaryTotals[b].acc;
    });
    return { ftw, app, acc, total: ftw + app + acc };
  }, [summaryTotals]);

  const grandTotals = useMemo(() => {
    let qty = 0, value = 0, logicSale = 0, dukeSale = 0;
    rows.forEach((row) => {
      qty += row.grandTotalQty;
      value += row.grandTotalValue;
      logicSale += row.logicSale;
      dukeSale += row.dukeSale;
    });
    return { qty, value, logicSale, dukeSale };
  }, [rows]);

  const kpis = useMemo(() => {
    const totalBills = grandTotals.qty;
    return {
      atv: totalBills > 0 ? grandTotals.value / totalBills : 0,
      upt: totalBills > 0 ? grandTotals.qty / totalBills : 0,
      asp: grandTotals.qty > 0 ? grandTotals.value / grandTotals.qty : 0,
    };
  }, [grandTotals]);

  const handleExport = () => {
    const headers: string[] = ["DATE", "DAY"];
    DSR_BRANDS.forEach((b) => {
      headers.push(`${b} FTW QTY`, `${b} FTW VALUE`, `${b} APP QTY`, `${b} APP VALUE`, `${b} ACC QTY`, `${b} ACC VALUE`, `${b} TOTAL QTY`, `${b} TOTAL VALUE`);
    });
    headers.push("GRAND TOTAL QTY", "GRAND TOTAL VALUE", "LOGIC SALE", "DUKE SALE");

    const escapeCSV = (v: string | number) => {
      const s = String(v);
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csvRows = rows.map((row) => {
      const out: (string | number)[] = [row.date, row.day];
      DSR_BRANDS.forEach((b) => {
        const f = row.brands[b];
        out.push(f.ftwQty, f.ftwValue, f.appQty, f.appValue, f.accQty, f.accValue, f.totalQty, f.totalValue);
      });
      out.push(row.grandTotalQty, row.grandTotalValue, row.logicSale, row.dukeSale);
      return out;
    });
    const csv = [headers, ...csvRows].map((r) => r.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DSR_SportsPlanet_${DSR_MONTH_LABEL.replace(" ", "-")}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const thBase = "px-2 py-1.5 text-[9.5px] font-semibold uppercase tracking-wider whitespace-nowrap";
  const stickyHeadBg = "var(--d-surface-2)";

  return (
    <motion.div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-5" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader
          title="DSR Sheet"
          subtitle={`Daily Brand-Wise Sale Report — ${DSR_MONTH_LABEL} · Sports Planet`}
          accent="var(--d-accent)"
          right={
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold"
              style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)", color: "var(--d-ink)" }}
            >
              ⬇ Export CSV
            </button>
          }
        />
      </motion.div>

      {/* KPI row */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "ATV · Avg Transaction Value", value: formatINR(kpis.atv), color: "var(--d-info)" },
          { label: "UPT · Units Per Transaction", value: kpis.upt.toFixed(2), color: "var(--d-ok)" },
          { label: "ASP · Avg Selling Price", value: formatINR(kpis.asp), color: "var(--d-accent)" },
          { label: "Grand Total (MTD)", value: formatINR(grandTotals.value), color: "var(--d-ink)" },
        ].map((k) => (
          <section key={k.label} className="flex min-h-[100px] flex-col justify-between rounded-[18px] p-4" style={{ background: "var(--d-surface)", border: "1px solid var(--d-border)" }}>
            <span className="text-[10.5px] font-medium uppercase tracking-wider leading-tight" style={{ color: "var(--d-muted)" }}>{k.label}</span>
            <span className="text-[22px] font-semibold leading-none tracking-[-0.02em]" style={{ color: k.color }}>{k.value}</span>
          </section>
        ))}
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Bills Cut (MTD)", value: grandTotals.qty.toLocaleString("en-IN") },
          { label: "Logic Sale", value: formatINR(grandTotals.logicSale) },
          { label: "Duke Sale", value: formatINR(grandTotals.dukeSale) },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={{ background: "var(--d-surface-2)", border: "1px solid var(--d-border)" }}>
            <span className="text-[11px]" style={{ color: "var(--d-muted)" }}>{s.label}</span>
            <span className="font-mono text-[12.5px] font-semibold" style={{ color: "var(--d-ink)" }}>{s.value}</span>
          </div>
        ))}
      </motion.div>

      {/* Spreadsheet */}
      <motion.div variants={item}>
        <Card>
          <CardHeader
            title="Daily Entries"
            subtitle="Editable — QTY & VALUE per brand per category. Totals recalculate automatically. First two columns stay pinned while scrolling."
            right={<Chip tone={{ fg: "var(--d-accent)", soft: "var(--d-accent-soft)" }}>{rows.length} days</Chip>}
          />
          <div className="px-2 pb-4">
            <div className="max-h-[640px] overflow-auto rounded-xl" style={{ border: "1px solid var(--d-border)" }}>
              <table className="border-collapse text-[11px]" style={{ minWidth: 1400 }}>
                <thead>
                  <tr>
                    <th className={thBase} style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: stickyHeadBg, width: STICKY_DATE_W }} rowSpan={2}>Date</th>
                    <th className={thBase} style={{ position: "sticky", left: STICKY_DATE_W, top: 0, zIndex: 3, background: stickyHeadBg, width: STICKY_DAY_W }} rowSpan={2}>Day</th>
                    {DSR_BRANDS.map((b) => (
                      <th key={b} className={thBase} style={{ position: "sticky", top: 0, zIndex: 2, background: BRAND_COLOR[b], color: "#fff" }} colSpan={8}>
                        {b}
                      </th>
                    ))}
                    <th className={thBase} style={{ position: "sticky", top: 0, zIndex: 2, background: stickyHeadBg }} colSpan={2}>Grand Total</th>
                    <th className={thBase} style={{ position: "sticky", top: 0, zIndex: 2, background: stickyHeadBg }} rowSpan={2}>Logic Sale</th>
                    <th className={thBase} style={{ position: "sticky", top: 0, zIndex: 2, background: stickyHeadBg }} rowSpan={2}>Duke Sale</th>
                  </tr>
                  <tr>
                    {DSR_BRANDS.map((b) =>
                      [...EDITABLE_FIELDS, ...TOTAL_FIELDS].map((f) => (
                        <th key={`${b}-${f.field}`} className={thBase} style={{ position: "sticky", top: 24, zIndex: 2, background: "var(--d-surface-2)", fontSize: 8.5 }}>
                          {f.label}
                        </th>
                      )),
                    )}
                    <th className={thBase} style={{ position: "sticky", top: 24, zIndex: 2, background: stickyHeadBg }}>QTY</th>
                    <th className={thBase} style={{ position: "sticky", top: 24, zIndex: 2, background: stickyHeadBg }}>VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={row.date} style={{ borderBottom: "1px solid var(--d-border)" }}>
                      <td className="px-2 py-1 text-center font-medium" style={{ position: "sticky", left: 0, zIndex: 1, background: "var(--d-surface)", width: STICKY_DATE_W }}>
                        {shortDate(row.date)}
                      </td>
                      <td className="px-2 py-1 text-center" style={{ position: "sticky", left: STICKY_DATE_W, zIndex: 1, background: "var(--d-surface)", color: "var(--d-muted)", width: STICKY_DAY_W }}>
                        {row.day}
                      </td>
                      {DSR_BRANDS.map((b) => {
                        const fig = row.brands[b];
                        return (
                          <Fragment key={b}>
                            {EDITABLE_FIELDS.map((f) => (
                              <td key={f.field} className="p-0">
                                <EditableCell value={fig[f.field]} onChange={(v) => handleChange(rowIdx, b, f.field, v)} />
                              </td>
                            ))}
                            {TOTAL_FIELDS.map((f) => (
                              <td key={f.field} className="px-2 py-1 text-right font-mono font-semibold" style={{ background: "var(--d-surface-2)", color: "var(--d-ink)" }}>
                                {fig[f.field].toLocaleString("en-IN")}
                              </td>
                            ))}
                          </Fragment>
                        );
                      })}
                      <td className="px-2 py-1 text-right font-mono font-semibold" style={{ background: "var(--d-accent-soft)", color: "var(--d-accent)" }}>{row.grandTotalQty.toLocaleString("en-IN")}</td>
                      <td className="px-2 py-1 text-right font-mono font-semibold" style={{ background: "var(--d-accent-soft)", color: "var(--d-accent)" }}>{row.grandTotalValue.toLocaleString("en-IN")}</td>
                      <td className="px-2 py-1 text-right font-mono" style={{ color: "var(--d-muted)" }}>{row.logicSale.toLocaleString("en-IN")}</td>
                      <td className="px-2 py-1 text-right font-mono" style={{ color: "var(--d-muted)" }}>{row.dukeSale.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Brand-wise summary */}
      <motion.div variants={item}>
        <Card>
          <CardHeader title="Brand-Wise Summary — MTD" subtitle="Units sold per category, across the whole month" />
          <div className="overflow-x-auto px-1 pb-4">
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--d-border)" }}>
                  {["Brand", "FTW", "APP", "ACC", "Total"].map((h) => (
                    <th key={h} className="px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--d-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DSR_BRANDS.map((b) => (
                  <tr key={b} style={{ borderBottom: "1px solid var(--d-border)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--d-ink)" }}>
                      <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: BRAND_COLOR[b] }} />
                      {b}
                    </td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--d-muted)" }}>{summaryTotals[b].ftw.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--d-muted)" }}>{summaryTotals[b].app.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--d-muted)" }}>{summaryTotals[b].acc.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: "var(--d-ink)" }}>{summaryTotals[b].total.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                <tr style={{ background: "var(--d-accent-soft)" }}>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--d-accent)" }}>Total</td>
                  <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: "var(--d-accent)" }}>{categoryTotals.ftw.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: "var(--d-accent)" }}>{categoryTotals.app.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: "var(--d-accent)" }}>{categoryTotals.acc.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: "var(--d-accent)" }}>{categoryTotals.total.toLocaleString("en-IN")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
