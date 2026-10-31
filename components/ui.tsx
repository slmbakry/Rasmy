"use client";
// Small building blocks shared by every screen.
import Link from "next/link";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { days, fmtDate, initial, money, num } from "@/lib/format";
import { optionLabel, stageLate, type Option, type Stage } from "@/lib/data";
import { useLoad, useSession } from "./session";

// Stroke icons, sized by the surrounding text and colored with currentColor.
const ICONS: Record<string, React.ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  doc: <path d="M7 3h7l5 5v13H7zM14 3v5h5" />,
  docOk: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 14l2 2 4-4" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  alert: <path d="M12 4l9 16H3zM12 10v4M12 17.2v.3" />,
  list: <path d="M4 7h16M4 12h10M4 17h7M16 16l2 2 3-4" />,
  arrow: <path d="M4 12h12M12 6l6 6-6 6" />,
  bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0" />,
  home: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  building: <path d="M5 21V5l7-2v18M12 8h7v13M8 8v.5M8 12v.5M8 16v.5M15 12v.5M15 16v.5M3 21h18" />,
  person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" /></>,
  star: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  mail: <path d="M3 6h18v12H3zM3 7l9 6 9-6" />,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.9-3.2 3.2-5 6-5s5.1 1.8 6 5M16 5.5a3 3 0 0 1 0 5.5M18 15c1.6.6 2.7 2.2 3 5" /></>,
  pulse: <path d="M4 12h4l3-7 4 14 3-7h2" />,
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg className="ic" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

export const Loading = () => <div className="loading">جارٍ التحميل</div>;
export const LoadError = () => <section className="panel"><p>حدثت مشكلة أثناء تحميل الصفحة. حدّث الصفحة وحاول مرة أخرى.</p></section>;

export function Kpi({ ic, tone = "", value, label }: { ic: string; tone?: string; value: React.ReactNode; label: React.ReactNode }) {
  return (
    <div className={`kpi ${tone}`}>
      <span className={`tile-ic ${tone}`}><Icon name={ic} size={22} /></span>
      <div><b>{typeof value === "number" ? num(value) : value}</b><span>{label}</span></div>
    </div>
  );
}

// The navy band at the top of each screen.
export function Head({ eyebrow, title, back, className = "", children }: { eyebrow?: React.ReactNode; title?: React.ReactNode; back?: [string, string]; className?: string; children?: React.ReactNode }) {
  return (
    <section className={`head ${className}`.trim()}>
      {back && <Link className="back" href={back[0]}>→ {back[1]}</Link>}
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      {title && <h1>{title}</h1>}
      {children}
    </section>
  );
}

export function Avatar({ name, self }: { name?: string | null; self?: boolean }) {
  return <span className="avatar">{self ? <Icon name="person" /> : initial(name)}</span>;
}

// The doers for one service as radio cards, marked cheapest, fastest and best rated.
export function OptionCards({ opts, name, picked, onPick }: { opts: Option[]; name: string; picked: string; onPick: (key: string) => void }) {
  const cheap = Math.min(...opts.map((o) => o.cost)), fast = Math.min(...opts.map((o) => o.days));
  const rated = opts.filter((o) => o.count).sort((a, b) => b.pro + b.speed - (a.pro + a.speed))[0];
  return (
    <div className="opt-cards" role="radiogroup">
      {opts.map((o) => {
        const tags = [o.cost === cheap && "الأرخص", o.days === fast && "الأسرع", rated && o.key === rated.key && "الأعلى تقييماً"].filter(Boolean) as string[];
        return (
          <label key={o.key} className={"opt-card" + (o.key === picked ? " on" : "")}>
            <input type="radio" name={name} value={o.key} checked={o.key === picked} onChange={() => onPick(o.key)} />
            <span className="oc-top"><Avatar name={o.label} self={!o.officeId} /><span className="oc-n"><b>{o.label}</b><small>{optionLabel(o)}</small></span></span>
            {tags.length > 0 && <span className="chips">{tags.map((t) => <span key={t} className="chip ok">{t}</span>)}</span>}
            <span className="oc-v"><span><small>التكلفة</small><b>{money(o.cost)}</b></span><span><small>المدة</small><b>{days(o.days)}</b></span></span>
          </label>
        );
      })}
    </div>
  );
}

// One row of the stage track, shared by the owner and office screens.
export function StageRow({ stage, isNow, onFinish }: { stage: Stage; isNow: boolean; onFinish?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const late = isNow ? stageLate(stage) : 0;
  const note = stage.done_at ? "اكتملت في " + fmtDate(stage.done_at) : late ? `متأخرة ${days(late)}` : "المدة المتوقعة " + days(stage.planned_days);
  return (
    <div className={`tr ${stage.done_at ? "done" : isNow ? "now" : ""}${late ? " late" : ""}`}>
      <span className="dot" aria-hidden="true" />
      <div><p>{stage.title}</p><small className="note">{note}</small></div>
      {onFinish && <button className="btn small" type="button" disabled={busy} onClick={async () => { setBusy(true); await onFinish(); setBusy(false); }}>تمت</button>}
    </div>
  );
}

// Finishing a stage is a single update: database triggers start the next
// stage, log events, close the request and extend or add the document.
export async function finishStage(stage: Stage & { id: string }) {
  const now = new Date().toISOString();
  return sb.from("request_stages").update({ done_at: now, started_at: stage.started_at || now }).eq("id", stage.id);
}

// Files attached to a request, readable by everyone who can see the request.
export function FilesBlock({ requestId }: { requestId: string }) {
  const { toast, uid } = useSession();
  const prefix = `requests/${requestId}`;
  const { data: files, reload } = useLoad(async () => {
    const { data } = await sb.storage.from("files").list(prefix, { sortBy: { column: "created_at", order: "desc" } });
    return (data || []).filter((f) => f.name !== ".emptyFolderPlaceholder");
  }, [prefix]);
  const open = async (name: string) => {
    const { data: s, error } = await sb.storage.from("files").createSignedUrl(`${prefix}/${name}`, 300);
    if (error) return toast("تعذّر فتح الملف", true);
    window.open(s.signedUrl, "_blank", "noopener");
  };
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast("حجم الملف أكبر من ١٠ ميجابايت", true);
    const safe = f.name.replace(/[^\w.\-؀-ۿ]+/g, "_");
    const { error } = await sb.storage.from("files").upload(`${prefix}/${Date.now()}-${safe}`, f);
    if (error) return toast("تعذّر رفع الملف", true);
    await sb.from("events").insert({ request_id: requestId, actor_id: uid, kind: "file", note: f.name });
    toast("تم رفع الملف"); reload();
  };
  return (
    <>
      <h3 className="sub">الملفات</h3>
      {!files ? <Loading /> : files.length ? files.map((f) => (
        <div className="kv" key={f.name}><span>{f.name.replace(/^\d+-/, "")}</span><button className="btn small" type="button" onClick={() => open(f.name)}>عرض</button></div>
      )) : <p className="empty">لا توجد ملفات بعد.</p>}
      <label className="btn small" htmlFor={`up-${requestId}`}>ارفع ملف</label>
      <input type="file" id={`up-${requestId}`} hidden onChange={upload} />
    </>
  );
}
