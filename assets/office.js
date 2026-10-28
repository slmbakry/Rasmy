// Office screens: incoming requests, accepting or declining, finishing stages, files and notes.
(function () {
  const { sb, esc, fmtDate, num, money, days, toast, state, officeId, services, filesBlock, stageLate, EVENTS, STATUS, icon } = window.R;
  const uid = () => state.profile.id;

  function noOffice(el) {
    el.innerHTML = state.profile.role === "admin"
      ? `<section class="panel"><p>اختار المكتب اللي عايز تجرب بيه من الشريط اللي فوق.</p></section>`
      : `<section class="panel"><p>حسابك مش مربوط بمكتب لسه. كلم مدير المنصة.</p></section>`;
  }

  // ---------- Requests list ----------
  async function home(el) {
    const oid = officeId();
    if (!oid) return noOffice(el);
    el.innerHTML = `<div class="loading">جاري التحميل</div>`;
    const svcs = await services();
    const [{ data: office }, { data: reqs }] = await Promise.all([
      sb.from("offices").select("name").eq("id", oid).maybeSingle(),
      sb.from("requests").select("*, companies(name), request_stages(idx,title,planned_days,started_at,done_at)").eq("office_id", oid).order("created_at", { ascending: false }),
    ]);
    const all = reqs || [];
    const groups = [
      ["new", "طلبات جديدة مستنية ردك", all.filter((r) => r.status === "new")],
      ["work", "شغال عليها", all.filter((r) => ["accepted", "in_progress"].includes(r.status))],
      ["done", "خلصت", all.filter((r) => r.status === "done").slice(0, 10)],
    ];
    const lateCount = groups[1][2].filter((r) => lateOf(r)).length;
    el.innerHTML = `
      <section class="head"><span class="eyebrow">${esc(office?.name || "المكتب")}</span><h1>الطلبات</h1>
        <p>اقبل الطلب الأول، وبعدها علّم كل مرحلة لما تخلص. صاحب العمل بيشوف التحديث في نفس اللحظة.</p></section>
      <div class="kpis">
        ${kpi("mail", groups[0][2].length ? "warn" : "", groups[0][2].length, "طلب جديد")}
        ${kpi("list", "", groups[1][2].length, "شغال عليه")}
        ${kpi("alert", lateCount ? "bad" : "ok", lateCount, "متأخر")}
        ${kpi("check", "ok", all.filter((r) => r.status === "done").length, "خلص")}
      </div>
      ${groups.map(([k, title, list]) => `<section class="panel"><h2>${title}</h2>
        ${list.length ? `<div class="reqs">${list.map((r) => card(r, svcs)).join("")}</div>` : `<p class="empty">${k === "new" ? "مفيش طلبات جديدة." : "مفيش حاجة هنا."}</p>`}</section>`).join("")}`;
  }

  function kpi(ic, tone, n, label) {
    return `<div class="kpi ${tone}"><span class="tile-ic ${tone}">${icon(ic, 22)}</span><div><b>${num(n)}</b><span>${label}</span></div></div>`;
  }

  // Days late on the stage in progress, if any.
  function lateOf(r) {
    const st = (r.request_stages || []).sort((a, b) => a.idx - b.idx).find((x) => !x.done_at);
    return st ? stageLate(st) : 0;
  }

  function card(r, svcs) {
    const st = (r.request_stages || []).slice().sort((a, b) => a.idx - b.idx);
    const done = st.filter((x) => x.done_at).length, late = ["accepted", "in_progress"].includes(r.status) ? lateOf(r) : 0;
    return `<a class="req${late ? " late" : ""}" href="#job/${r.id}"><div class="row between"><b>${esc(svcs[r.service_id]?.title || r.service_id)}</b>
        ${late ? `<span class="chip bad">متأخر ${days(late)}</span>` : `<span class="chip ${STATUS[r.status][0]}">${STATUS[r.status][1]}</span>`}</div>
      <small>${esc(r.companies?.name || "")} · ${money(r.quoted_fee)} · ${days(r.quoted_days || 0)}${r.is_demo ? " · تجريبي" : ""}</small>
      ${st.length ? `<div class="meter"><i style="width:${Math.round((done / st.length) * 100)}%"></i></div>` : ""}</a>`;
  }

  // ---------- One request ----------
  async function job(el, id) {
    const oid = officeId();
    if (!oid) return noOffice(el);
    const svcs = await services();
    const [{ data: r }, { data: stages }, { data: events }] = await Promise.all([
      sb.from("requests").select("*, companies(name,legal_form)").eq("id", id).eq("office_id", oid).maybeSingle(),
      sb.from("request_stages").select("*").eq("request_id", id).order("idx"),
      sb.from("events").select("*").eq("request_id", id).order("created_at"),
    ]);
    if (!r) { el.innerHTML = `<section class="panel"><p>الطلب ده مش موجود.</p><a class="btn" href="#home">رجوع للطلبات</a></section>`; return; }
    const { data: owner } = await sb.from("profiles").select("email").eq("id", r.owner_id).maybeSingle();
    const s = svcs[r.service_id];
    const working = ["accepted", "in_progress"].includes(r.status);
    const cur = stages.findIndex((x) => !x.done_at);
    el.innerHTML = `
      <section class="head"><a class="back" href="#home">→ الطلبات</a><span class="eyebrow">${esc(r.companies?.name || "")}</span><h1>${esc(s?.title || r.service_id)}</h1>
        <p>${r.status === "new" ? "اقبل الطلب عشان تبدأ أول مرحلة، أو اعتذر وقول السبب." : working ? "علّم المرحلة لما تخلص، والمرحلة اللي بعدها هتبدأ لوحدها." : ""}</p></section>
      ${r.status === "new" ? `<section class="panel"><h2>رد على الطلب</h2>
        <div class="row"><button class="btn primary" id="accept" type="button">اقبل الطلب</button></div>
        <div class="field"><label for="why">لو هتعتذر، اكتب السبب</label><input id="why"></div>
        <button class="btn danger small" id="decline" type="button">اعتذر عن الطلب</button></section>` : ""}
      <div class="grid2 wide">
        <section class="panel"><div class="row between"><h2>المراحل</h2><span class="chip ${STATUS[r.status][0]}">${STATUS[r.status][1]}</span></div>
          <div class="track">${stages.map((x, i) => R.stageRow(x, i === cur && working, i === cur && working)).join("")}</div>
          ${working ? `<form id="nf" class="stack"><div class="field"><label for="note">ملاحظة لصاحب العمل</label><input id="note" required></div>
            <button class="btn small" type="submit">ابعت الملاحظة</button></form>` : ""}
        </section>
        <section class="panel"><h2>التفاصيل</h2>
          <div class="kv"><span>صاحب العمل</span><b class="ltr">${esc(owner?.email || "")}</b></div>
          ${r.companies?.legal_form ? `<div class="kv"><span>الشكل القانوني</span><b>${esc(r.companies.legal_form)}</b></div>` : ""}
          <div class="kv"><span>التكلفة المعلنة</span><b>${money(r.quoted_fee)}</b></div>
          <div class="kv"><span>المدة المعلنة</span><b>${days(r.quoted_days || 0)}</b></div>
          <div class="kv"><span>تاريخ الطلب</span><b>${fmtDate(r.created_at)}</b></div>
          ${s?.docs?.length ? `<div class="docs"><b>المستندات المطلوبة</b><ul>${s.docs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
          <div id="files"></div>
          <h3 class="sub">السجل</h3>
          ${events.map((e) => `<div class="kv"><span>${EVENTS[e.kind] || esc(e.kind)}${e.note ? ": " + esc(e.note) : ""}</span><small>${fmtDate(e.created_at)}</small></div>`).join("")}
        </section>
      </div>`;
    filesBlock(el.querySelector("#files"), id);
    const again = () => job(el, id);
    const log = (kind, note) => sb.from("events").insert({ request_id: id, actor_id: uid(), kind, note: note || null });

    el.querySelector("#accept")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      const now = new Date().toISOString();
      const { error } = await sb.from("requests").update({ status: "accepted", accepted_at: now }).eq("id", id).eq("status", "new");
      if (error) { e.target.disabled = false; return toast("ماقدرناش نقبل الطلب", true); }
      if (stages[0]) await sb.from("request_stages").update({ started_at: now }).eq("id", stages[0].id).is("started_at", null);
      await log("accepted");
      toast("اتقبل الطلب، وبدأت أول مرحلة"); again();
    });
    el.querySelector("#decline")?.addEventListener("click", async () => {
      const why = el.querySelector("#why").value.trim();
      if (!why) return toast("اكتب سبب الاعتذار الأول", true);
      const { error } = await sb.from("requests").update({ status: "cancelled" }).eq("id", id).eq("status", "new");
      if (error) return toast("ماقدرناش نسجل الاعتذار", true);
      await log("declined", why);
      toast("اتسجل الاعتذار"); location.hash = "#home";
    });
    el.querySelectorAll("[data-stage]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      const now = new Date().toISOString();
      const st = stages.find((x) => x.id === b.dataset.stage);
      const { error } = await sb.from("request_stages").update({ done_at: now, started_at: st.started_at || now }).eq("id", st.id);
      if (error) { b.disabled = false; return toast("ماقدرناش نحدّث المرحلة", true); }
      toast(stages.filter((x) => !x.done_at).length === 1 ? "خلص الطلب كله" : "خلصت المرحلة"); again();
    }));
    el.querySelector("#nf")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await log("note", el.querySelector("#note").value.trim());
      if (error) return toast("ماقدرناش نبعت الملاحظة", true);
      toast("اتبعتت الملاحظة"); again();
    });
  }

  window.R.views.office = { home, job };
})();
