// Business-owner screens: dashboard, guide and plan, adding a company, renewals, request tracking.
(function () {
  const { sb, esc, fmtDate, num, money, days, toast, state, isPreview, services, docStatus, optionsFor, optionLabel, filesBlock, stageLate, EVENTS, STATUS, icon, span, optionCards } = window.R;
  const uid = () => state.profile.id;

  // ---------- Dashboard ----------
  // One company at a time: a navy summary band, what needs the owner now,
  // documents with how much validity is left, and requests stage by stage.
  async function home(el, companyId) {
    el.innerHTML = `<div class="loading">جاري التحميل</div>`;
    const svcs = await services();
    const { data: companies } = await sb.from("companies").select("*").eq("owner_id", uid()).neq("status", "closed").order("created_at");
    if (!companies?.length) {
      el.innerHTML = `
        <section class="head"><span class="eyebrow">لوحتي</span><h1>ابدأ بأول شركة</h1>
          <p>لو عندك مشروع جديد، الدليل هيوريك خطواتك. ولو عندك شركة قائمة، ضيفها بمستنداتها وتواريخ انتهائها، والمنصة هتفكرك قبل كل تجديد.</p></section>
        <div class="choices">
          <a class="choice" href="#guide"><span class="tile-ic">${icon("pulse", 24)}</span><h3>عندي فكرة أو مشروع مش مسجل</h3><p>كام سؤال، وبعدها خريطة خطواتك بالتكلفة والمدة.</p></a>
          <a class="choice" href="#company-new"><span class="tile-ic ok">${icon("building", 24)}</span><h3>عندي شركة قائمة</h3><p>ضيف مستنداتها، وتابع تجديداتها من مكان واحد.</p></a>
        </div>`;
      return;
    }
    const co = companies.find((c) => c.id === companyId) || companies[0];
    const [{ data: docs }, { data: reqs }, { data: notes }] = await Promise.all([
      sb.from("documents").select("*").eq("company_id", co.id).order("expires_on", { nullsFirst: false }),
      sb.from("requests").select("*, offices(name), request_stages(idx,title,planned_days,started_at,done_at)").eq("company_id", co.id).order("created_at", { ascending: false }),
      sb.from("notifications").select("*").eq("user_id", uid()).order("created_at", { ascending: false }).limit(4),
    ]);
    const open = (reqs || []).filter((r) => !["done", "cancelled"].includes(r.status));
    const doneWithOffice = (reqs || []).filter((r) => r.status === "done" && r.office_id);
    const { data: rated } = doneWithOffice.length ? await sb.from("ratings").select("request_id").in("request_id", doneWithOffice.map((r) => r.id)) : { data: [] };
    const ratedIds = new Set((rated || []).map((x) => x.request_id));
    const toRate = doneWithOffice.find((r) => !ratedIds.has(r.id));
    const openFor = (docId) => open.find((r) => r.document_id === docId);

    const list = (docs || []).map((d) => {
      const svc = svcs[d.service_id], st = docStatus(d, svc), req = openFor(d.id);
      return { d, svc, st, req, cls: req ? "busy" : st.cls };
    });
    const count = (k) => list.filter((x) => x.cls === k).length;
    const healthy = count("ok");

    // What the owner should do, most urgent first.
    const todo = [];
    list.filter((x) => x.cls === "bad").forEach((x) => todo.push({ tone: "bad", ic: "alert", title: `${x.d.title}: انتهت صلاحيته من ${span(-x.st.left)}`,
      sub: "جدده في أسرع وقت عشان ماتتعرضش لغرامة", href: x.svc?.kind === "renewal" ? `#renew/${x.d.id}` : null, cta: "جدد دلوقتي" }));
    list.filter((x) => x.cls === "warn").forEach((x) => todo.push({ tone: "warn", ic: "clock", title: `ابدأ تجديد ${x.d.title}`,
      sub: `ينتهي بعد ${span(x.st.left)}، والتجديد بياخد وقت`, href: x.svc?.kind === "renewal" ? `#renew/${x.d.id}` : null, cta: "اطلب التجديد" }));
    open.filter((r) => !r.office_id).forEach((r) => todo.push({ tone: "warn", ic: "arrow", title: `${svcs[r.service_id]?.title || ""}: خطوة عندك`,
      sub: "بتعمله بنفسك، علّم كل مرحلة لما تخلص", href: `#request/${r.id}`, cta: "كمّل الخطوة", soft: true }));
    open.filter((r) => r.status === "new" && r.office_id && Date.now() - new Date(r.created_at) > R.DAY).forEach((r) => todo.push({ tone: "info", ic: "clock",
      title: `${r.offices?.name || "المكتب"} لسه مارد`, sub: `${svcs[r.service_id]?.title || ""} · تقدر تلغي وتختار مكتب تاني`, href: `#request/${r.id}`, cta: "افتح الطلب", soft: true }));

    const ring = list.length ? Math.round((healthy / list.length) * 163) : 0;
    const summary = !list.length ? "لسه مفيش مستندات للشركة دي."
      : count("bad") || count("warn") ? [count("bad") && `${num(count("bad"))} منتهي`, count("warn") && `${num(count("warn"))} قرب ينتهي`, count("busy") && `${num(count("busy"))} بيتجدد`].filter(Boolean).join("، ") + ". التفاصيل تحت، وجنب كل واحد الخطوة الجاية."
      : "كل مستنداتك سليمة. هنفكرك قبل أي تجديد بوقت كفاية.";

    el.innerHTML = `
      <section class="head hero">
        <div class="tabs" role="tablist" aria-label="شركاتك">${companies.map((x) => `<a class="tab" role="tab" aria-selected="${x.id === co.id}" href="#home/${x.id}">${esc(x.name)}${x.is_demo ? " · تجريبي" : ""}</a>`).join("")}
          <a class="tab add" href="#company-new">+ شركة جديدة</a></div>
        <div class="hero-row">
          <div class="hero-t"><span class="eyebrow">${esc(co.legal_form || "")}${co.status === "founding" ? " · تحت التأسيس" : " · نشطة"}</span>
            <h1>${esc(co.name)}</h1><p>${summary}</p></div>
          ${list.length ? `<div class="ring"><svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${num(healthy)} من ${num(list.length)} مستندات سليمة"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="#1F9D74" stroke-width="7" stroke-linecap="round" stroke-dasharray="${ring} 163" transform="rotate(-90 32 32)"/></svg>
            <div><b>${num(healthy)} من ${num(list.length)}</b><span>مستندات سليمة</span></div></div>` : ""}
        </div>
      </section>
      <div class="kpis">
        ${kpi("docOk", "ok", healthy, "مستندات سليمة")}${kpi("clock", "warn", count("warn") + count("busy"), "تجديد قريب")}${kpi("alert", "bad", count("bad"), "منتهي")}${kpi("list", "", open.length, "طلبات شغالة")}
      </div>
      <div class="split">
        <div class="split-main">
          <section class="panel">
            <div class="row between"><h2>المطلوب منك دلوقتي</h2>${todo.length ? '<span class="note">مرتب حسب الأهمية</span>' : ""}</div>
            ${todo.length ? todo.map((t) => `<div class="todo ${t.tone}"><span class="todo-ic">${icon(t.ic)}</span>
              <div class="todo-t"><b>${esc(t.title)}</b><small>${esc(t.sub)}</small></div>
              ${t.href ? `<a class="btn ${t.soft ? "" : t.tone === "bad" ? "danger-solid" : "primary"}" href="${t.href}">${t.cta}</a>` : ""}</div>`).join("")
              : `<div class="todo ok"><span class="todo-ic">${icon("check")}</span><div class="todo-t"><b>مفيش حاجة مطلوبة منك دلوقتي</b><small>هنبعتلك تنبيه أول ما حاجة تحتاجك.</small></div></div>`}
          </section>
          <section class="panel">
            <div class="row between"><h2>المستندات</h2><a class="link" href="#doc-new/${co.id}">+ ضيف مستند</a></div>
            ${list.length ? `<div class="doc-grid">${list.map(docCard).join("")}</div>`
              : `<p class="empty">${co.status === "founding" ? "المستندات هتظهر هنا أول ما خطوات التأسيس تخلص." : "ضيف السجل والبطاقة الضريبية والتراخيص، وإحنا هنفكرك قبل كل تجديد."}</p>`}
          </section>
          <section class="panel">
            <div class="row between"><h2>طلبات شغالة</h2><span class="note">بتتحدث مع كل خطوة</span></div>
            ${open.length ? open.map(reqCard).join("") : '<p class="empty">مفيش طلبات شغالة.</p>'}
          </section>
        </div>
        <aside class="split-side">
          <section class="panel">
            <div class="row between"><h2>آخر التحديثات</h2><a class="link" href="#alerts">الكل</a></div>
            ${notes?.length ? notes.map((n) => `<a class="feed" href="${esc(n.link || "#alerts")}"><span class="dot ${feedTone(n.kind)}" aria-hidden="true"></span>
              <span><b>${esc(n.title)}</b><small>${esc(n.body || "")}${n.body ? " · " : ""}${fmtDate(n.created_at)}</small></span></a>`).join("")
              : '<p class="empty">مفيش تحديثات لسه.</p>'}
          </section>
          ${toRate ? `<section class="panel navy"><span class="tile-ic gold">${icon("star")}</span><h2>قيّم ${esc(toRate.offices?.name || "المكتب")}</h2>
            <p>خلّص ${esc(svcs[toRate.service_id]?.title || "طلبك")}. رأيك بيساعد غيرك يختار.</p><a class="btn gold" href="#request/${toRate.id}">قيّم دلوقتي</a></section>` : ""}
          ${companies.length > 1 ? "" : `<section class="panel"><span class="tile-ic">${icon("plus")}</span><h2>عندك شركة تانية؟</h2><p class="note">ضيفها وتابع مستنداتها من نفس المكان.</p><a class="btn" href="#company-new">ضيف شركة</a></section>`}
        </aside>
      </div>`;

    function kpi(ic, tone, n, label) {
      return `<div class="kpi ${tone}"><span class="tile-ic ${tone}">${icon(ic, 22)}</span><div><b>${num(n)}</b><span>${label}</span></div></div>`;
    }
    function feedTone(kind) {
      return ["late", "overdue", "expired", "escalated", "declined"].includes(kind) ? "bad" : ["renew", "wait"].includes(kind) ? "warn" : "ok";
    }
    function docCard(x) {
      const { d, svc, st, req, cls } = x;
      const label = { ok: "سليم", warn: "جدد قريب", bad: "منتهي", busy: "بيتجدد" }[cls];
      const pct = st.left === null ? 100 : st.left <= 0 ? 0 : Math.max(4, Math.min(100, Math.round((st.left / (svc?.validity_days || 365)) * 100)));
      const when = st.left === null ? "مالوش تاريخ انتهاء" : st.left < 0 ? `انتهى من ${span(-st.left)}` : `ينتهي بعد ${span(st.left)}`;
      return `<a class="doc-card ${cls}" href="${req ? `#request/${req.id}` : svc?.kind === "renewal" && cls !== "ok" ? `#renew/${d.id}` : `#home/${co.id}`}">
        <div class="row between"><b>${esc(d.title)}</b><span class="chip ${cls === "busy" ? "warn" : cls}">${label}</span></div>
        <div class="bar-v" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <small>${when}${req ? ` · ${esc(req.offices?.name || "بتجدده بنفسك")}` : cls === "ok" && st.startOn ? ` · التذكير ${fmtDate(st.startOn)}` : ""}</small></a>`;
    }
    function reqCard(r) {
      const s = svcs[r.service_id], st = (r.request_stages || []).slice().sort((a, b) => a.idx - b.idx);
      const cur = st.find((x) => !x.done_at), late = cur && ["accepted", "in_progress"].includes(r.status) ? stageLate(cur) : 0;
      const chip = r.status === "new" && r.office_id ? ["", "مستني رد المكتب"] : late ? ["bad", `متأخر ${days(late)}`] : !r.office_id ? ["warn", "خطوة عندك"] : ["ok", "في الموعد"];
      const seg = (x) => {
        if (x.done_at) return 100;
        if (x !== cur || !x.started_at) return 0;
        return Math.max(8, Math.min(92, Math.round(((Date.now() - new Date(x.started_at)) / (x.planned_days * R.DAY)) * 100)));
      };
      return `<a class="req-card" href="#request/${r.id}">
        <div class="row"><span class="avatar">${r.office_id ? esc((r.offices?.name || "م").replace(/^مكتب\s+/, "").charAt(0)) : icon("person")}</span>
          <span class="grow"><b>${esc(s?.title || r.service_id)}</b><small>${r.office_id ? esc(r.offices?.name || "") : "بتعمله بنفسك"} · ${money(r.quoted_fee)}</small></span>
          <span class="chip ${chip[0]}">${chip[1]}</span></div>
        ${st.length ? `<div class="segs">${st.map((x) => `<div class="seg ${x === cur ? (late ? "late" : "now") : x.done_at ? "done" : ""}"><span><i style="width:${seg(x)}%"></i></span><small>${esc(x.title)}</small></div>`).join("")}</div>` : ""}
      </a>`;
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

  const ANSWER_ICONS = { alone: "person", many: "users", shop: "building", online: "pulse", factory: "building", s: "chart", m: "chart", l: "chart", yes: "users", no: "person" };

  function guideView(el) {
    const Q = QUESTIONS[guide.qi], val = guide.answers[Q.key];
    el.innerHTML = `
      <section class="head"><span class="eyebrow">الدليل</span><h1>كام سؤال بسيط، وبعدها خريطتك جاهزة</h1>
        <p>هنقترح عليك الكيان المناسب، والخطوات بالترتيب، وتكلفة ومدة كل خطوة.</p></section>
      <section class="panel quiz">
        <div class="row between"><span class="eyebrow">سؤال ${num(guide.qi + 1)} من ${num(QUESTIONS.length)}</span>
          <div class="progress" aria-hidden="true">${QUESTIONS.map((_, i) => `<span class="${i <= guide.qi ? "on" : ""}"></span>`).join("")}</div></div>
        <h2 id="q-title">${Q.q}</h2>
        <div class="opts" role="radiogroup" aria-labelledby="q-title">${Q.opts.map(([v, b, s]) =>
          `<label class="opt"><input type="radio" name="q" id="q-${v}" value="${v}" ${val === v ? "checked" : ""}><span class="tile-ic">${icon(ANSWER_ICONS[v] || "check", 22)}</span><span><b>${b}</b><small>${s}</small></span></label>`).join("")}</div>
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
          <p>الكيان المناسب ليك: <b class="on-navy">${e.name}</b>. ${e.why}</p>
          <div class="chips">${a.turnover !== "l" ? '<span class="chip on-navy">مؤهل للنظام الضريبي المبسط</span>' : ""}${a.turnover !== "s" ? '<span class="chip on-navy">مطلوب تسجيل القيمة المضافة</span>' : ""}</div></section>
        <div class="kpis">
          <div class="kpi"><span class="tile-ic">${icon("list", 22)}</span><div><b>${num(list.length)}</b><span>خطوات</span></div></div>
          <div class="kpi"><span class="tile-ic ok">${icon("chart", 22)}</span><div><b>${money(cost)}</b><span>التكلفة التقريبية</span></div></div>
          <div class="kpi"><span class="tile-ic warn">${icon("clock", 22)}</span><div><b>${days(time)}</b><span>المدة لو ورا بعض</span></div></div>
        </div>
        <div class="split">
          <div class="split-main steps">${list.map((id, i) => stepView(id, i)).join("")}</div>
          <aside class="split-side"><section class="panel sum">
            <h2>ابدأ التنفيذ</h2>
            <div><div class="kv"><span>التكلفة التقريبية</span><b>${money(cost)}</b></div><div class="kv"><span>منها رسوم حكومية</span><b>${money(gov)}</b></div><div class="kv"><span>المدة لو الخطوات ورا بعض</span><b>${days(time)}</b></div></div>
            <div class="field"><label for="co-name">اسم مشروعك</label><input id="co-name" placeholder="مثلاً: مخبز النور" value="${esc(guide.name || "")}"></div>
            <button class="btn primary" id="launch" type="button">ابدأ التنفيذ</button>
            <p class="note">الأسعار من المكاتب المعتمدة، والرسوم الحكومية تقديرية وبتتأكد قبل الدفع.</p>
          </section></aside>
        </div>`;
      el.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => { guide.open = guide.open === b.dataset.open ? null : b.dataset.open; draw(); }));
      el.querySelectorAll("input[data-step]").forEach((i) => i.addEventListener("change", () => { guide.choices[i.dataset.step] = i.value; draw(); }));
      el.querySelector("#co-name").addEventListener("input", (ev) => { guide.name = ev.target.value; });
      el.querySelector("#launch").addEventListener("click", launch);
    };
    const pick = (id) => opts[id].find((o) => o.key === guide.choices[id]) || opts[id][1] || opts[id][0];
    function stepView(id, i) {
      const s = svcs[id], open = guide.open === id, cur = pick(id);
      return `<div class="step${open ? " open" : ""}"><button type="button" class="step-h" data-open="${id}" aria-expanded="${open}"><span class="num">${num(i + 1)}</span>
        <span class="t"><b>${esc(s.title)}</b><small>${esc(s.agency)}</small></span>
        <span class="step-pick"><b>${money(cur.cost)}</b><small>${esc(cur.label)} · ${days(cur.days)}</small></span>
        <span class="chev" aria-hidden="true">${icon("arrow", 18)}</span></button>
        ${open ? `<div class="step-b"><div class="docs"><b>المستندات المطلوبة</b><ul>${s.docs.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div>
          <b>مين ينفذها؟</b>${optionCards(opts[id], "alt-" + id, cur.key, `data-step="${id}"`)}
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
      <form id="cf" class="stack">
        <section class="panel">
          <h2>بيانات الشركة</h2>
          <div class="form-row two">
            <div class="field"><label for="c-name">اسم الشركة</label><input id="c-name" required></div>
            <div class="field"><label for="c-form">الشكل القانوني</label><select id="c-form"><option>شركة ذات مسئولية محدودة</option><option>شركة الشخص الواحد</option><option>منشأة فردية</option><option>شركة مساهمة</option><option>شركة توصية بسيطة</option></select></div>
          </div>
        </section>
        <section class="panel">
          <div class="row between"><h2>المستندات</h2><span class="note">سيب التاريخ فاضي لو الشركة مالهاش المستند</span></div>
          <div class="doc-inputs">${types.map((t) => `<div class="doc-input"><span class="tile-ic">${icon("doc", 22)}</span>
            <div class="field"><label for="exp-${t.id}">${esc(t.title.replace("تجديد ", ""))}</label><small class="note">${esc(t.agency)} · تاريخ الانتهاء</small><input type="date" id="exp-${t.id}"></div></div>`).join("")}</div>
          <button class="btn primary" type="submit">احفظ الشركة</button>
        </section>
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
    const st = docStatus(d, s);
    const when = st.left === null ? "" : st.left < 0 ? `انتهى من ${span(-st.left)}` : `ينتهي بعد ${span(st.left)}`;
    const draw = () => {
      const o = opts.find((x) => x.key === pick);
      el.innerHTML = `<section class="head"><a class="back" href="#home/${d.company_id}">→ لوحتي</a><span class="eyebrow">${esc(d.companies.name)}</span><h1>${esc(s.title)}</h1>
          <p>${when ? `${esc(d.title)}: ${when}. ` : ""}قارن واختار مين ينفذ التجديد.</p></section>
        <div class="split">
          <section class="panel split-main"><h2>اختار مين ينفذ</h2>
            ${optionCards(opts, "alt", pick)}
            <div class="confirm"><span>${esc(o.label)} · <b>${money(o.cost)}</b> · ${days(o.days)}</span><button class="btn primary" id="go" type="button">أكّد الطلب</button></div>
          </section>
          <aside class="split-side">
            <section class="panel"><h2>جهّز المستندات دي</h2><ul class="checklist">${s.docs.map((x) => `<li>${icon("check", 16)}${esc(x)}</li>`).join("")}</ul></section>
            <section class="panel"><h2>إزاي اخترنا الترتيب</h2><p class="note">التقييم من أصحاب الأعمال بعد كل طلب، ونسبة الالتزام بالمواعيد محسوبة من تواريخ الطلبات نفسها.</p></section>
          </aside>
        </div>`;
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
  // Finishing a stage is a single update: database triggers start the next
  // stage, log events, close the request and extend or add the document.
  async function request(el, id) {
    const svcs = await services();
    const [{ data: r }, { data: stages }, { data: events }] = await Promise.all([
      sb.from("requests").select("*, offices(name,phone), companies(name)").eq("id", id).maybeSingle(),
      sb.from("request_stages").select("*").eq("request_id", id).order("idx"),
      sb.from("events").select("*").eq("request_id", id).order("created_at"),
    ]);
    if (!r) { el.innerHTML = `<section class="panel"><p>الطلب ده مش موجود.</p></section>`; return; }
    const s = svcs[r.service_id], self = !r.office_id;
    const canRate = r.status === "done" && r.office_id;
    const { data: rating } = canRate ? await sb.from("ratings").select("*").eq("request_id", id).maybeSingle() : { data: null };
    const cur = stages.findIndex((x) => !x.done_at);
    const open = !["done", "cancelled"].includes(r.status);
    const doneCount = stages.filter((x) => x.done_at).length;
    const due = new Date(new Date(r.accepted_at || r.created_at).getTime() + (r.quoted_days || 0) * R.DAY);
    const lateNow = cur >= 0 && open ? stageLate(stages[cur]) : 0;
    el.innerHTML = `
      <section class="head"><a class="back" href="#home/${r.company_id}">→ لوحتي</a><span class="eyebrow">${esc(r.companies?.name || "")}</span><h1>${esc(s.title)}</h1>
        <p>${self ? "بتنفذ الطلب ده بنفسك، وتقدر تعلّم كل مرحلة لما تخلص." : `بينفذه ${esc(r.offices?.name || "")}. المكتب هو اللي بيحدّث المراحل.`}</p></section>
      <div class="kpis">
        <div class="kpi ${STATUS[r.status][0]}"><span class="tile-ic ${STATUS[r.status][0]}">${icon(r.status === "done" ? "check" : "pulse", 22)}</span><div><b>${STATUS[r.status][1]}</b><span>الحالة</span></div></div>
        <div class="kpi ${lateNow ? "bad" : ""}"><span class="tile-ic ${lateNow ? "bad" : ""}">${icon("list", 22)}</span><div><b>${num(doneCount)} من ${num(stages.length)}</b><span>${lateNow ? `المرحلة متأخرة ${days(lateNow)}` : "مراحل خلصت"}</span></div></div>
        <div class="kpi"><span class="tile-ic ok">${icon("chart", 22)}</span><div><b>${money(r.quoted_fee)}</b><span>التكلفة المعلنة</span></div></div>
        <div class="kpi"><span class="tile-ic warn">${icon("clock", 22)}</span><div><b>${r.status === "done" ? fmtDate(r.completed_at) : fmtDate(due)}</b><span>${r.status === "done" ? "خلص يوم" : "الموعد المتوقع"}</span></div></div>
      </div>
      ${!self && r.status === "new" ? '<p class="alert">الطلب لسه مستني المكتب يقبله.</p>' : ""}
      ${r.escalated_at && open ? '<p class="alert">الإدارة اتبلغت بالتأخير ده وبتتابعه مع المكتب.</p>' : ""}
      <div class="split">
        <div class="split-main">
          ${canRate ? rateBlock(rating, r.offices?.name) : ""}
          <section class="panel"><h2>المراحل</h2>
            <div class="track">${stages.map((x, i) => stageRow(x, i === cur && open, self && i === cur && open)).join("")}</div>
            ${r.status === "new" ? '<button class="btn danger small" id="cancel" type="button">الغي الطلب</button>' : ""}
          </section>
        </div>
        <aside class="split-side">
          ${self ? "" : `<section class="panel"><div class="row"><span class="avatar">${esc((r.offices?.name || "م").replace(/^مكتب\s+/, "").charAt(0))}</span>
            <span class="grow"><b>${esc(r.offices?.name || "")}</b><small class="note">المكتب المنفذ</small></span></div>
            ${r.offices?.phone ? `<a class="btn" href="tel:${esc(r.offices.phone)}"><span class="ltr">${esc(r.offices.phone)}</span></a>` : ""}</section>`}
          <section class="panel" id="files"></section>
          <section class="panel"><h2>السجل</h2>
            ${events.slice().reverse().map((e) => `<div class="feed"><span class="dot ${["declined", "cancelled"].includes(e.kind) ? "bad" : e.kind === "note" || e.kind === "file" ? "warn" : ""}" aria-hidden="true"></span>
              <span><b>${EVENTS[e.kind] || esc(e.kind)}</b><small>${e.note ? esc(e.note) + " · " : ""}${fmtDate(e.created_at)}</small></span></div>`).join("")}
          </section>
        </aside>
      </div>`;
    filesBlock(el.querySelector("#files"), id);
    el.querySelector("#rate")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      if (!f.get("pro") || !f.get("speed")) return toast("اختار درجة للاحترافية والسرعة", true);
      const { error } = await sb.from("ratings").insert({ request_id: id, office_id: r.office_id, owner_id: uid(),
        professionalism: Number(f.get("pro")), speed: Number(f.get("speed")), comment: f.get("comment").trim() || null });
      if (error) return toast("ماقدرناش نحفظ التقييم", true);
      await sb.from("events").insert({ request_id: id, actor_id: uid(), kind: "rated" });
      toast("شكراً، اتحفظ تقييمك"); request(el, id);
    });
    el.querySelectorAll("[data-stage]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      const now = new Date().toISOString();
      const st = stages.find((x) => x.id === b.dataset.stage);
      const { error } = await sb.from("request_stages").update({ done_at: now, started_at: st.started_at || now }).eq("id", st.id);
      if (error) { b.disabled = false; return toast("ماقدرناش نحدّث المرحلة", true); }
      request(el, id);
    }));
    el.querySelector("#cancel")?.addEventListener("click", async () => {
      const { error } = await sb.from("requests").update({ status: "cancelled" }).eq("id", id);
      if (error) return toast("ماقدرناش نلغي الطلب", true);
      await sb.from("events").insert({ request_id: id, actor_id: uid(), kind: "cancelled" });
      toast("اتلغى الطلب"); request(el, id);
    });
  }

  // After an office finishes, the owner rates it once. Speed is also measured from dates.
  function rateBlock(rating, office) {
    if (rating) return `<section class="panel"><h2>تقييمك للمكتب</h2>
      <div class="kv"><span>الاحترافية</span><b>${num(rating.professionalism)} من ٥</b></div>
      <div class="kv"><span>السرعة</span><b>${num(rating.speed)} من ٥</b></div>
      ${rating.comment ? `<p class="note">${esc(rating.comment)}</p>` : ""}</section>`;
    const scale = (name) => `<div class="stars">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="${name}" value="${n}"><span>${num(n)}</span></label>`).join("")}</div>`;
    return `<section class="panel"><h2>قيّم ${esc(office || "المكتب")}</h2>
      <p class="note">تقييمك بيساعد أصحاب الأعمال التانيين يختاروا. ده بيتحسب مع نسبة التزام المكتب بالمواعيد.</p>
      <form id="rate" class="rate">
        <div class="field"><label>الاحترافية والتعامل</label>${scale("pro")}</div>
        <div class="field"><label>السرعة</label>${scale("speed")}</div>
        <div class="field"><label for="comment">تعليق، لو حابب</label><input id="comment" name="comment"></div>
        <button class="btn primary" type="submit">احفظ التقييم</button>
      </form></section>`;
  }

  // One row of the stage track, shared with the office screens.
  function stageRow(x, isNow, canFinish) {
    const late = isNow ? stageLate(x) : 0;
    const note = x.done_at ? "خلصت " + fmtDate(x.done_at)
      : late ? `متأخرة ${days(late)}` : "المدة المتوقعة " + days(x.planned_days);
    return `<div class="tr ${x.done_at ? "done" : isNow ? "now" : ""}${late ? " late" : ""}"><span class="dot" aria-hidden="true"></span>
      <div><p>${esc(x.title)}</p><small class="note">${note}</small></div>
      ${canFinish ? `<button class="btn small" data-stage="${x.id}" type="button">خلصت</button>` : ""}</div>`;
  }
  window.R.stageRow = stageRow;

  window.R.views.owner = { home, guide: guideView, plan, "company-new": companyNew, "doc-new": docNew, renew, request };
})();
