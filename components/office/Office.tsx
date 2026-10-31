"use client";
// Office screens: incoming requests, accepting or declining, finishing stages, files and notes.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { days, fmtDate, money } from "@/lib/format";
import { EVENTS, STATUS, services, sortStages, stageLate } from "@/lib/data";
import { useLoad, useSession } from "../session";
import { FilesBlock, Head, Kpi, LoadError, Loading, StageRow, finishStage } from "../ui";

function NoOffice() {
  const { profile } = useSession();
  return <section className="panel"><p>{profile.role === "admin" ? "اختر المكتب الذي تريد التجربة به من الشريط في الأعلى." : "حسابك غير مرتبط بمكتب بعد. تواصل مع مدير المنصة."}</p></section>;
}

// Days late on the stage in progress, if any.
const lateOf = (r) => { const st = sortStages(r.request_stages).find((x) => !x.done_at); return st ? stageLate(st) : 0; };
const working = (r) => ["accepted", "in_progress"].includes(r.status);

export function OfficeHome() {
  const { officeId } = useSession();
  const { data, error } = useLoad(async () => {
    if (!officeId) return null;
    const svcs = await services();
    const [{ data: office }, { data: reqs }] = await Promise.all([
      sb.from("offices").select("name").eq("id", officeId).maybeSingle(),
      sb.from("requests").select("*, companies(name), request_stages(idx,title,planned_days,started_at,done_at)").eq("office_id", officeId).order("created_at", { ascending: false }),
    ]);
    return { svcs, office, all: reqs || [] };
  }, [officeId]);
  if (!officeId) return <NoOffice />;
  if (error) return <LoadError />;
  if (!data) return <Loading />;
  const { svcs, office, all } = data;
  const groups: [string, string, any[]][] = [
    ["new", "طلبات جديدة بانتظار ردك", all.filter((r) => r.status === "new")],
    ["work", "قيد التنفيذ", all.filter(working)],
    ["done", "مكتملة", all.filter((r) => r.status === "done").slice(0, 10)],
  ];
  const lateCount = groups[1][2].filter((r) => lateOf(r)).length;
  return (
    <>
      <Head eyebrow={office?.name || "المكتب"} title="الطلبات"><p>اقبل الطلب أولًا، ثم حدّد كل مرحلة عند اكتمالها. يرى صاحب العمل التحديث في اللحظة نفسها.</p></Head>
      <div className="kpis">
        <Kpi ic="mail" tone={groups[0][2].length ? "warn" : ""} value={groups[0][2].length} label="طلب جديد" />
        <Kpi ic="list" value={groups[1][2].length} label="قيد التنفيذ" />
        <Kpi ic="alert" tone={lateCount ? "bad" : "ok"} value={lateCount} label="متأخر" />
        <Kpi ic="check" tone="ok" value={all.filter((r) => r.status === "done").length} label="مكتمل" />
      </div>
      {groups.map(([k, title, list]) => (
        <section key={k} className="panel"><h2>{title}</h2>
          {list.length ? <div className="reqs">{list.map((r) => <Card key={r.id} r={r} title={svcs[r.service_id]?.title || r.service_id} />)}</div>
            : <p className="empty">{k === "new" ? "لا توجد طلبات جديدة." : "لا يوجد شيء هنا."}</p>}
        </section>
      ))}
    </>
  );
}

function Card({ r, title }) {
  const st = sortStages(r.request_stages);
  const done = st.filter((x) => x.done_at).length, late = working(r) ? lateOf(r) : 0;
  return (
    <Link className={"req" + (late ? " late" : "")} href={`/office/jobs/${r.id}`}>
      <div className="row between"><b>{title}</b>
        {late ? <span className="chip bad">متأخر {days(late)}</span> : <span className={`chip ${STATUS[r.status][0]}`}>{STATUS[r.status][1]}</span>}</div>
      <small>{r.companies?.name || ""} · {money(r.quoted_fee)} · {days(r.quoted_days || 0)}{r.is_demo ? " · تجريبي" : ""}</small>
      {st.length > 0 && <div className="meter"><i style={{ width: `${Math.round((done / st.length) * 100)}%` }} /></div>}
    </Link>
  );
}

export function Job({ id }: { id: string }) {
  const router = useRouter();
  const { officeId, uid, toast } = useSession();
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState("");
  const [note, setNote] = useState("");
  const { data, error, reload } = useLoad(async () => {
    if (!officeId) return null;
    const svcs = await services();
    const [{ data: r }, { data: stages }, { data: events }] = await Promise.all([
      sb.from("requests").select("*, companies(name,legal_form)").eq("id", id).eq("office_id", officeId).maybeSingle(),
      sb.from("request_stages").select("*").eq("request_id", id).order("idx"),
      sb.from("events").select("*").eq("request_id", id).order("created_at"),
    ]);
    if (!r) return { r: null };
    const { data: owner } = await sb.from("profiles").select("email").eq("id", r.owner_id).maybeSingle();
    return { r, s: svcs[r.service_id], stages: stages || [], events: events || [], owner };
  }, [id, officeId]);
  if (!officeId) return <NoOffice />;
  if (error) return <LoadError />;
  if (!data) return <Loading />;
  const { r, s, stages, events, owner } = data;
  if (!r) return <section className="panel"><p>هذا الطلب غير موجود.</p><Link className="btn" href="/">العودة إلى الطلبات</Link></section>;

  const isWorking = working(r);
  const cur = stages.findIndex((x) => !x.done_at);
  const log = (kind: string, text?: string) => sb.from("events").insert({ request_id: id, actor_id: uid, kind, note: text || null });

  const accept = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await sb.from("requests").update({ status: "accepted", accepted_at: now }).eq("id", id).eq("status", "new");
    if (error) { setBusy(false); return toast("تعذّر قبول الطلب", true); }
    if (stages[0]) await sb.from("request_stages").update({ started_at: now }).eq("id", stages[0].id).is("started_at", null);
    await log("accepted");
    setBusy(false); toast("تم قبول الطلب، وبدأت المرحلة الأولى"); reload();
  };
  const decline = async () => {
    if (!why.trim()) return toast("اكتب سبب الاعتذار أولًا", true);
    const { error } = await sb.from("requests").update({ status: "cancelled" }).eq("id", id).eq("status", "new");
    if (error) return toast("تعذّر تسجيل الاعتذار", true);
    await log("declined", why.trim());
    toast("تم تسجيل الاعتذار"); router.push("/");
  };
  const finish = async (st) => {
    const { error } = await finishStage(st);
    if (error) return toast("تعذّر تحديث المرحلة", true);
    toast(stages.filter((x) => !x.done_at).length === 1 ? "اكتمل الطلب بالكامل" : "اكتملت المرحلة"); reload();
  };
  const sendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await log("note", note.trim());
    if (error) return toast("تعذّر إرسال الملاحظة", true);
    setNote(""); toast("تم إرسال الملاحظة"); reload();
  };

  return (
    <>
      <Head back={["/", "الطلبات"]} eyebrow={r.companies?.name || ""} title={s?.title || r.service_id}>
        <p>{r.status === "new" ? "اقبل الطلب لتبدأ المرحلة الأولى، أو اعتذر مع ذكر السبب." : isWorking ? "حدّد المرحلة عند اكتمالها، وستبدأ المرحلة التالية تلقائيًا." : ""}</p>
      </Head>
      {r.status === "new" && (
        <section className="panel"><h2>رد على الطلب</h2>
          <div className="row"><button className="btn primary" type="button" disabled={busy} onClick={accept}>اقبل الطلب</button></div>
          <div className="field"><label htmlFor="why">إذا كنت ستعتذر، فاكتب السبب</label><input id="why" value={why} onChange={(e) => setWhy(e.target.value)} /></div>
          <button className="btn danger small" type="button" onClick={decline}>اعتذر عن الطلب</button>
        </section>
      )}
      <div className="grid2 wide">
        <section className="panel">
          <div className="row between"><h2>المراحل</h2><span className={`chip ${STATUS[r.status][0]}`}>{STATUS[r.status][1]}</span></div>
          <div className="track">
            {stages.map((x, i) => <StageRow key={x.id} stage={x} isNow={i === cur && isWorking} onFinish={i === cur && isWorking ? () => finish(x) : undefined} />)}
          </div>
          {isWorking && (
            <form className="stack" onSubmit={sendNote}>
              <div className="field"><label htmlFor="note">ملاحظة لصاحب العمل</label><input id="note" required value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <button className="btn small" type="submit">إرسال الملاحظة</button>
            </form>
          )}
        </section>
        <section className="panel"><h2>التفاصيل</h2>
          <div className="kv"><span>صاحب العمل</span><b className="ltr">{owner?.email || ""}</b></div>
          {r.companies?.legal_form && <div className="kv"><span>الشكل القانوني</span><b>{r.companies.legal_form}</b></div>}
          <div className="kv"><span>التكلفة المعلنة</span><b>{money(r.quoted_fee)}</b></div>
          <div className="kv"><span>المدة المعلنة</span><b>{days(r.quoted_days || 0)}</b></div>
          <div className="kv"><span>تاريخ الطلب</span><b>{fmtDate(r.created_at)}</b></div>
          {s?.docs?.length > 0 && <div className="docs"><b>المستندات المطلوبة</b><ul>{s.docs.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          <div><FilesBlock requestId={id} /></div>
          <h3 className="sub">سجل النشاط</h3>
          {events.map((e) => <div key={e.id} className="kv"><span>{EVENTS[e.kind] || e.kind}{e.note ? ": " + e.note : ""}</span><small>{fmtDate(e.created_at)}</small></div>)}
        </section>
      </div>
    </>
  );
}
