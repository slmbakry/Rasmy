// Business-owner screens: dashboard, guide and plan, adding a company, renewals, request tracking.
(function () {
  const { sb, esc, fmtDate, num, money, days, toast, state, isPreview, services, docStatus, optionsFor, optionLabel } = window.R;
  const uid = () => state.profile.id;
  const STATUS = { new: ["", "جديد"], accepted: ["", "المكتب قبله"], in_progress: ["warn", "جاري التنفيذ"], done: ["ok", "تم"], cancelled: ["", "ملغي"] };

  // ---------- Dashboard ----------
  async function home(el, companyId) {
    el.innerHTML = `<div class="loading">جاري التحميل</div>`;
    const svcs = await services();
    const { data: companies } = await sb.from("companies").select("*").eq("owner_id", uid()).neq("status", "closed").order("created_at");
    if (!companies?.length) {
      el.innerHTML = `
        <section class="head"><span class="eyebrow">لوحتي</span><h1>ابدأ بأول شركة</h1>
          <p>لو عندك مشروع جديد، الدليل هيوريك خطواتك. ولو عندك شركة قائمة، ضيفها بمستنداتها وتواريخ انتهائها، والمنصة هتفكرك قبل كل تجديد.</p></section>
        <div class="choices">
          <a class="choice" href="#guide"><span class="eyebrow">تأسيس</span><h3>عندي فكرة أو مشروع مش مسجل</h3><p>كام سؤال، وبعدها خريطة خطواتك بالتكلفة والمدة.</p></a>
          <a class="choice" href="#company-new"><span class="eyebrow">تشغيل</span><h3>عندي شركة قائمة</h3><p>ضيف مستنداتها، وتابع تجديداتها من مكان واحد.</p></a>
        </div>`;
      return;
    }
    const ids = companies.map((c) => c.id);
    const [{ data: docs }, { data: reqs }] = await Promise.all([
      sb.from("documents").select("*").in("company_id", ids).order("expires_on", { nullsFirst: false }),
      sb.from("requests").select("*, offices(name), request_stages(done_at)").in("company_id", ids).order("created_at", { ascending: false }),
    ]);
    const co = companies.find((c) => c.id === companyId) || companies[0];
    const coDocs = (docs || []).filter((d) => d.company_id === co.id);
    const openReqs = (reqs || []).filter((r) => r.company_id === co.id && !["done", "cancelled"].includes(r.status));
    const doneReqs = (reqs || []).filter((r) => r.company_id === co.id && r.status === "done").slice(0, 5);
    const all = (docs || []).map((d) => docStatus(d, svcs[d.service_id]));
    const c = (k) => all.filter((x) => x.cls === k).length;
    const openFor = (docId) => (reqs || []).find((r) => r.document_id === docId && !["done", "cancelled"].includes(r.status));

    el.innerHTML = `
      <section class="head"><span class="eyebrow">لوحتي</span><h1>شركاتك ومستنداتها في مكان واحد</h1>
        <p>المنصة بتحسب موعد بدء كل تجديد من مدة تنفيذه، عشان المستند الجديد يوصل قبل ما الحالي يخلص.</p></section>
      <div class="cards">
        <div class="card"><b>${num(companies.length)}</b><span>شركات</span></div>
        <div class="card ok"><b>${num(c("ok"))}</b><span>مستندات سليمة</span></div>
        <div class="card warn"><b>${num(c("warn"))}</b><span>تجديد قريب</span></div>
        <div class="card bad"><b>${num(c("bad"))}</b><span>منتهية</span></div>
      </div>
      <div class="tabs" role="tablist" aria-label="الشركات">${companies.map((x) => `<a class="tab" role="tab" aria-selected="${x.id === co.id}" href="#home/${x.id}">${esc(x.name)}${x.is_demo ? " · تجريبي" : ""}</a>`).join("")}</div>
      <div class="grid2 wide">
        <section class="panel">
          <div class="row between"><h2>${esc(co.name)}</h2><span class="chip">${esc(co.legal_form || "")}${co.status === "founding" ? " · تحت التأسيس" : ""}</span></div>
          ${coDocs.length ? coDocs.map((d) => {
            const st = docStatus(d, svcs[d.service_id]), open = openFor(d.id);
            const when = st.left === null ? "" : st.left < 0 ? `انتهى من ${days(-st.left)}` : `ينتهي ${fmtDate(d.expires_on)} · باقي ${days(st.left)}`;
            const hint = open ? "طلب التجديد شغال" : st.cls === "ok" && st.startOn ? `التذكير هيوصلك ${fmtDate(st.startOn)}` : "";
            return `<div class="doc ${open ? "busy" : st.cls}"><span class="stripe" aria-hidden="true"></span>
              <div class="t"><b>${esc(d.title)}</b><small>${when}</small>${hint ? `<small>${hint}</small>` : ""}</div>
              <div class="act">${open ? `<a class="chip" href="#request/${open.id}">جاري التجديد</a>` : `<span class="chip ${st.cls}">${st.label}</span>`}
              ${!open && svcs[d.service_id]?.kind === "renewal" && st.cls !== "ok" ? `<a class="btn primary small" href="#renew/${d.id}">اطلب التجديد</a>` : ""}</div></div>`;
          }).join("") : `<p class="empty">مفيش مستندات لسه. ${co.status === "founding" ? "هتظهر هنا أول ما خطوات التأسيس تخلص." : ""}</p>`}
          <a class="btn small" href="#doc-new/${co.id}">ضيف مستند</a>
        </section>
        <section class="panel">
          <h2>الطلبات الشغالة</h2>
          ${openReqs.length ? openReqs.map(reqCard).join("") : `<p class="empty">مفيش طلبات شغالة.</p>`}
          ${doneReqs.length ? `<h3 class="sub">خلصت مؤخراً</h3>${doneReqs.map(reqCard).join("")}` : ""}
        </section>
      </div>`;

    function reqCard(r) {
      const s = svcs[r.service_id], total = r.request_stages.length, done = r.request_stages.filter((x) => x.done_at).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return `<a class="req" href="#request/${r.id}"><div class="row between"><b>${esc(s?.title || r.service_id)}</b><span class="chip ${STATUS[r.status][0]}">${STATUS[r.status][1]}</span></div>
        <small>${esc(r.offices?.name || "بتنفذه بنفسك")} · ${num(done)} من ${num(total)} مراحل</small><div class="meter"><i style="width:${pct}%"></i></div></a>`;
    }
  }

  // ---------- Guide ----------
  const QUESTIONS = [
    { key: "partners", q: "هتبدأ لوحدك ولا معاك شركاء؟", opts: [["alone", "لوحدي", "المشروع ملكي بالكامل"], ["many", "معايا شريك أو أكتر", "اتنين أو أكتر في الملكية"]] },
    { key: "activity", q: "إيه طبيعة النشاط؟", opts: [["shop", "تجاري بمحل", "بيع أو خدمة من مكان مفتوح للناس"], ["online", "خدمات أو بيع أونلاين", "من غير محل مفتوح للجمهور"], ["factory", "صناعي", "ورشة أو مصنع"]] },
    { key: "turnover", q: "حجم المبيعات السنوي المتوقع؟", opts: [["s", "أقل من نص مليون جنيه", "مشروع صغير في البداية"], ["m", "من نص مليون لحد عشرين مليون", "مشروع متوسط"], ["l", "أكتر من عشرين مليون", "مشروع كبير"]] },
    { key: "staff", q: "هتشغل موظفين؟", opts: [["yes", "أيوه", "موظف أو أكتر"], ["no", "لأ، في الأول لوحدي", "من غير موظفين حالياً"]] },
  ];
  const guide = { answers: {}, qi: 0, choices: {}, open: null };

  function entityFor(a) {
    if (a.partners === "many") return { name: "شركة ذات مسئولية محدودة", why: "لأن معاك شركاء، والمسئولية بتبقى في حدود رأس المال.", company: true };
    if (a.turnover === "s" && a.activity !== "factory") return { name: "منشأة فردية", why: "أبسط وأسرع وأرخص للبداية، لكن مسئوليتك عن الديون مش محدودة.", company: false };
    return { name: "شركة الشخص الواحد", why: "بتفصل ذمتك عن ذمة الشركة، ومناسبة لحجم نشاطك.", company: true };
  }
  function planSteps(a) {
    const list = [];
    if (entityFor(a).company) list.push("name_reservation", "incorporation");
    list.push("commercial_register", "tax_card");
    if (a.turnover !== "s") list.push("vat_registration");
    if (a.activity === "shop") list.push("shop_license");
    if (a.staff === "yes") list.push("social_insurance");
    list.push("bank_account");
    return list;
  }

  function guideView(el) {
    const Q = QUESTIONS[guide.qi], val = guide.answers[Q.key];
    el.innerHTML = `
      <section class="head"><span class="eyebrow">الدليل</span><h1>كام سؤال بسيط، وبعدها خريطتك جاهزة</h1></section>
      <section class="panel">
        <div class="progress" aria-hidden="true">${QUESTIONS.map((_, i) => `<span class="${i <= guide.qi ? "on" : ""}"></span>`).join("")}</div>
        <p class="note">سؤال ${num(guide.qi + 1)} من ${num(QUESTIONS.length)}</p>
        <h2 id="q-title">${Q.q}</h2>
        <div class="opts" role="radiogroup" aria-labelledby="q-title">${Q.opts.map(([v, b, s]) =>
          `<label class="opt"><input type="radio" name="q" id="q-${v}" value="${v}" ${val === v ? "checked" : ""}><span><b>${b}</b><small>${s}</small></span></label>`).join("")}</div>
        <div class="row"><button class="btn primary" id="next" type="button" ${val ? "" : "disabled"}>${guide.qi === QUESTIONS.length - 1 ? "اعرض خريطتي" : "التالي"}</button>
          ${guide.qi ? '<button class="btn" id="prev" type="button">رجوع</button>' : ""}</div>
      </section>`;
    el.querySelectorAll('input[name="q"]').forEach((i) => i.addEventListener("change", () => { guide.answers[Q.key] = i.value; guideView(el); }));
    el.querySelector("#next").addEventListener("click", () => {
      if (guide.qi < QUESTIONS.length - 1) { guide.qi++; guideView(el); } else { location.hash = "#plan"; }
    });
    el.querySelector("#prev")?.addEventListener("click", () => { guide.qi--; guideView(el); });
  }

  async function plan(el) {
    if (QUESTIONS.some((q) => !guide.answers[q.key])) { location.hash = "#guide"; return; }
    el.innerHTML = `<div class="loading">جاري التحميل</div>`;
    const svcs = await services(), a = guide.answers, e = entityFor(a), list = planSteps(a);
    const opts = Object.fromEntries(await Promise.all(list.map(async (id) => [id, await optionsFor(id)])));
    guide.open ||= list[0];
    const draw = () => {
      let cost = 0, time = 0, gov = 0;
      list.forEach((id) => { const o = pick(id); cost += o.cost; time += o.days; gov += Number(svcs[id].gov_fee); });
      el.innerHTML = `
        <section class="head"><span class="eyebrow">خريطتك</span><h1>${num(list.length)} خطوات توصلك لكيان رسمي</h1>
          <p>افتح أي خطوة تشوف مستنداتها والجهة المسئولة، واختار تعملها بنفسك أو مين ينفذها.</p></section>
        <section class="entity"><span class="eyebrow">الكيان المناسب ليك</span><h2>${e.name}</h2><p>${e.why}</p>
          <div class="chips">${a.turnover !== "l" ? '<span class="chip on-navy">مؤهل للنظام الضريبي المبسط</span>' : ""}${a.turnover !== "s" ? '<span class="chip on-navy">مطلوب تسجيل القيمة المضافة</span>' : ""}</div></section>
        <div class="grid2 wide">
          <div class="steps">${list.map((id, i) => stepView(id, i)).join("")}</div>
          <aside class="panel sum">
            <h2>ملخص اختياراتك</h2>
            <div><div class="kv"><span>التكلفة التقريبية</span><b>${money(cost)}</b></div><div class="kv"><span>منها رسوم حكومية</span><b>${money(gov)}</b></div><div class="kv"><span>المدة لو الخطوات ورا بعض</span><b>${days(time)}</b></div></div>
            <div class="field"><label for="co-name">اسم مشروعك</label><input id="co-name" placeholder="مثلاً: مخبز النور" value="${esc(guide.name || "")}"></div>
            <button class="btn primary" id="launch" type="button">ابدأ التنفيذ</button>
            <p class="note">الأسعار من المكاتب المعتمدة، والرسوم الحكومية تقديرية وبتتأكد قبل الدفع.</p>
          </aside>
        </div>`;
      el.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => { guide.open = guide.open === b.dataset.open ? null : b.dataset.open; draw(); }));
      el.querySelectorAll("input[data-step]").forEach((i) => i.addEventListener("change", () => { guide.choices[i.dataset.step] = i.value; draw(); }));
      el.querySelector("#co-name").addEventListener("input", (ev) => { guide.name = ev.target.value; });
      el.querySelector("#launch").addEventListener("click", launch);
    };
    const pick = (id) => opts[id].find((o) => o.key === guide.choices[id]) || opts[id][1] || opts[id][0];
    function stepView(id, i) {
      const s = svcs[id], open = guide.open === id, cur = pick(id);
      return `<div class="step"><button type="button" class="step-h" data-open="${id}" aria-expanded="${open}"><span class="num">${num(i + 1)}</span>
        <span class="t"><b>${esc(s.title)}</b><small>${esc(s.agency)} · ${esc(cur.label)} · ${days(cur.days)}</small></span><span aria-hidden="true">${open ? "−" : "+"}</span></button>
        ${open ? `<div class="step-b"><div class="docs"><b>المستندات المطلوبة</b><ul>${s.docs.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div>
          <div class="alts" role="radiogroup" aria-label="البدائل">${opts[id].map((o) => `<label class="alt"><input type="radio" name="alt-${id}" data-step="${id}" value="${o.key}" ${cur.key === o.key ? "checked" : ""}>
            <span class="n"><b>${esc(o.label)}</b><small>${optionLabel(o)}</small></span><span class="v"><b>${money(o.cost)}</b>${days(o.days)}</span></label>`).join("")}</div>
          ${opts[id].length === 1 ? '<p class="note">لسه مفيش مكتب مسعّر الخدمة دي.</p>' : ""}</div>` : ""}</div>`;
    }
    async function launch() {
      const name = (guide.name || "").trim();
      if (!name) return toast("اكتب اسم مشروعك الأول", true);
      const btn = el.querySelector("#launch"); btn.disabled = true;
      const { data: co, error } = await sb.from("companies").insert({ owner_id: uid(), name, legal_form: e.name, status: "founding", is_demo: isPreview() }).select().single();
      if (error) { btn.disabled = false; return toast("ماقدرناش نسجل المشروع", true); }
      const rows = list.map((id) => { const o = pick(id); return { company_id: co.id, owner_id: uid(), service_id: id, office_id: o.officeId, quoted_fee: o.cost, quoted_days: o.days, is_demo: isPreview() }; });
      const { error: e2 } = await sb.from("requests").insert(rows);
      if (e2) { btn.disabled = false; return toast("اتسجل المشروع، لكن الطلبات ما اتعملتش. جرب تاني من الخريطة", true); }
      guide.answers = {}; guide.qi = 0; guide.choices = {}; guide.name = ""; guide.open = null;
      toast("اتعملت طلبات التأسيس، وتقدر تتابعها من لوحتك");
      location.hash = "#home/" + co.id;
    }
    draw();
  }

  // ---------- Existing company ----------
  async function companyNew(el) {
    const svcs = await services();
    const types = Object.values(svcs).filter((s) => s.kind === "renewal");
    el.innerHTML = `
      <section class="head"><span class="eyebrow">شركة قائمة</span><h1>ضيف شركتك ومستنداتها</h1>
        <p>اكتب تاريخ انتهاء كل مستند، والمنصة هتحسب إمتى تبدأ تجديده.</p></section>
      <form id="cf" class="panel">
        <div class="form-row two">
          <div class="field"><label for="c-name">اسم الشركة</label><input id="c-name" required></div>
          <div class="field"><label for="c-form">الشكل القانوني</label><select id="c-form"><option>شركة ذات مسئولية محدودة</option><option>شركة الشخص الواحد</option><option>منشأة فردية</option><option>شركة مساهمة</option><option>شركة توصية بسيطة</option></select></div>
        </div>
        <h2>المستندات</h2>
        ${types.map((t) => `<div class="form-row two"><div class="field"><label>${esc(t.title.replace("تجديد ", ""))}</label><p class="note">${esc(t.agency)}</p></div>
          <div class="field"><label for="exp-${t.id}">تاريخ الانتهاء</label><input type="date" id="exp-${t.id}"></div></div>`).join("")}
        <p class="note">سيب التاريخ فاضي لو الشركة مالهاش المستند ده.</p>
        <button class="btn primary" type="submit">احفظ الشركة</button>
      </form>`;
    el.querySelector("#cf").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = ev.target.querySelector("button[type=submit]"); btn.disabled = true;
      const { data: co, error } = await sb.from("companies").insert({ owner_id: uid(), name: el.querySelector("#c-name").value.trim(), legal_form: el.querySelector("#c-form").value, is_demo: isPreview() }).select().single();
      if (error) { btn.disabled = false; return toast("ماقدرناش نحفظ الشركة", true); }
      const docs = types.map((t) => ({ t, v: el.querySelector("#exp-" + t.id).value })).filter((x) => x.v)
        .map(({ t, v }) => ({ company_id: co.id, service_id: t.id, title: t.title.replace("تجديد ", ""), expires_on: v }));
      if (docs.length) { const { error: e2 } = await sb.from("documents").insert(docs); if (e2) toast("اتحفظت الشركة، لكن المستندات ما اتحفظتش", true); }
      toast("اتحفظت الشركة"); location.hash = "#home/" + co.id;
    });
  }

  async function docNew(el, companyId) {
    const svcs = await services();
    const types = Object.values(svcs).filter((s) => s.kind === "renewal");
    el.innerHTML = `<section class="head"><a class="back" href="#home/${esc(companyId)}">→ لوحتي</a><h1>ضيف مستند</h1></section>
      <form id="df" class="panel"><div class="form-row two">
        <div class="field"><label for="d-type">نوع المستند</label><select id="d-type">${types.map((t) => `<option value="${t.id}">${esc(t.title.replace("تجديد ", ""))}</option>`).join("")}</select></div>
        <div class="field"><label for="d-exp">تاريخ الانتهاء</label><input type="date" id="d-exp" required></div></div>
        <button class="btn primary" type="submit">احفظ المستند</button></form>`;
    el.querySelector("#df").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const t = svcs[el.querySelector("#d-type").value];
      const { error } = await sb.from("documents").insert({ company_id: companyId, service_id: t.id, title: t.title.replace("تجديد ", ""), expires_on: el.querySelector("#d-exp").value });
      if (error) return toast("ماقدرناش نحفظ المستند", true);
      toast("اتحفظ المستند"); location.hash = "#home/" + companyId;
    });
  }

  // ---------- Renewal ----------
  async function renew(el, docId) {
    const svcs = await services();
    const { data: d } = await sb.from("documents").select("*, companies(id,name,owner_id)").eq("id", docId).maybeSingle();
    if (!d) { el.innerHTML = `<section class="panel"><p>المستند ده مش موجود.</p></section>`; return; }
    const s = svcs[d.service_id], opts = await optionsFor(d.service_id);
    let pick = opts[1]?.key || "self";
    const draw = () => {
      el.innerHTML = `<section class="head"><a class="back" href="#home/${d.company_id}">→ لوحتي</a><span class="eyebrow">${esc(d.companies.name)}</span><h1>${esc(s.title)}</h1></section>
        <section class="panel"><div class="docs"><b>جهّز المستندات دي</b><ul>${s.docs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
          <div class="alts">${opts.map((o) => `<label class="alt"><input type="radio" name="alt" value="${o.key}" ${pick === o.key ? "checked" : ""}>
            <span class="n"><b>${esc(o.label)}</b><small>${optionLabel(o)}</small></span><span class="v"><b>${money(o.cost)}</b>${days(o.days)}</span></label>`).join("")}</div>
          <button class="btn primary" id="go" type="button">أكّد الطلب</button></section>`;
      el.querySelectorAll('input[name="alt"]').forEach((i) => i.addEventListener("change", () => { pick = i.value; draw(); }));
      el.querySelector("#go").addEventListener("click", async () => {
        const o = opts.find((x) => x.key === pick);
        const { data, error } = await sb.from("requests").insert({ company_id: d.company_id, owner_id: uid(), service_id: d.service_id, document_id: d.id,
          office_id: o.officeId, quoted_fee: o.cost, quoted_days: o.days, is_demo: isPreview() }).select().single();
        if (error) return toast("ماقدرناش نعمل الطلب", true);
        toast(o.officeId ? "اتبعت الطلب لـ" + o.label : "اتعمل الطلب، وتقدر تتابع خطواته بنفسك");
        location.hash = "#request/" + data.id;
      });
    };
    draw();
  }

  // ---------- Request tracking ----------
  async function request(el, id) {
    const svcs = await services();
    const [{ data: r }, { data: stages }, { data: events }] = await Promise.all([
      sb.from("requests").select("*, offices(name), companies(name)").eq("id", id).maybeSingle(),
      sb.from("request_stages").select("*").eq("request_id", id).order("idx"),
      sb.from("events").select("*").eq("request_id", id).order("created_at"),
    ]);
    if (!r) { el.innerHTML = `<section class="panel"><p>الطلب ده مش موجود.</p></section>`; return; }
    const s = svcs[r.service_id], self = !r.office_id;
    const cur = stages.findIndex((x) => !x.done_at);
    const EV = { created: "اتعمل الطلب", accepted: "المكتب قبل الطلب", stage_started: "بدأت مرحلة", stage_done: "خلصت مرحلة", done: "خلص الطلب", cancelled: "اتلغى الطلب", note: "ملاحظة" };
    el.innerHTML = `
      <section class="head"><a class="back" href="#home/${r.company_id}">→ لوحتي</a><span class="eyebrow">${esc(r.companies?.name || "")}</span><h1>${esc(s.title)}</h1>
        <p>${self ? "بتنفذ الطلب ده بنفسك، وتقدر تعلّم كل مرحلة لما تخلص." : `بينفذه ${esc(r.offices?.name || "")}. المكتب هو اللي بيحدّث المراحل.`}</p></section>
      <div class="grid2 wide">
        <section class="panel"><div class="row between"><h2>المراحل</h2><span class="chip ${STATUS[r.status][0]}">${STATUS[r.status][1]}</span></div>
          <div class="track">${stages.map((x, i) => `<div class="tr ${x.done_at ? "done" : i === cur && r.status !== "cancelled" ? "now" : ""}"><span class="dot" aria-hidden="true"></span>
            <div><p>${esc(x.title)}</p><small class="note">${x.done_at ? "خلصت " + fmtDate(x.done_at) : "المدة المتوقعة " + days(x.planned_days)}</small></div>
            ${self && i === cur && r.status !== "cancelled" ? `<button class="btn small" data-stage="${x.id}" type="button">خلصت</button>` : ""}</div>`).join("")}</div>
          ${r.status === "new" ? '<button class="btn danger small" id="cancel" type="button">الغي الطلب</button>' : ""}
        </section>
        <section class="panel"><h2>التفاصيل</h2>
          <div class="kv"><span>التكلفة المعلنة</span><b>${money(r.quoted_fee)}</b></div>
          <div class="kv"><span>المدة المعلنة</span><b>${days(r.quoted_days || 0)}</b></div>
          <div class="kv"><span>تاريخ الطلب</span><b>${fmtDate(r.created_at)}</b></div>
          <h3 class="sub">السجل</h3>
          ${events.map((e) => `<div class="kv"><span>${EV[e.kind] || esc(e.kind)}${e.note ? ": " + esc(e.note) : ""}</span><small>${fmtDate(e.created_at)}</small></div>`).join("")}
        </section>
      </div>`;
    el.querySelectorAll("[data-stage]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      const now = new Date().toISOString();
      const st = stages.find((x) => x.id === b.dataset.stage);
      const { error } = await sb.from("request_stages").update({ done_at: now, started_at: st.started_at || now }).eq("id", st.id);
      if (error) { b.disabled = false; return toast("ماقدرناش نحدّث المرحلة", true); }
      await sb.from("events").insert({ request_id: id, actor_id: uid(), kind: "stage_done", note: st.title });
      const last = stages.filter((x) => !x.done_at).length === 1;
      await sb.from("requests").update(last ? { status: "done", completed_at: now } : { status: "in_progress" }).eq("id", id);
      if (last) await finishRequest(r, svcs);
      request(el, id);
    }));
    el.querySelector("#cancel")?.addEventListener("click", async () => {
      const { error } = await sb.from("requests").update({ status: "cancelled" }).eq("id", id);
      if (error) return toast("ماقدرناش نلغي الطلب", true);
      await sb.from("events").insert({ request_id: id, actor_id: uid(), kind: "cancelled" });
      toast("اتلغى الطلب"); request(el, id);
    });
  }

  // Founding steps that produce an expiring document map to the renewal that keeps it valid.
  const RENEWAL_OF = { commercial_register: "cr_renewal", tax_card: "tax_card_renewal", shop_license: "license_renewal" };

  // A finished renewal moves the document's expiry forward; a finished founding
  // step adds its document; the last founding step makes the company active.
  async function finishRequest(r, svcs) {
    const s = svcs[r.service_id];
    if (r.document_id && s?.validity_days) {
      const { data: d } = await sb.from("documents").select("expires_on").eq("id", r.document_id).single();
      const base = new Date(Math.max(new Date(d.expires_on).getTime(), Date.now()));
      const next = new Date(base.getTime() + s.validity_days * R.DAY).toISOString().slice(0, 10);
      await sb.from("documents").update({ expires_on: next }).eq("id", r.document_id);
      return;
    }
    const renewal = svcs[RENEWAL_OF[r.service_id]];
    if (renewal && s?.validity_days) {
      const exp = new Date(Date.now() + s.validity_days * R.DAY).toISOString().slice(0, 10);
      await sb.from("documents").insert({ company_id: r.company_id, service_id: renewal.id, title: renewal.title.replace("تجديد ", ""), expires_on: exp });
    }
    if (s?.kind === "founding") {
      const { data: open } = await sb.from("requests").select("id").eq("company_id", r.company_id).not("status", "in", "(done,cancelled)");
      if (!open?.length) await sb.from("companies").update({ status: "active" }).eq("id", r.company_id);
    }
  }

  window.R.views.owner = { home, guide: guideView, plan, "company-new": companyNew, "doc-new": docNew, renew, request };
})();
