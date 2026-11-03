// Recurring obligations for one company: which rules apply to it, and each
// period's due date within a window around today.
import { DAY, today } from "./format";

export type Rule = { id: string; title: string; why: string; agency: string; frequency: "monthly" | "quarterly" | "annual";
  due: { type: "month_end" | "day" | "fy_months" | "fixed"; after?: number; day?: number; months?: number; month?: number };
  applies: { entity?: "natural" | "company"; vat?: boolean; employees?: boolean; simplified?: boolean };
  certainty: "sourced" | "estimated"; source_title: string | null; source_url: string | null; checked_on: string };

export type Profile = { legal_form: string | null; vat_registered: boolean | null; has_employees: boolean | null;
  simplified_tax: boolean | null; fiscal_year_end: number };

export type Occurrence = { rule: Rule; period: string; label: string; due: Date };

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const QUARTERS = ["الربع الأول", "الربع الثاني", "الربع الثالث", "الربع الرابع"];
const yr = (y: number) => y.toLocaleString("ar-EG", { useGrouping: false });

export const entityOf = (p: Profile) => (p.legal_form === "منشأة فردية" ? "natural" : "company");

// The questions still unanswered that decide which rules apply.
export const missingAnswers = (p: Profile) => ({ vat: p.vat_registered === null, employees: p.has_employees === null });

// Unknown answers keep a rule out, except the simplified regime, which is opt-in.
export function applies(rule: Rule, p: Profile) {
  const a = rule.applies;
  if (a.entity && a.entity !== entityOf(p)) return false;
  if (a.vat !== undefined && p.vat_registered !== a.vat) return false;
  if (a.employees !== undefined && p.has_employees !== a.employees) return false;
  if (a.simplified !== undefined && !!p.simplified_tax !== a.simplified) return false;
  return true;
}

const endOfMonth = (y: number, m: number) => new Date(y, m + 1, 0); // m is 0-based and may overflow

function dueFor(rule: Rule, endYear: number, endMonth: number): Date {
  const d = rule.due;
  if (d.type === "month_end") return endOfMonth(endYear, endMonth + (d.after || 0));
  if (d.type === "day") return new Date(endYear, endMonth + (d.after || 0), d.day || 1);
  if (d.type === "fy_months") return endOfMonth(endYear, endMonth + (d.months || 0));
  return new Date(endYear + 1, (d.month || 1) - 1, d.day || 1);
}

// Every period of the rule whose due date falls from `back` days ago to `ahead` days from now.
export function occurrences(rule: Rule, p: Profile, back = 60, ahead = 365): Occurrence[] {
  const t = today().getTime(), from = t - back * DAY, to = t + ahead * DAY, out: Occurrence[] = [];
  const now = new Date(), y0 = now.getFullYear();
  if (rule.frequency === "monthly") {
    for (let i = -4; i <= 13; i++) {
      const dt = new Date(y0, now.getMonth() + i, 1), y = dt.getFullYear(), m = dt.getMonth();
      out.push({ rule, period: `${y}-${String(m + 1).padStart(2, "0")}`, label: `عن شهر ${MONTHS[m]} ${yr(y)}`, due: dueFor(rule, y, m) });
    }
  } else if (rule.frequency === "quarterly") {
    for (let y = y0 - 1; y <= y0 + 1; y++) for (let q = 0; q < 4; q++)
      out.push({ rule, period: `${y}-Q${q + 1}`, label: `عن ${QUARTERS[q]} ${yr(y)}`, due: dueFor(rule, y, q * 3 + 2) });
  } else {
    const calendar = rule.due.type === "fixed";
    for (let y = y0 - 1; y <= y0 + 1; y++) {
      const endMonth = calendar ? 11 : p.fiscal_year_end - 1;
      out.push({ rule, period: `${y}`, label: calendar || p.fiscal_year_end === 12 ? `عن سنة ${yr(y)}` : `عن السنة المالية المنتهية في ${MONTHS[endMonth]} ${yr(y)}`, due: dueFor(rule, y, endMonth) });
    }
  }
  return out.filter((o) => o.due.getTime() >= from && o.due.getTime() <= to);
}
