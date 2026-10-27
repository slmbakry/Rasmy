// Rasmy app shell: invite-only sign-in, consent, and role-based screens.
(function () {
  const cfg = window.RASMY_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const logoutBtn = document.getElementById("logout");

  const ROLES = { owner: "صاحب عمل", office: "مكتب", admin: "مدير" };
  let profile = null;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }) : "";

  let toastTimer;
  function toast(msg, isError) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  // ---------- Routing ----------
  const NAV = {
    admin: [["home", "الرئيسية"], ["invites", "الدعوات"], ["offices", "المكاتب"], ["users", "المستخدمين"]],
    owner: [["home", "الرئيسية"]],
    office: [["home", "الرئيسية"]],
  };
  function route() { return (location.hash || "#home").slice(1); }
  function renderNav() {
    const items = profile?.role ? NAV[profile.role] : [];
    nav.innerHTML = items.map(([id, label]) => `<a href="#${id}" ${route() === id ? 'aria-current="page"' : ""}>${label}</a>`).join("");
    logoutBtn.classList.toggle("hidden", !profile);
  }

  async function render() {
    renderNav();
    if (!profile) return viewLogin();
    if (!profile.role) return viewNotInvited();
    if (!profile.consent_at) return viewConsent();
    const r = route();
    if (profile.role === "admin") {
      if (r === "invites") return viewInvites();
      if (r === "offices") return viewOffices();
      if (r === "users") return viewUsers();
      return viewAdminHome();
    }
    return viewSoon();
  }
  window.addEventListener("hashchange", render);

  // ---------- Auth ----------
  async function loadProfile() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { profile = null; return; }
    const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    profile = data || { id: session.user.id, email: session.user.email, role: null };
  }
  sb.auth.onAuthStateChange((ev) => {
    if (ev === "TOKEN_REFRESHED") return;
    // Defer: awaiting Supabase calls inside this callback can deadlock.
    setTimeout(async () => { await loadProfile(); render(); }, 0);
  });
  logoutBtn.addEventListener("click", async () => { await sb.auth.signOut(); location.hash = "#home"; });

  function viewLogin() {
    app.innerHTML = `
      <section class="panel auth">
        <span class="eyebrow">أهلاً بيك في رسمي</span>
        <h1 style="font-size:26px">مرجعيتك لكل خطوة في حياة شركتك</h1>
        <p class="note">النسخة دي تجريبية، والدخول بدعوة بس. اكتب بريدك، وهيوصلك رابط دخول.</p>
        <form id="login" class="panel" style="padding:0;border:0;gap:14px">
          <div class="field"><label for="email">البريد الإلكتروني</label><input id="email" type="email" class="ltr" required autocomplete="email"></div>
          <button class="btn primary" type="submit">ابعتلي رابط الدخول</button>
        </form>
      </section>`;
    document.getElementById("login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      const redirect = location.origin + location.pathname;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
      btn.disabled = false;
      if (error) return toast("ماقدرناش نبعت الرابط، جرب تاني بعد شوية", true);
      app.innerHTML = `<section class="panel auth"><h1 style="font-size:24px">افتح بريدك</h1><p>بعتنالك رابط الدخول على:</p><p class="ltr"><b>${esc(email)}</b></p><p class="note">لو مالقيتهوش، بص في الرسائل غير المرغوب فيها.</p></section>`;
    });
  }

  function viewNotInvited() {
    app.innerHTML = `
      <section class="panel auth">
        <h1 style="font-size:24px">الحساب ده مش مدعو لسه</h1>
        <p>النسخة التجريبية بالدعوة بس. اطلب من مدير المنصة يبعتلك دعوة على البريد ده:</p>
        <p class="ltr"><b>${esc(profile.email)}</b></p>
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
      const { error } = await sb.from("profiles").update({ consent_at: new Date().toISOString() }).eq("id", profile.id);
      if (error) return toast("ماقدرناش نحفظ موافقتك، جرب تاني", true);
      profile.consent_at = new Date().toISOString();
      render();
    });
  }

  function viewSoon() {
    app.innerHTML = `
      <section class="head">
        <span class="eyebrow">${ROLES[profile.role]}</span>
        <h1>أهلاً بيك</h1>
        <p>حسابك جاهز. شاشات ${profile.role === "owner" ? "صاحب العمل" : "المكتب"} هتتفتح في المرحلة الجاية من النسخة التجريبية.</p>
      </section>`;
  }

  // ---------- Admin ----------
  async function viewAdminHome() {
    app.innerHTML = `<section class="head"><span class="eyebrow">لوحة المدير</span><h1>نظرة سريعة</h1></section><div class="cards" id="cards"><div class="loading">جاري التحميل</div></div>`;
    const count = async (t, f) => { let q = sb.from(t).select("*", { count: "exact", head: true }); if (f) q = f(q); const { count: c } = await q; return c ?? 0; };
    const [users, pending, offices, services] = await Promise.all([
      count("profiles"), count("invites", (q) => q.is("accepted_at", null)), count("offices"), count("services"),
    ]);
    document.getElementById("cards").innerHTML = [
      [users, "مستخدم"], [pending, "دعوة لسه ماتقبلتش"], [offices, "مكتب"], [services, "خدمة في المكتبة"],
    ].map(([n, l]) => `<div class="card"><b>${n.toLocaleString("ar-EG")}</b><span>${l}</span></div>`).join("");
  }

  async function officeOptions(selected) {
    const { data } = await sb.from("offices").select("id,name").order("name");
    return (data || []).map((o) => `<option value="${o.id}" ${o.id === selected ? "selected" : ""}>${esc(o.name)}</option>`).join("");
  }

  async function viewInvites() {
    app.innerHTML = `
      <section class="head"><span class="eyebrow">الدعوات</span><h1>مين يقدر يدخل المنصة</h1>
        <p>الدعوة بتحدد دور الشخص. ابعتله رابط الموقع، ولما يدخل ببريده هياخد الدور ده تلقائياً.</p></section>
      <section class="panel">
        <h2>دعوة جديدة</h2>
        <form id="inv" class="form-row">
          <div class="field"><label for="inv-email">البريد</label><input id="inv-email" type="email" class="ltr" required></div>
          <div class="field"><label for="inv-role">الدور</label><select id="inv-role"><option value="owner">صاحب عمل</option><option value="office">مكتب</option><option value="admin">مدير</option></select></div>
          <div class="field" id="inv-office-wrap" hidden><label for="inv-office">المكتب</label><select id="inv-office"></select></div>
          <button class="btn primary" type="submit">أضف الدعوة</button>
        </form>
      </section>
      <section class="panel"><h2>كل الدعوات</h2><div class="table-wrap" id="list"><div class="loading">جاري التحميل</div></div></section>`;
    const role = document.getElementById("inv-role"), offWrap = document.getElementById("inv-office-wrap"), off = document.getElementById("inv-office");
    off.innerHTML = await officeOptions();
    role.addEventListener("change", () => { offWrap.hidden = role.value !== "office"; });
    document.getElementById("inv").addEventListener("submit", async (e) => {
      e.preventDefault();
      const row = { email: document.getElementById("inv-email").value.trim().toLowerCase(), role: role.value, invited_by: profile.id,
        office_id: role.value === "office" ? off.value || null : null };
      if (row.role === "office" && !row.office_id) return toast("ضيف المكتب الأول من صفحة المكاتب", true);
      const { error } = await sb.from("invites").insert(row);
      if (error) return toast(error.code === "23505" ? "البريد ده مدعو قبل كده" : "ماقدرناش نضيف الدعوة", true);
      toast("اتضافت الدعوة"); viewInvites();
    });
    const { data, error } = await sb.from("invites").select("email,role,created_at,accepted_at,offices(name)").order("created_at", { ascending: false });
    const list = document.getElementById("list");
    if (error) { list.innerHTML = `<p class="empty">ماقدرناش نحمّل الدعوات</p>`; return; }
    list.innerHTML = data.length ? `<table><thead><tr><th>البريد</th><th>الدور</th><th>المكتب</th><th>الحالة</th></tr></thead><tbody>${
      data.map((i) => `<tr><td class="ltr">${esc(i.email)}</td><td>${ROLES[i.role]}</td><td>${esc(i.offices?.name || "")}</td><td>${i.accepted_at ? `<span class="chip ok">دخل ${fmtDate(i.accepted_at)}</span>` : '<span class="chip warn">مستني</span>'}</td></tr>`).join("")
    }</tbody></table>` : `<p class="empty">مفيش دعوات لسه</p>`;
  }

  async function viewOffices() {
    app.innerHTML = `
      <section class="head"><span class="eyebrow">المكاتب</span><h1>المكاتب المعتمدة</h1>
        <p>ضيف المكتب هنا الأول، وبعدها ابعت دعوة لموظفيه بدور مكتب.</p></section>
      <section class="panel">
        <h2>مكتب جديد</h2>
        <form id="off" class="form-row">
          <div class="field"><label for="off-name">اسم المكتب</label><input id="off-name" required></div>
          <div class="field"><label for="off-phone">التليفون</label><input id="off-phone" class="ltr" inputmode="tel"></div>
          <div class="field"><label for="off-lic">رقم الترخيص</label><input id="off-lic" class="ltr"></div>
          <button class="btn primary" type="submit">أضف المكتب</button>
        </form>
      </section>
      <section class="panel"><h2>كل المكاتب</h2><div class="table-wrap" id="list"><div class="loading">جاري التحميل</div></div></section>`;
    document.getElementById("off").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await sb.from("offices").insert({
        name: document.getElementById("off-name").value.trim(),
        phone: document.getElementById("off-phone").value.trim() || null,
        license_no: document.getElementById("off-lic").value.trim() || null,
      });
      if (error) return toast("ماقدرناش نضيف المكتب", true);
      toast("اتضاف المكتب"); viewOffices();
    });
    const { data, error } = await sb.from("offices").select("*").order("created_at");
    const list = document.getElementById("list");
    if (error) { list.innerHTML = `<p class="empty">ماقدرناش نحمّل المكاتب</p>`; return; }
    list.innerHTML = data.length ? `<table><thead><tr><th>المكتب</th><th>التليفون</th><th>رقم الترخيص</th><th>الحالة</th></tr></thead><tbody>${
      data.map((o) => `<tr><td>${esc(o.name)}</td><td class="ltr">${esc(o.phone || "")}</td><td class="ltr">${esc(o.license_no || "")}</td><td>${o.active ? '<span class="chip ok">نشط</span>' : '<span class="chip">موقوف</span>'}</td></tr>`).join("")
    }</tbody></table>` : `<p class="empty">مفيش مكاتب لسه. ابدأ بالمكتب الشريك.</p>`;
  }

  async function viewUsers() {
    app.innerHTML = `<section class="head"><span class="eyebrow">المستخدمين</span><h1>اللي دخلوا المنصة</h1></section><section class="panel"><div class="table-wrap" id="list"><div class="loading">جاري التحميل</div></div></section>`;
    const { data, error } = await sb.from("profiles").select("email,role,consent_at,created_at,offices(name)").order("created_at", { ascending: false });
    const list = document.getElementById("list");
    if (error) { list.innerHTML = `<p class="empty">ماقدرناش نحمّل المستخدمين</p>`; return; }
    list.innerHTML = `<table><thead><tr><th>البريد</th><th>الدور</th><th>المكتب</th><th>الموافقة على البيانات</th><th>أول دخول</th></tr></thead><tbody>${
      data.map((u) => `<tr><td class="ltr">${esc(u.email)}</td><td>${u.role ? ROLES[u.role] : '<span class="chip warn">مش مدعو</span>'}</td><td>${esc(u.offices?.name || "")}</td><td>${u.consent_at ? fmtDate(u.consent_at) : "لسه"}</td><td>${fmtDate(u.created_at)}</td></tr>`).join("")
    }</tbody></table>`;
  }

  // Boot
  (async () => { await loadProfile(); render(); })();
})();
