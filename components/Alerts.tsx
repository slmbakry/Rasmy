"use client";
// Notifications for the role the person is acting as; opening them marks them read.
import Link from "next/link";
import { useEffect } from "react";
import { sb } from "@/lib/supabase";
import { fmtDate } from "@/lib/format";
import { pathFor } from "@/lib/storage";
import { scopedNotes } from "./Shell";
import { useLoad, useSession } from "./session";
import { Head, LoadError, Loading } from "./ui";

const TONE = { late: "bad", overdue: "bad", expired: "bad", escalated: "bad", declined: "bad", renew: "warn", wait: "warn", done: "ok", accepted: "ok" };

export default function Alerts() {
  const { role, uid, officeId, refreshBell } = useSession();
  const { data, error } = useLoad(async () => {
    const q = scopedNotes(sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(60), role, uid, officeId);
    const { data } = q ? await q : { data: [] };
    return data || [];
  }, [role, uid, officeId]);
  useEffect(() => {
    const unread = (data || []).filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length) sb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread).then(refreshBell);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  return (
    <>
      <Head eyebrow="التنبيهات" title="ما تحتاج إلى معرفته"><p>تصلك التنبيهات عند حدوث تغيير في طلباتك، أو تأخر إحدى المراحل، أو اقتراب انتهاء أحد المستندات.</p></Head>
      <section className="panel">
        {error ? <LoadError /> : !data ? <Loading /> : data.length ? (
          <div className="alerts">{data.map((n) => (
            <Link key={n.id} className={`alert-row ${TONE[n.kind] || ""}${n.read_at ? "" : " unread"}`} href={pathFor(n.link || "#home")}>
              <span className="dot" aria-hidden="true" /><div><b>{n.title}</b>{n.body && <small>{n.body}</small>}</div><small className="when">{fmtDate(n.created_at)}</small>
            </Link>
          ))}</div>
        ) : <p className="empty">لا توجد تنبيهات بعد.</p>}
      </section>
    </>
  );
}
