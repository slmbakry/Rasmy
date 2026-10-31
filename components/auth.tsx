"use client";
// Sign-in is by password. The emailed link is for the first visit and for a
// forgotten password; after it the person sets a password once.
import { useState } from "react";
import { sb } from "@/lib/supabase";
import { writeSession } from "@/lib/storage";
import { useSession } from "./session";
import { Icon } from "./ui";

const back = () => location.origin + "/";

export function Login() {
  const { toast } = useSession();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const emailOf = () => {
    const v = email.trim();
    if (!v) toast("اكتب بريدك الإلكتروني أولًا", true);
    return v;
  };
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email: emailOf(), password: pass });
    setBusy(false);
    if (error) toast(error.status === 400 ? "البريد الإلكتروني أو كلمة المرور غير صحيحة. إذا كانت هذه أول مرة تدخل فيها، فاطلب رابط الدخول." : "تعذّر تسجيل الدخول، حاول مرة أخرى", true);
  };
  const first = async () => {
    const v = emailOf(); if (!v) return;
    const { error } = await sb.auth.signInWithOtp({ email: v, options: { emailRedirectTo: back() } });
    if (error) return toast("تعذّر إرسال الرابط، حاول مرة أخرى بعد قليل", true);
    setSent("أرسلنا إليك رابط الدخول. بعد الدخول ستنشئ كلمة مرور، ولن تحتاج إلى الرابط مرة أخرى.");
  };
  const forgot = async () => {
    const v = emailOf(); if (!v) return;
    const { error } = await sb.auth.resetPasswordForEmail(v, { redirectTo: back() });
    if (error) return toast("تعذّر إرسال الرابط، حاول مرة أخرى بعد قليل", true);
    setSent("أرسلنا إليك رابطًا لإنشاء كلمة مرور جديدة.");
  };

  if (sent) return (
    <section className="panel auth">
      <h1 style={{ fontSize: 24 }}>تحقق من بريدك</h1><p>{sent}</p><p className="ltr"><b>{email.trim()}</b></p>
      <p className="note">إذا لم تجده، فابحث في الرسائل غير المرغوب فيها.</p>
      <button className="linkish" type="button" onClick={() => setSent(null)}>العودة إلى تسجيل الدخول</button>
    </section>
  );

  return (
    <div className="landing">
      <section className="landing-top">
        <div className="landing-t">
          <span className="eyebrow">ورقك أسهل</span>
          <h1>كل مستندات شركتك في مكان واحد، ولن يفوتك أي موعد</h1>
          <p>يذكّرك ورقك قبل انتهاء أي مستند، ويوضح لك هل تنفذ الخطوة بنفسك أم مع مكتب، وبأي تكلفة وفي أي مدة. وإذا اخترت مكتبًا، تتابع عمله خطوة بخطوة.</p>
          <div className="perks">
            <span><Icon name="check" size={16} />تذكير قبل كل تجديد</span>
            <span><Icon name="check" size={16} />أسعار المكاتب ومددها أمامك</span>
            <span><Icon name="check" size={16} />تقييم حقيقي لالتزام كل مكتب</span>
          </div>
        </div>
        <section className="panel auth">
          <h2>تسجيل الدخول</h2>
          <p className="note">هذه نسخة تجريبية، والدخول بدعوة فقط.</p>
          <form className="stack" onSubmit={login}>
            <div className="field"><label htmlFor="email">البريد الإلكتروني</label><input id="email" type="email" className="ltr" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="pass">كلمة المرور</label><input id="pass" type="password" className="ltr" required autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
            <button className="btn primary" type="submit" disabled={busy}>دخول</button>
          </form>
          <div className="auth-links">
            <button className="linkish" type="button" onClick={first}>أول مرة؟ أرسل لي رابط الدخول</button>
            <button className="linkish" type="button" onClick={forgot}>نسيت كلمة المرور</button>
          </div>
        </section>
      </section>
      <section className="landing-how">
        <h2>ثلاث خطوات لتطمئن على شركتك</h2>
        <div className="how">
          <div><span className="tile-ic"><Icon name="doc" size={24} /></span><b>أضف شركتك ومستنداتها</b><p>السجل التجاري والبطاقة الضريبية والتراخيص، وتاريخ انتهاء كل منها.</p></div>
          <div><span className="tile-ic warn"><Icon name="bell" size={24} /></span><b>انتظر التذكير</b><p>نذكّرك في الوقت الذي يجب أن تبدأ فيه، لا في يوم الانتهاء.</p></div>
          <div><span className="tile-ic ok"><Icon name="pulse" size={24} /></span><b>اختر وتابع</b><p>نفّذها بنفسك أو اختر مكتبًا، وتابع كل مرحلة حتى تكتمل.</p></div>
        </div>
      </section>
    </div>
  );
}

export function SetPassword({ onDone }: { onDone: () => void }) {
  const { toast, hasPassword, recovery, passwordSaved } = useSession();
  const fresh = !hasPassword && !recovery;
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (p1 !== p2) return toast("كلمتا المرور غير متطابقتين", true);
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: p1, data: { has_password: true } });
    setBusy(false);
    if (error) return toast(error.code === "weak_password" ? "كلمة المرور ضعيفة، اختر كلمة أطول" : error.code === "same_password" ? "هذه هي كلمة المرور القديمة نفسها" : "تعذّر حفظ كلمة المرور", true);
    passwordSaved();
    toast("تم حفظ كلمة المرور");
  };
  return (
    <section className="panel auth">
      <span className="eyebrow">{fresh ? "خطوة واحدة" : "كلمة مرور جديدة"}</span>
      <h1 style={{ fontSize: 24 }}>{fresh ? "أنشئ كلمة مرور" : "اكتب كلمة المرور الجديدة"}</h1>
      <p className="note">{fresh ? "بعدها ستدخل بها مباشرة، دون انتظار رسالة على بريدك." : "ستستخدمها في الدخول من الآن."}</p>
      <form className="stack" onSubmit={save}>
        <div className="field"><label htmlFor="p1">كلمة المرور</label><input id="p1" type="password" className="ltr" minLength={8} required autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
        <div className="field"><label htmlFor="p2">أعد كتابتها</label><input id="p2" type="password" className="ltr" minLength={8} required autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
        <p className="note">٨ حروف أو أرقام على الأقل.</p>
        <button className="btn primary" type="submit" disabled={busy}>حفظ</button>
      </form>
      {fresh && <button className="linkish" type="button" onClick={() => { writeSession("rasmy-skip-password", "1"); onDone(); }}>ليس الآن</button>}
    </section>
  );
}

export function NotInvited() {
  const { profile } = useSession();
  return (
    <section className="panel auth">
      <h1 style={{ fontSize: 24 }}>هذا الحساب غير مدعو بعد</h1>
      <p>النسخة التجريبية متاحة بالدعوة فقط. اطلب من مدير المنصة إرسال دعوة إلى هذا البريد:</p>
      <p className="ltr"><b>{profile.email}</b></p>
    </section>
  );
}

export function Consent() {
  const { profile, setProfile, toast } = useSession();
  const [agree, setAgree] = useState(false);
  const go = async () => {
    const now = new Date().toISOString();
    const { error } = await sb.from("profiles").update({ consent_at: now }).eq("id", profile.id);
    if (error) return toast("تعذّر حفظ موافقتك، حاول مرة أخرى", true);
    setProfile({ ...profile, consent_at: now });
  };
  return (
    <section className="panel auth">
      <span className="eyebrow">قبل أن تبدأ</span>
      <h1 style={{ fontSize: 24 }}>بياناتك وطريقة استخدامها</h1>
      <p>ستحفظ المنصة بيانات شركاتك ومستنداتها وطلباتك، لنعرض لك خطواتك ونذكّرك بمواعيد التجديد.</p>
      <p>لا يرى المكتب الذي تختاره إلا بيانات الطلب المسند إليه، ولا يطّلع عليها أحد غيره.</p>
      <p>يمكنك طلب حذف بياناتك في أي وقت.</p>
      <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> أوافق على حفظ بياناتي واستخدامها بهذه الطريقة</label>
      <button className="btn primary" type="button" disabled={!agree} onClick={go}>ابدأ</button>
    </section>
  );
}
