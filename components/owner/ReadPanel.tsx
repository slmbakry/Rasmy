"use client";
// Reads one company file with the document reader, lets the owner correct the
// fields, saves them with the file, and offers the read expiry date for the document.
import { useEffect, useRef, useState } from "react";
import { sb } from "@/lib/supabase";
import { fmtDate } from "@/lib/format";
import { loadReader, toIsoDate, type ReadResult } from "@/lib/reader";
import type { CompanyFile } from "@/lib/files";
import { useSession } from "../session";
import { Icon } from "../ui";

const STATE: Record<string, [string, string]> = { ok: ["ok", "مؤكد"], check: ["warn", "راجِعه"], missing: ["", "غير موجود"] };

type Doc = { id: string; title: string; expires_on: string | null; service_id: string } | null;

// Which read type belongs to each document, so a date is only offered for its own document.
const TYPE_OF_SERVICE: Record<string, string> = { cr_renewal: "cr", tax_card_renewal: "tax" };

export default function ReadPanel({ file, doc, onClose, onSaved }: { file: CompanyFile; doc: Doc; onClose: () => void; onSaved: () => void }) {
  const { toast } = useSession();
  const [step, setStep] = useState("تحميل محرك القراءة");
  const [result, setResult] = useState<ReadResult | null>(file.extracted || null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [useExpiry, setUseExpiry] = useState(true);
  const source = useRef<File | null>(null);
  const fresh = useRef(false);

  const run = async (type = "auto") => {
    setFailed(false); setResult(null); setStep("تحميل محرك القراءة");
    try {
      const reader = await loadReader();
      if (!source.current) {
        setStep("فتح الملف");
        const { data, error } = await sb.storage.from("files").download(file.path);
        if (error) throw error;
        source.current = new File([data], file.name, { type: file.mime });
      }
      const r = await reader.read(source.current, { type, onProgress: setStep });
      setResult(r); fresh.current = true;
      setValues(Object.fromEntries(r.fields.map((f) => [f.key, f.value])));
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  };

  useEffect(() => {
    if (file.extracted) setValues(Object.fromEntries(file.extracted.fields.map((f) => [f.key, f.value])));
    else run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  const expiry = result ? toIsoDate(values.expiry || "") : null;
  const matches = !!(doc && result && TYPE_OF_SERVICE[doc.service_id] === result.type);
  const offerExpiry = !!(matches && expiry && expiry !== doc.expires_on);
  const mismatch = !!(doc && result && TYPE_OF_SERVICE[doc.service_id] && !matches);

  const save = async () => {
    setBusy(true);
    const fields = result.fields.map((f) => ({ ...f, value: (values[f.key] ?? "").trim(), state: values[f.key] !== f.value ? (values[f.key]?.trim() ? "ok" : "missing") : f.state }));
    const { error } = await sb.from("company_files").update({ extracted: { type: result.type, label: result.label, fields }, read_at: new Date().toISOString() }).eq("id", file.id);
    if (error) { setBusy(false); return toast("تعذّر حفظ البيانات", true); }
    let note = "تم حفظ البيانات";
    if (offerExpiry && useExpiry) {
      const { error: e2 } = await sb.from("documents").update({ expires_on: expiry }).eq("id", doc.id);
      note = e2 ? "تم حفظ البيانات، لكن تعذّر تحديث تاريخ الانتهاء" : "تم حفظ البيانات وتحديث تاريخ انتهاء المستند";
    }
    // Corrections teach the digit reader, when this read came from it just now.
    try { const r = (window as any).DocReader; if (r && fresh.current) r.learn(values); } catch {}
    setBusy(false); toast(note); onSaved();
  };

  return (
    <section className="panel read-panel">
      <div className="row between">
        <h2><Icon name="docOk" /> قراءة بيانات المستند</h2>
        <button className="linkish" type="button" onClick={onClose}>إغلاق</button>
      </div>
      <small className="note">{file.name}. تتم القراءة على جهازك، ولا تُرسل الصورة إلى أي مكان.</small>
      {failed ? (
        <div className="stack">
          <p>تعذّرت قراءة هذا الملف. جرّب صورة أوضح ومستوية، أو حاول مرة أخرى.</p>
          <button className="btn" type="button" onClick={() => run()}>حاول مرة أخرى</button>
        </div>
      ) : !result ? (
        <div className="reading"><span className="spinner" aria-hidden="true" /><span>{step}</span>
          <small className="note">تستغرق المرة الأولى وقتًا أطول لأن محرك القراءة يُحمَّل.</small></div>
      ) : (
        <>
          <div className="row">
            <label className="note" htmlFor="read-type">نوع المستند</label>
            <select id="read-type" value={result.type} onChange={(e) => run(e.target.value)}>
              {[["id", "بطاقة الرقم القومي"], ["tax", "البطاقة الضريبية"], ["cr", "السجل التجاري"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {file.read_at && <small className="note">آخر قراءة {fmtDate(file.read_at)}</small>}
          </div>
          <div className="read-fields">
            {result.fields.map((f) => (
              <div className="field" key={f.key}>
                <label htmlFor={`rf-${f.key}`}>{f.label} <span className={`chip ${STATE[f.state][0]}`}>{STATE[f.state][1]}</span></label>
                <input id={`rf-${f.key}`} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
          {offerExpiry && (
            <label className="check"><input type="checkbox" checked={useExpiry} onChange={(e) => setUseExpiry(e.target.checked)} />
              تحديث تاريخ انتهاء «{doc.title}» إلى {fmtDate(expiry)}{doc.expires_on ? `، بدلًا من ${fmtDate(doc.expires_on)}` : ""}</label>
          )}
          {mismatch && <p className="alert">قُرئ هذا الملف على أنه {result.label}، وهو محفوظ تحت «{doc.title}». غيّر نوع المستند إذا كانت القراءة خاطئة، أو انقل الملف إلى المستند الصحيح.</p>}
          <p className="note">راجِع البيانات قبل الحفظ. إذا صحّحت رقمًا، يتعلّم القارئ شكله ليصبح أدق في المرة القادمة.</p>
          <div className="row">
            <button className="btn primary" type="button" disabled={busy} onClick={save}>حفظ البيانات</button>
            {file.extracted && <button className="btn" type="button" onClick={() => run(result.type)}>إعادة القراءة</button>}
          </div>
        </>
      )}
    </section>
  );
}
