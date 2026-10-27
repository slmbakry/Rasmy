// App shell: sign-in, consent, navigation and the admin preview switch.
(function () {
  const { sb, esc, toast, state, role, isPreview, writeViewAs, writePreviewOffice, views } = window.R;
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const logoutBtn = document.getElementById("logout");
  const previewBar = document.getElementById("preview");

  const NAV = {
    admin: [["home", "الرئيسية"], ["invites", "الدعوات"], ["offices", "المكاتب"], ["users", "المستخدمين"]],
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
    if (!p.role) return viewNotInvited();
    if (!p.consent_at) return viewConsent();
    const [name, arg] = route().split("/");
    const handler = views[role()]?.[name] || views[role()]?.home;
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
      const { data } = await sb.from("offices").select("id,name").eq("active", true).order("name");
      officeList = data || [];
    }
    pick.innerHTML = `<option value="">اختار المكتب</option>` + officeList.map((o) => `<option value="${o.id}" ${o.id === state.previewOffice ? "selected" : ""}>${esc(o.name)}</option>`).join("");
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

  // ---------- Auth ----------
  async function loadProfile() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { state.profile = null; return; }
    const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    state.profile = data || { id: session.user.id, email: session.user.email, role: null };
    if (state.profile.role !== "admin") state.viewAs = "admin";
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
        <form id="login" class="stack">
          <div class="field"><label for="email">البريد الإلكتروني</label><input id="email" type="email" class="ltr" required autocomplete="email"></div>
          <button class="btn primary" type="submit">ابعتلي رابط الدخول</button>
        </form>
      </section>`;
    document.getElementById("login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
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
