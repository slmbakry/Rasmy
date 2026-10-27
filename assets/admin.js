// Admin screens: overview, invites, offices and their prices, users.
(function () {
  const { sb, esc, fmtDate, num, toast, state, services } = window.R;
  const ROLES = { owner: "صاحب عمل", office: "مكتب", admin: "مدير" };

  async function home(el) {
    el.innerHTML = `<section class="head"><span class="eyebrow">لوحة المدير</span><h1>نظرة سريعة</h1>
      <p>تقدر تجرب المنصة كصاحب عمل أو كمكتب من الشريط اللي فوق. البيانات اللي تعملها هناك بتتعلّم إنها تجريبية.</p></section>
      <div class="cards" id="cards"><div class="loading">جاري التحميل</div></div>`;
    const count = async (t, f) => { let q = sb.from(t).select("*", { count: "exact", head: true }); if (f) q = f(q); const { count: c } = await q; return c ?? 0; };
    const [users, pending, offices, reqs, companies] = await Promise.all([
      count("profiles"), count("invites", (q) => q.is("accepted_at", null)), count("offices"),
      count("requests", (q) => q.eq("is_demo", false)), count("companies", (q) => q.eq("is_demo", false)),
    ]);
    document.getElementById("cards").innerHTML = [
      [users, "مستخدم"], [pending, "دعوة لسه ماتقبلتش"], [offices, "مكتب"], [companies, "شركة حقيقية"], [reqs, "طلب حقيقي"],
    ].map(([n, l]) => `<div class="card"><b>${num(n)}</b><span>${l}</span></div>`).join("");
  }

  async function officeOptions() {
    const { data } = await sb.from("offices").select("id,name").order("name");
    return (data || []).map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join("");
  }

  async function invites(el) {
    el.innerHTML = `
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
      const row = { email: document.getElementById("inv-email").value.trim().toLowerCase(), role: role.value, invited_by: state.profile.id,
        office_id: role.value === "office" ? off.value || null : null };
      if (row.role === "office" && !row.office_id) return toast("ضيف المكتب الأول من صفحة المكاتب", true);
      const { error } = await sb.from("invites").insert(row);
      if (error) return toast(error.code === "23505" ? "البريد ده مدعو قبل كده" : "ماقدرناش نضيف الدعوة", true);
      toast("اتضافت الدعوة"); invites(el);
    });
    const { data, error } = await sb.from("invites").select("email,role,created_at,accepted_at,offices(name)").order("created_at", { ascending: false });
    const list = document.getElementById("list");
    if (error) { list.innerHTML = `<p class="empty">ماقدرناش نحمّل الدعوات</p>`; return; }
    list.innerHTML = data.length ? `<table><thead><tr><th>البريد</th><th>الدور</th><th>المكتب</th><th>الحالة</th></tr></thead><tbody>${
      data.map((i) => `<tr><td class="ltr">${esc(i.email)}</td><td>${ROLES[i.role]}</td><td>${esc(i.offices?.name || "")}</td><td>${i.accepted_at ? `<span class="chip ok">دخل ${fmtDate(i.accepted_at)}</span>` : '<span class="chip warn">مستني</span>'}</td></tr>`).join("")
    }</tbody></table>` : `<p class="empty">مفيش دعوات لسه</p>`;
  }

  async function offices(el) {
    el.innerHTML = `
      <section class="head"><span class="eyebrow">المكاتب</span><h1>المكاتب المعتمدة</h1>
        <p>ضيف المكتب، وحدد أسعاره ومدده لكل خدمة، وبعدها ابعت دعوة لموظفيه بدور مكتب.</p></section>
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
      toast("اتضاف المكتب"); offices(el);
    });
    const { data, error } = await sb.from("offices").select("*, office_services(count)").order("created_at");
    const list = document.getElementById("list");
    if (error) { list.innerHTML = `<p class="empty">ماقدرناش نحمّل المكاتب</p>`; return; }
    list.innerHTML = data.length ? `<table><thead><tr><th>المكتب</th><th>التليفون</th><th>رقم الترخيص</th><th>خدمات مسعّرة</th><th></th></tr></thead><tbody>${
      data.map((o) => `<tr><td>${esc(o.name)}</td><td class="ltr">${esc(o.phone || "")}</td><td class="ltr">${esc(o.license_no || "")}</td><td>${num(o.office_services?.[0]?.count || 0)}</td><td><a class="btn small" href="#prices/${o.id}">الأسعار والمدد</a></td></tr>`).join("")
    }</tbody></table>` : `<p class="empty">مفيش مكاتب لسه. ابدأ بالمكتب الشريك.</p>`;
  }

  async function prices(el, officeId) {
    const [{ data: office }, svcs, { data: rows }] = await Promise.all([
      sb.from("offices").select("id,name").eq("id", officeId).maybeSingle(),
      services(),
      sb.from("office_services").select("service_id,fee,days").eq("office_id", officeId),
    ]);
    if (!office) { el.innerHTML = `<section class="panel"><p>المكتب ده مش موجود.</p><a class="btn" href="#offices">رجوع للمكاتب</a></section>`; return; }
    const cur = Object.fromEntries((rows || []).map((r) => [r.service_id, r]));
    const kinds = { founding: "التأسيس", compliance: "الالتزامات الدورية", renewal: "التجديدات" };
    el.innerHTML = `
      <section class="head"><a class="back" href="#offices">→ المكاتب</a><span class="eyebrow">الأسعار والمدد</span><h1>${esc(office.name)}</h1>
        <p>اكتب أتعاب المكتب ومدته لكل خدمة بيقدمها. الخدمة اللي تسيبها فاضية مش هتظهر لصاحب العمل مع المكتب ده. الرسوم الحكومية بتتحسب لوحدها.</p></section>
      <form id="pf" class="panel">
        <div class="table-wrap"><table><thead><tr><th>الخدمة</th><th>الرسوم الحكومية</th><th>أتعاب المكتب بالجنيه</th><th>المدة بالأيام</th></tr></thead><tbody>
        ${Object.values(svcs).map((s) => `<tr><td>${esc(s.title)}<br><small class="note">${kinds[s.kind]}</small></td><td>${R.money(s.gov_fee)}</td>
          <td><input class="mini" type="number" min="0" step="50" id="fee-${s.id}" value="${cur[s.id]?.fee ?? ""}"></td>
          <td><input class="mini" type="number" min="1" step="1" id="days-${s.id}" value="${cur[s.id]?.days ?? ""}"></td></tr>`).join("")}
        </tbody></table></div>
        <button class="btn primary" type="submit">احفظ الأسعار</button>
      </form>`;
    document.getElementById("pf").addEventListener("submit", async (e) => {
      e.preventDefault();
      const upserts = [];
      for (const s of Object.values(svcs)) {
        const fee = document.getElementById("fee-" + s.id).value, d = document.getElementById("days-" + s.id).value;
        if (fee !== "" && d !== "") upserts.push({ office_id: officeId, service_id: s.id, fee: Number(fee), days: Number(d) });
      }
      if (!upserts.length) return toast("اكتب سعر ومدة لخدمة واحدة على الأقل", true);
      const { error } = await sb.from("office_services").upsert(upserts);
      if (error) return toast("ماقدرناش نحفظ الأسعار", true);
      toast("اتحفظت الأسعار");
    });
  }

  async function users(el) {
    el.innerHTML = `<section class="head"><span class="eyebrow">المستخدمين</span><h1>اللي دخلوا المنصة</h1></section><section class="panel"><div class="table-wrap" id="list"><div class="loading">جاري التحميل</div></div></section>`;
    const { data, error } = await sb.from("profiles").select("email,role,consent_at,created_at,offices(name)").order("created_at", { ascending: false });
    const list = document.getElementById("list");
    if (error) { list.innerHTML = `<p class="empty">ماقدرناش نحمّل المستخدمين</p>`; return; }
    list.innerHTML = `<table><thead><tr><th>البريد</th><th>الدور</th><th>المكتب</th><th>الموافقة على البيانات</th><th>أول دخول</th></tr></thead><tbody>${
      data.map((u) => `<tr><td class="ltr">${esc(u.email)}</td><td>${u.role ? ROLES[u.role] : '<span class="chip warn">مش مدعو</span>'}</td><td>${esc(u.offices?.name || "")}</td><td>${u.consent_at ? fmtDate(u.consent_at) : "لسه"}</td><td>${fmtDate(u.created_at)}</td></tr>`).join("")
    }</tbody></table>`;
  }

  window.R.views.admin = { home, invites, offices, prices, users };
})();
