// Admin screens: overview, invites, offices and their prices, users.
(function () {
  const { sb, DAY, esc, fmtDate, num, days, toast, state, services, stageLate } = window.R;
  const ROLES = { owner: "صاحب عمل", office: "مكتب", admin: "مدير" };

  // ---------- Overview: what needs attention ----------
  // Real data only by default; the admin can include preview data.
  const readDemo = () => { try { return sessionStorage.getItem("rasmy-admin-demo") === "1"; } catch { return false; } };
  const writeDemo = (v) => { try { sessionStorage.setItem("rasmy-admin-demo", v ? "1" : "0"); } catch {} };
  const since = (t) => (Date.now() - new Date(t).getTime()) / DAY;
  const WAIT_DAYS = 1;

  async function loadRequests() {
    let q = sb.from("requests").select("*, offices(name), companies(name), request_stages(idx,title,planned_days,started_at,done_at)").order("created_at", { ascending: false });
    if (!readDemo()) q = q.eq("is_demo", false);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(measure);
  }

  // Lateness of one request: on its current stage, and against the time the office promised.
  function measure(r) {
    const st = (r.request_stages || []).slice().sort((a, b) => a.idx - b.idx);
    const cur = st.find((x) => !x.done_at);
    const open = ["accepted", "in_progress"].includes(r.status);
    const start = r.accepted_at || r.created_at;
    const took = r.completed_at ? since(start) - since(r.completed_at) : null;
    return { ...r, stage: cur, stageLate: open && cur ? stageLate(cur) : 0,
      overdue: open && r.quoted_days ? Math.max(0, Math.floor(since(start) - r.quoted_days)) : 0,
      waiting: r.status === "new" && r.office_id ? Math.floor(since(r.created_at)) : 0,
      took, onTime: took === null ? null : took <= (r.quoted_days || 0) + 0.5 };
  }

  function demoSwitch() {
    const on = readDemo();
    return `<div class="tabs" role="tablist"><button class="tab" type="button" role="tab" data-demo="0" aria-selected="${!on}">البيانات الحقيقية</button>
      <button class="tab" type="button" role="tab" data-demo="1" aria-selected="${on}">ومعاها التجريبية</button></div>`;
  }
  function bindDemo(el, again) {
    el.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", () => { writeDemo(b.dataset.demo === "1"); again(); }));
  }

  async function home(el) {
    el.innerHTML = `<div class="loading">جاري التحميل</div>`;
    const count = async (t, f) => { let q = sb.from(t).select("*", { count: "exact", head: true }); if (f) q = f(q); const { count: c } = await q; return c ?? 0; };
    const [svcs, reqs, users, pending] = await Promise.all([
      services(), loadRequests(), count("profiles"), count("invites", (q) => q.is("accepted_at", null)),
    ]);
    const late = reqs.filter((r) => r.stageLate || r.overdue).sort((a, b) => Math.max(b.stageLate, b.overdue) - Math.max(a.stageLate, a.overdue));
    const waiting = reqs.filter((r) => r.waiting >= WAIT_DAYS).sort((a, b) => b.waiting - a.waiting);
    const open = reqs.filter((r) => !["done", "cancelled"].includes(r.status));
    const done = reqs.filter((r) => r.status === "done" && r.office_id);
    const onTime = done.length ? Math.round((done.filter((r) => r.onTime).length / done.length) * 100) : null;
    const title = (r) => esc(svcs[r.service_id]?.title || r.service_id);
    const who = (r) => esc(r.offices?.name || "صاحب العمل بنفسه");
    el.innerHTML = `
      <section class="head"><span class="eyebrow">لوحة المدير</span><h1>نظرة سريعة</h1>
        <p>هنا بتشوف الطلبات المتأخرة والمكاتب اللي ماردتش. تقدر كمان تجرب المنصة كصاحب عمل أو كمكتب من الشريط اللي فوق.</p></section>
      ${demoSwitch()}
      <div class="cards">
        <div class="card"><b>${num(open.length)}</b><span>طلب مفتوح</span></div>
        <div class="card ${late.length ? "bad" : "ok"}"><b>${num(late.length)}</b><span>طلب متأخر</span></div>
        <div class="card ${waiting.length ? "warn" : "ok"}"><b>${num(waiting.length)}</b><span>مستني رد المكتب</span></div>
        <div class="card"><b>${onTime === null ? "—" : num(onTime) + "٪"}</b><span>خلصت في موعدها</span></div>
        <div class="card"><b>${num(users)}</b><span>مستخدم</span></div>
        <div class="card"><b>${num(pending)}</b><span>دعوة مستنية</span></div>
      </div>
      <section class="panel"><div class="row between"><h2>طلبات متأخرة</h2><a class="btn small" href="#performance">أداء المكاتب</a></div>
        ${late.length ? `<div class="reqs">${late.map((r) => `<a class="req late" href="#request/${r.id}">
          <div class="row between"><b>${title(r)}</b><span class="chips">${r.escalated_at ? '<span class="chip warn">اتصعّد</span>' : ""}<span class="chip bad">متأخر ${days(Math.max(r.stageLate, r.overdue))}</span></span></div>
          <small>${esc(r.companies?.name || "")} · ${who(r)}${r.stage ? " · المرحلة الحالية: " + esc(r.stage.title) : ""}</small>
          <small>${r.overdue ? `عدّى المدة المعلنة بـ${days(r.overdue)}` : ""}${r.overdue && r.stageLate ? " · " : ""}${r.stageLate ? `المرحلة متأخرة ${days(r.stageLate)}` : ""}</small></a>`).join("")}</div>`
          : '<p class="empty">مفيش طلبات متأخرة.</p>'}</section>
      <section class="panel"><h2>مكاتب ماردتش على طلبات</h2>
        ${waiting.length ? `<div class="reqs">${waiting.map((r) => `<a class="req" href="#request/${r.id}">
          <div class="row between"><b>${title(r)}</b><span class="chips">${r.escalated_at ? '<span class="chip bad">اتصعّد</span>' : ""}<span class="chip warn">مستني ${days(r.waiting)}</span></span></div>
          <small>${esc(r.companies?.name || "")} · ${who(r)}</small></a>`).join("")}</div>`
          : '<p class="empty">كل المكاتب ردت على طلباتها.</p>'}</section>`;
    bindDemo(el, () => home(el));
  }

  // ---------- Office performance ----------
  async function performance(el) {
    el.innerHTML = `<div class="loading">جاري التحميل</div>`;
    const [reqs, { data: offs }, { data: ratings }, { data: declines }] = await Promise.all([
      loadRequests(),
      sb.from("offices").select("id,name,active,is_demo").order("name"),
      sb.from("ratings").select("office_id,professionalism,speed,request_id"),
      sb.from("events").select("request_id").eq("kind", "declined"),
    ]);
    const declined = new Set((declines || []).map((e) => e.request_id));
    const ids = new Set(reqs.map((r) => r.id));
    const rows = (offs || []).filter((o) => readDemo() || !o.is_demo).map((o) => {
      const mine = reqs.filter((r) => r.office_id === o.id);
      const answered = mine.filter((r) => r.accepted_at || declined.has(r.id));
      const accepted = mine.filter((r) => r.accepted_at);
      const done = mine.filter((r) => r.status === "done");
      const timed = done.filter((r) => r.onTime !== null);
      const rs = (ratings || []).filter((x) => x.office_id === o.id && ids.has(x.request_id));
      const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
      return { o, total: mine.length,
        open: mine.filter((r) => ["new", "accepted", "in_progress"].includes(r.status)).length,
        late: mine.filter((r) => r.stageLate || r.overdue).length,
        done: done.length,
        acceptRate: answered.length ? accepted.length / answered.length : null,
        reply: avg(accepted.map((r) => since(r.created_at) - since(r.accepted_at))),
        onTime: timed.length ? timed.filter((r) => r.onTime).length / timed.length : null,
        delay: avg(timed.filter((r) => !r.onTime).map((r) => r.took - r.quoted_days)),
        pro: avg(rs.map((x) => x.professionalism)), speed: avg(rs.map((x) => x.speed)), rated: rs.length };
    }).sort((a, b) => b.total - a.total);
    const pct = (v) => (v === null ? "—" : num(Math.round(v * 100)) + "٪");
    const dur = (v) => (v === null ? "—" : v < 1 ? "أقل من يوم" : days(Math.round(v)));
    const star = (v) => (v === null ? "—" : num(v.toFixed(1)));
    el.innerHTML = `
      <section class="head"><a class="back" href="#home">→ الرئيسية</a><span class="eyebrow">أداء المكاتب</span><h1>مين بيلتزم بمواعيده</h1>
        <p>الأرقام دي محسوبة من تواريخ الطلبات نفسها، مش من رأي حد. الالتزام بالموعد معناه إن الطلب خلص في المدة اللي المكتب أعلنها أو أقل.</p></section>
      ${demoSwitch()}
      <section class="panel"><div class="table-wrap">${rows.length ? `<table><thead><tr>
        <th>المكتب</th><th>الطلبات</th><th>مفتوح</th><th>متأخر دلوقتي</th><th>خلص</th><th>نسبة القبول</th><th>متوسط وقت الرد</th><th>في الموعد</th><th>متوسط التأخير</th><th>الاحترافية</th><th>السرعة</th></tr></thead><tbody>
        ${rows.map((x) => `<tr><td>${esc(x.o.name)}${x.o.active ? "" : ' <span class="chip">موقوف</span>'}${x.o.is_demo ? ' <span class="chip">تجريبي</span>' : ""}</td><td>${num(x.total)}</td><td>${num(x.open)}</td>
          <td>${x.late ? `<span class="chip bad">${num(x.late)}</span>` : num(0)}</td><td>${num(x.done)}</td><td>${pct(x.acceptRate)}</td><td>${dur(x.reply)}</td>
          <td>${x.onTime === null ? "—" : `<span class="chip ${x.onTime >= 0.8 ? "ok" : x.onTime >= 0.5 ? "warn" : "bad"}">${pct(x.onTime)}</span>`}</td>
          <td>${dur(x.delay)}</td><td>${star(x.pro)}</td><td>${star(x.speed)}</td></tr>`).join("")}
        </tbody></table>` : '<p class="empty">مفيش مكاتب لسه.</p>'}</div>
        <p class="note">التقييمات من أصحاب العمل بعد ما الطلب يخلص.</p></section>`;
    bindDemo(el, () => performance(el));
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

  window.R.views.admin = { home, performance, invites, offices, prices, users, request: (el, id) => window.R.views.owner.request(el, id) };
})();
