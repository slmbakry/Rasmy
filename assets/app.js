// App shell: sign-in, consent, navigation and the admin preview switch.
(function () {
  const { sb, esc, fmtDate, toast, state, role, isPreview, officeId, writeViewAs, writePreviewOffice, views } = window.R;
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const logoutBtn = document.getElementById("logout");
  const previewBar = document.getElementById("preview");
  const bell = document.getElementById("bell");

  const NAV = {
    admin: [["home", "الرئيسية"], ["performance", "أداء المكاتب"], ["invites", "الدعوات"], ["offices", "المكاتب"], ["users", "المستخدمين"]],
    owner: [["home", "لوحتي"], ["guide", "ابدأ مشروع"], ["company-new", "ضيف شركة"]],
    office: [["home", "الطلبات"]],
  };
  const route = () => (location.hash || "#home").slice(1);

  function renderChrome() {
    const r = role();
    const items = r ? NAV[r] : [];
    const base = route().split("/")[0];
    nav.innerHTML = items.map(([id, label]) => `<a href="#${id}" ${base === id ? 'aria-current="page"' : ""}>${label}</a>`).join("");
    logoutBtn.classList.toggle("hidden", !state.profile);
    bell.classList.toggle("hidden", !(r && state.profile?.consent_at));
    if (r && state.profile?.consent_at) bellCount();
    const admin = state.profile?.role === "admin" && state.profile?.consent_at;
    previewBar.hidden = !admin;
    if (admin) {
      previewBar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.as === state.viewAs)));
      previewBar.classList.toggle("on", isPreview());
      officePicker();
    }
  }

  async function render() {
    renderChrome();
    const p = state.profile;
    if (!p) return viewLogin();
    if (state.recovery) return viewSetPassword();
    if (!p.role) return viewNotInvited();
    if (!p.consent_at) return viewConsent();
    if (needsPassword()) return viewSetPassword();
    const [name, arg] = route().split("/");
    const handler = name === "alerts" ? alerts : views[role()]?.[name] || views[role()]?.home;
    try { await handler(app, arg); }
    catch (e) { console.error(e); app.innerHTML = `<section class="panel"><p>حصلت مشكلة في تحميل الصفحة. حدّث الصفحة وجرب تاني.</p></section>`; }
  }
  window.R.render = render;
  window.addEventListener("hashchange", render);

  // When an admin previews as an office, they pick which office to act for.
  let officeList = null;
  async function officePicker() {
    const pick = document.getElementById("preview-office");
    pick.hidden = state.viewAs !== "office";
    if (pick.hidden) return;
    if (!officeList) {
      const { data } = await sb.from("offices").select("id,name,is_demo").eq("active", true).order("name");
      officeList = data || [];
    }
    pick.innerHTML = `<option value="">اختار المكتب</option>` + officeList.map((o) => `<option value="${o.id}" ${o.id === state.previewOffice ? "selected" : ""}>${esc(o.name)}${o.is_demo ? " (تجريبي)" : ""}</option>`).join("");
  }
  document.getElementById("preview-office").addEventListener("change", (e) => {
    state.previewOffice = e.target.value || null; writePreviewOffice(e.target.value);
    location.hash = "#home"; render();
  });

  previewBar.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-as]"); if (!b) return;
    state.viewAs = b.dataset.as; writeViewAs(b.dataset.as);
    location.hash = "#home"; render();
  });

  // ---------- Notifications ----------
  // Each role reads its own: the owner's, the office's, or the admins' shared ones.
  function scoped(q) {
    const r = role();
    if (r === "office") return officeId() ? q.eq("office_id", officeId()) : null;
    if (r === "owner") return q.eq("user_id", state.profile.id);
    return q.eq("for_admin", true);
  }
  async function bellCount() {
    const q = scoped(sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null));
    const { count } = q ? await q : { count: 0 };
    const n = document.getElementById("bell-n");
    n.hidden = !count; n.textContent = count > 9 ? "+٩" : Number(count || 0).toLocaleString("ar-EG");
  }
  const TONE = { late: "bad", overdue: "bad", expired: "bad", escalated: "bad", declined: "bad", renew: "warn", wait: "warn", done: "ok", accepted: "ok" };

  async function alerts(el) {
    el.innerHTML = `<section class="head"><span class="eyebrow">التنبيهات</span><h1>اللي محتاج تعرفه</h1>
      <p>التنبيهات بتوصل لما حاجة تتغير في طلباتك، أو مرحلة تتأخر، أو مستند يقرب ينتهي.</p></section>
      <section class="panel" id="list"><div class="loading">جاري التحميل</div></section>`;
    const q = scoped(sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(60));
    const { data } = q ? await q : { data: [] };
    const list = document.getElementById("list");
    list.innerHTML = data?.length ? `<div class="alerts">${data.map((n) => `<a class="alert-row ${TONE[n.kind] || ""}${n.read_at ? "" : " unread"}" href="${esc(n.link || "#home")}">
      <span class="dot" aria-hidden="true"></span><div><b>${esc(n.title)}</b>${n.body ? `<small>${esc(n.body)}</small>` : ""}</div><small class="when">${fmtDate(n.created_at)}</small></a>`).join("")}</div>`
      : '<p class="empty">مفيش تنبيهات لسه.</p>';
    const unread = (data || []).filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length) { await sb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread); bellCount(); }
  }

  // ---------- Auth ----------
  // Sign-in is by password. The emailed link is for the first visit and for a
  // forgotten password; after it the person sets a password once.
  const back = () => location.origin + location.pathname;
  const readSkip = () => { try { return sessionStorage.getItem("rasmy-skip-password") === "1"; } catch { return false; } };

  async function loadProfile() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { state.profile = null; state.hasPassword = true; return; }
    state.hasPassword = !!session.user.user_metadata?.has_password;
    const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    state.profile = data || { id: session.user.id, email: session.user.email, role: null };
    if (state.profile.role !== "admin") state.viewAs = "admin";
  }
  sb.auth.onAuthStateChange((ev) => {
    if (ev === "TOKEN_REFRESHED") return;
    if (ev === "PASSWORD_RECOVERY") state.recovery = true;
    // Defer: awaiting Supabase calls inside this callback can deadlock.
    setTimeout(async () => { await loadProfile(); render(); }, 0);
  });
  logoutBtn.addEventListener("click", async () => { await sb.auth.signOut(); location.hash = "#home"; });

  const needsPassword = () => state.recovery || (!state.hasPassword && !readSkip());

  function viewLogin() {
    app.innerHTML = `
      <section class="panel auth">
        <span class="eyebrow">أهلاً بيك في رسمي</span>
        <h1 style="font-size:26px">مرجعيتك لكل خطوة في حياة شركتك</h1>
        <p class="note">النسخة دي تجريبية، والدخول بدعوة بس.</p>
        <form id="login" class="stack">
          <div class="field"><label for="email">البريد الإلكتروني</label><input id="email" type="email" class="ltr" required autocomplete="email"></div>
          <div class="field"><label for="pass">كلمة السر</label><input id="pass" type="password" class="ltr" required autocomplete="current-password"></div>
          <button class="btn primary" type="submit">ادخل</button>
        </form>
        <div class="auth-links">
          <button class="linkish" type="button" id="first">أول مرة تدخل؟ ابعتلي رابط دخول</button>
          <button class="linkish" type="button" id="forgot">نسيت كلمة السر</button>
        </div>
      </section>`;
    const emailOf = () => {
      const v = document.getElementById("email").value.trim();
      if (!v) toast("اكتب بريدك الأول", true);
      return v;
    };
    const sent = (email, what) => {
      app.innerHTML = `<section class="panel auth"><h1 style="font-size:24px">افتح بريدك</h1><p>${what}</p><p class="ltr"><b>${esc(email)}</b></p>
        <p class="note">لو مالقيتهوش، بص في الرسائل غير المرغوب فيها.</p><button class="linkish" type="button" id="again">رجوع لتسجيل الدخول</button></section>`;
      document.getElementById("again").addEventListener("click", viewLogin);
    };
    document.getElementById("login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      const { error } = await sb.auth.signInWithPassword({ email: emailOf(), password: document.getElementById("pass").value });
      btn.disabled = false;
      if (error) toast(error.status === 400 ? "البريد أو كلمة السر غلط. لو أول مرة تدخل، اطلب رابط الدخول." : "ماقدرناش ندخلك، جرب تاني", true);
    });
    document.getElementById("first").addEventListener("click", async () => {
      const email = emailOf(); if (!email) return;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: back() } });
      if (error) return toast("ماقدرناش نبعت الرابط، جرب تاني بعد شوية", true);
      sent(email, "بعتنالك رابط الدخول. بعد ما تدخل هتعمل كلمة سر، ومش هتحتاج الرابط تاني.");
    });
    document.getElementById("forgot").addEventListener("click", async () => {
      const email = emailOf(); if (!email) return;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: back() });
      if (error) return toast("ماقدرناش نبعت الرابط، جرب تاني بعد شوية", true);
      sent(email, "بعتنالك رابط تعمل منه كلمة سر جديدة.");
    });
  }

  function viewSetPassword() {
    const fresh = !state.hasPassword && !state.recovery;
    app.innerHTML = `
      <section class="panel auth">
        <span class="eyebrow">${fresh ? "خطوة واحدة" : "كلمة سر جديدة"}</span>
        <h1 style="font-size:24px">${fresh ? "اعمل كلمة سر" : "اكتب كلمة السر الجديدة"}</h1>
        <p class="note">${fresh ? "بعد كده هتدخل بيها على طول، من غير ما تستنى إيميل." : "هتستخدمها في الدخول من النهارده."}</p>
        <form id="pw" class="stack">
          <div class="field"><label for="p1">كلمة السر</label><input id="p1" type="password" class="ltr" minlength="8" required autocomplete="new-password"></div>
          <div class="field"><label for="p2">اكتبها تاني</label><input id="p2" type="password" class="ltr" minlength="8" required autocomplete="new-password"></div>
          <p class="note">٨ حروف أو أرقام على الأقل.</p>
          <button class="btn primary" type="submit">احفظ</button>
        </form>
        ${fresh ? '<button class="linkish" type="button" id="later">مش دلوقتي</button>' : ""}
      </section>`;
    document.getElementById("pw").addEventListener("submit", async (e) => {
      e.preventDefault();
      const p1 = document.getElementById("p1").value, p2 = document.getElementById("p2").value;
      if (p1 !== p2) return toast("كلمتين السر مش زي بعض", true);
      const btn = e.target.querySelector("button"); btn.disabled = true;
      const { error } = await sb.auth.updateUser({ password: p1, data: { has_password: true } });
      btn.disabled = false;
      if (error) return toast(error.code === "weak_password" ? "كلمة السر ضعيفة، جرب واحدة أطول" : error.code === "same_password" ? "دي نفس كلمة السر القديمة" : "ماقدرناش نحفظ كلمة السر", true);
      state.recovery = false; state.hasPassword = true;
      toast("اتحفظت كلمة السر"); render();
    });
    document.getElementById("later")?.addEventListener("click", () => {
      try { sessionStorage.setItem("rasmy-skip-password", "1"); } catch {}
      render();
    });
  }

  function viewNotInvited() {
    app.innerHTML = `
      <section class="panel auth">
        <h1 style="font-size:24px">الحساب ده مش مدعو لسه</h1>
        <p>النسخة التجريبية بالدعوة بس. اطلب من مدير المنصة يبعتلك دعوة على البريد ده:</p>
        <p class="ltr"><b>${esc(state.profile.email)}</b></p>
      </section>`;
  }

  function viewConsent() {
    app.innerHTML = `
      <section class="panel auth">
        <span class="eyebrow">قبل ما تبدأ</span>
        <h1 style="font-size:24px">بياناتك وطريقة استخدامها</h1>
        <p>المنصة هتحفظ بيانات شركاتك ومستنداتها وطلباتك، عشان نعرضلك خطواتك ونفكرك بالتجديدات.</p>
        <p>المكتب اللي بتختاره يشوف بيانات الطلب اللي معاه بس، ومحدش تاني يشوفها.</p>
        <p>تقدر تطلب مسح بياناتك في أي وقت.</p>
        <label class="check"><input type="checkbox" id="agree"> موافق على حفظ بياناتي واستخدامها بالطريقة دي</label>
        <button class="btn primary" id="go" type="button" disabled>ابدأ</button>
      </section>`;
    const agree = document.getElementById("agree"), go = document.getElementById("go");
    agree.addEventListener("change", () => { go.disabled = !agree.checked; });
    go.addEventListener("click", async () => {
      const now = new Date().toISOString();
      const { error } = await sb.from("profiles").update({ consent_at: now }).eq("id", state.profile.id);
      if (error) return toast("ماقدرناش نحفظ موافقتك، جرب تاني", true);
      state.profile.consent_at = now;
      render();
    });
  }


  (async () => { await loadProfile(); render(); })();
})();
