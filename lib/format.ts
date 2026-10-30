// Arabic formatting for numbers, money, dates and spans of days.
export const DAY = 864e5;

export const num = (n: number | string | null | undefined) => Number(n || 0).toLocaleString("ar-EG");
export const fmtDate = (d: string | number | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }) : "";
export const money = (n: number | string | null | undefined) => (Number(n) > 0 ? num(Math.round(Number(n))) + " جنيه" : "بدون رسوم");
export const days = (n: number) => (n === 1 ? "يوم واحد" : n === 2 ? "يومين" : num(n) + (n <= 10 ? " أيام" : " يوم"));
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// A span of days in plain words: months past two months, days before that.
export const span = (n: number) => (n >= 60 ? (Math.round(n / 30) === 1 ? "شهر" : num(Math.round(n / 30)) + " شهر") : days(n));

// The first letter of an office name, for its avatar.
export const initial = (name?: string | null) => (name || "م").replace(/^مكتب\s+/, "").charAt(0);
