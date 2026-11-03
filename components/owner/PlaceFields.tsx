"use client";
// The company's governorate, commercial registry office and tax office,
// with names already in use offered so the same office is spelled one way.
import { sb } from "@/lib/supabase";
import { GOVERNORATES } from "@/lib/places";
import { useLoad } from "../session";

type Values = { governorate?: string | null; registry_office?: string | null; tax_office?: string | null };

export default function PlaceFields({ values }: { values?: Values }) {
  const { data } = useLoad(async () => {
    const [{ data: reg }, { data: tax }] = await Promise.all([
      sb.rpc("place_names", { p_kind: "registry" }), sb.rpc("place_names", { p_kind: "tax_office" }),
    ]);
    return { reg: (reg || []) as string[], tax: (tax || []) as string[] };
  }, []);
  return (
    <>
      <div className="form-row three">
        <div className="field"><label htmlFor="c-gov">المحافظة</label>
          <select id="c-gov" name="governorate" defaultValue={values?.governorate || ""}>
            <option value="">اختر المحافظة</option>
            {GOVERNORATES.map((g) => <option key={g}>{g}</option>)}
          </select></div>
        <div className="field"><label htmlFor="c-reg">مكتب السجل التجاري</label>
          <input id="c-reg" name="registry_office" list="reg-names" placeholder="مثلًا: مدينة نصر" defaultValue={values?.registry_office || ""} />
          <datalist id="reg-names">{data?.reg.map((n) => <option key={n} value={n} />)}</datalist></div>
        <div className="field"><label htmlFor="c-tax">المأمورية</label>
          <input id="c-tax" name="tax_office" list="tax-names" placeholder="مثلًا: مدينة نصر أول" defaultValue={values?.tax_office || ""} />
          <datalist id="tax-names">{data?.tax.map((n) => <option key={n} value={n} />)}</datalist></div>
      </div>
      <small className="note">الإجراءات والمستندات المطلوبة تختلف من جهة لأخرى، لذلك نعرض لك ما أكده المتعاملون مع جهاتك. إذا لم تعرفها الآن، يمكنك إضافتها لاحقًا، أو قراءتها من صورة البطاقة الضريبية والسجل التجاري.</small>
    </>
  );
}

// Form values for the three places, empty ones stored as null.
export const placesFrom = (f: FormData) => Object.fromEntries(
  ["governorate", "registry_office", "tax_office"].map((k) => [k, String(f.get(k) || "").trim() || null]));
