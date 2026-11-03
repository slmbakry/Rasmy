"use client";
// The owner's companies and the one they are looking at, shared by every
// owner screen so switching company in one place carries everywhere.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useSession } from "./session";

export type Company = { id: string; name: string; legal_form: string | null; status: string; is_demo: boolean; plan: string;
  governorate: string | null; registry_office: string | null; tax_office: string | null; created_at: string;
  vat_registered: boolean | null; has_employees: boolean | null; simplified_tax: boolean | null; fiscal_year_end: number; reminders_on: boolean };

type Companies = { list: Company[] | null; current: Company | null; pick: (id: string) => void; reload: () => void };
const Ctx = createContext<Companies>({ list: null, current: null, pick: () => {}, reload: () => {} });
export const useCompanies = () => useContext(Ctx);

const KEY = "waraqak-company";
const readKey = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const writeKey = (id: string) => { try { localStorage.setItem(KEY, id); } catch {} };

export function CompaniesProvider({ children }: { children: React.ReactNode }) {
  const { uid, role } = useSession();
  const [list, setList] = useState<Company[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (role !== "owner" || !uid) { setList([]); return; }
    const { data } = await sb.from("companies").select("*").eq("owner_id", uid).neq("status", "closed").order("created_at");
    setList((data || []) as Company[]);
  }, [uid, role]);

  useEffect(() => { setChosen(readKey()); reload(); }, [reload]);

  const current = list?.find((c) => c.id === chosen) || list?.[0] || null;
  const pick = (id: string) => { setChosen(id); writeKey(id); };
  return <Ctx.Provider value={{ list, current, pick, reload }}>{children}</Ctx.Provider>;
}

// A compact company picker for owner screens, shown only when there is more than one.
export function CompanySwitch() {
  const { list, current, pick } = useCompanies();
  if (!list || list.length < 2 || !current) return null;
  return (
    <label className="co-switch">
      <span className="sr-only">الشركة</span>
      <select value={current.id} onChange={(e) => pick(e.target.value)} aria-label="الشركة">
        {list.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_demo ? " · تجريبي" : ""}</option>)}
      </select>
    </label>
  );
}
