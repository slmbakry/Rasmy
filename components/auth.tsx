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
    if (!v) toast("اكتب بريدك الأول", true);
    return v;
  };
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email: emailOf(), password: pass });
    setBusy(false);
    if (error) toast(error.status === 400 ? "البريد أو كلمة السر غلط. لو أول مرة تدخل، اطلب رابط الدخول." : "ماقدرناش ندخلك، جرب تاني", true);
  };
  const first = async () => {
    const v = emailOf(); if (!v) return;
    const { error } = await sb.auth.signInWithOtp({ email: v, options: { emailRedirectTo: back() } });
    if (error) return toast("ماقدرناش نبعت الرابط، جرب تاني بعد شوية", true);
    setSent("بعتنالك رابط الدخول. بعد ما تدخل هتعمل كلمة سر، ومش هتحتاج الرابط تاني.");
  };
  const forgot = async () => {
    const v = emailOf(); if (!v) return;
    const { error } = await sb.auth.resetPasswordForEmail(v, { redirectTo: back() });
    if (error) return toast("ماقدرناش نبعت الرابط، جرب تاني بعد شوية", true);
    setSent("بعتنالك رابط تعمل منه كلمة سر جديدة.");
  };

  if (sent) return (
    <section className="panel auth">
      <h1 style={{ fontSize: 24 }}>افتح بريدك</h1><p>{sent}</p><p className="ltr"><b>{email.trim()}</b></p>
      <p className="note">لو مالقيتهوش، بص في الرسائل غير المرغوب فيها.</p>
      <button className="linkish" type="button" onClick={() => setSent(null)}>رجوع لتسجيل الدخول</button>
    </section>
  );

  return (
    <div className="landing">
      <section className="landing-top">
        <div className="landing-t">
          <span className="eyebrow">ورقك أسهل</span>
          <h1>كل ورق شركتك في مكان واحد، ومحدش هيفوّت ميعاد تاني</h1>
          <p>ورقك بيفكرك قبل ما أي مستند ينتهي، ويوريك تعمل الخطوة بنفسك ولا مع مكتب، بكام وفي قد إيه. ولو اخترت مكتب، بتتابع شغله خطوة بخطوة.</p>
          <div className="perks">
            <span><Icon name="check" size={16} />تذكير قبل كل تجديد</span>
            <span><Icon name="check" size={16} />أسعار ومدد المكاتب قدامك</span>
            <span><Icon name="check" size={16} />تقييم حقيقي لالتزام كل مكتب</span>
          </div>
        </div>
        <section className="panel auth">
          <h2>ادخل حسابك</h2>
          <p className="note">النسخة دي تجريبية، والدخول بدعوة بس.</p>
          <form className="stack" onSubmit={login}>
            <div className="field"><label htmlFor="email">البريد الإلكتروني</label><input id="email" type="email" className="ltr" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="pass">كلمة السر</label><input id="pass" type="password" className="ltr" required autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
            <button className="btn primary" type="submit" disabled={busy}>ادخل</button>
          </form>
          <div className="auth-links">
            <button className="linkish" type="button" onClick={first}>أول مرة تدخل؟ ابعتلي رابط دخول</button>
            <button className="linkish" type="button" onClick={forgot}>نسيت كلمة السر</button>
          </div>
        </section>
      </section>
      <section className="landing-how">
        <h2>ثلاث خطوات وتبقى مطمّن</h2>
        <div className="how">
          <div><span className="tile-ic"><Icon name="doc" size={24} /></span><b>ضيف شركتك ومستنداتها</b><p>السجل والبطاقة الضريبية والتراخيص، وتاريخ انتهاء كل واحد.</p></div>
          <div><span className="tile-ic warn"><Icon name="bell" size={24} /></span><b>استنى التذكير</b><p>بنفكرك في الوقت اللي لازم تبدأ فيه، مش يوم الانتهاء.</p></div>
          <div><span className="tile-ic ok"><Icon name="pulse" size={24} /></span><b>اختار وتابع</b><p>اعملها بنفسك أو اختار مكتب، وتابع كل مرحلة لحد ما تخلص.</p></div>
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
    if (p1 !== p2) return toast("كلمتين السر مش زي بعض", true);
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: p1, data: { has_password: true } });
    setBusy(false);
    if (error) return toast(error.code === "weak_password" ? "كلمة السر ضعيفة، جرب واحدة أطول" : error.code === "same_password" ? "دي نفس كلمة السر القديمة" : "ماقدرناش نحفظ كلمة السر", true);
    passwordSaved();
    toast("اتحفظت كلمة السر");
  };
  return (
    <section className="panel auth">
      <span className="eyebrow">{fresh ? "خطوة واحدة" : "كلمة سر جديدة"}</span>
      <h1 style={{ fontSize: 24 }}>{fresh ? "اعمل كلمة سر" : "اكتب كلمة السر الجديدة"}</h1>
      <p className="note">{fresh ? "بعد كده هتدخل بيها على طول، من غير ما تستنى إيميل." : "هتستخدمها في الدخول من النهارده."}</p>
      <form className="stack" onSubmit={save}>
        <div className="field"><label htmlFor="p1">كلمة السر</label><input id="p1" type="password" className="ltr" minLength={8} required autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
        <div className="field"><label htmlFor="p2">اكتبها تاني</label><input id="p2" type="password" className="ltr" minLength={8} required autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
        <p className="note">٨ حروف أو أرقام على الأقل.</p>
        <button className="btn primary" type="submit" disabled={busy}>احفظ</button>
      </form>
      {fresh && <button className="linkish" type="button" onClick={() => { writeSession("rasmy-skip-password", "1"); onDone(); }}>مش دلوقتي</button>}
    </section>
  );
}

export function NotInvited() {
  const { profile } = useSession();
  return (
    <section className="panel auth">
      <h1 style={{ fontSize: 24 }}>الحساب ده مش مدعو لسه</h1>
      <p>النسخة التجريبية بالدعوة بس. اطلب من مدير المنصة يبعتلك دعوة على البريد ده:</p>
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
    if (error) return toast("ماقدرناش نحفظ موافقتك، جرب تاني", true);
    setProfile({ ...profile, consent_at: now });
  };
  return (
    <section className="panel auth">
      <span className="eyebrow">قبل ما تبدأ</span>
      <h1 style={{ fontSize: 24 }}>بياناتك وطريقة استخدامها</h1>
      <p>المنصة هتحفظ بيانات شركاتك ومستنداتها وطلباتك، عشان نعرضلك خطواتك ونفكرك بالتجديدات.</p>
      <p>المكتب اللي بتختاره يشوف بيانات الطلب اللي معاه بس، ومحدش تاني يشوفها.</p>
      <p>تقدر تطلب مسح بياناتك في أي وقت.</p>
      <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> موافق على حفظ بياناتي واستخدامها بالطريقة دي</label>
      <button className="btn primary" type="button" disabled={!agree} onClick={go}>ابدأ</button>
    </section>
  );
}
