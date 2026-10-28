// Shared state and helpers for every screen.
(function () {
  const cfg = window.RASMY_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const DAY = 864e5;
  const REMINDER_BUFFER_DAYS = 14;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }) : "";
  const num = (n) => Number(n || 0).toLocaleString("ar-EG");
  const money = (n) => (Number(n) > 0 ? num(Math.round(n)) + " جنيه" : "بدون رسوم");
  const days = (n) => (n === 1 ? "يوم واحد" : n === 2 ? "يومين" : num(n) + (n <= 10 ? " أيام" : " يوم"));
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

  let toastTimer;
  function toast(msg, isError) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  // Preview mode: an admin can look at the platform as an owner or an office.
  function readViewAs() { try { return sessionStorage.getItem("rasmy-view-as") || "admin"; } catch { return "admin"; } }
  function writeViewAs(v) { try { sessionStorage.setItem("rasmy-view-as", v); } catch {} }

  function readPreviewOffice() { try { return sessionStorage.getItem("rasmy-preview-office") || null; } catch { return null; } }
  function writePreviewOffice(v) { try { sessionStorage.setItem("rasmy-preview-office", v); } catch {} }

  const state = { profile: null, viewAs: readViewAs(), previewOffice: readPreviewOffice(), services: null };

  // The office this screen acts for: the user's own, or the one an admin previews as.
  const officeId = () => (state.profile?.role === "admin" ? state.previewOffice : state.profile?.office_id) || null;

  // Files attached to a request, readable by everyone who can see the request.
  async function filesBlock(host, requestId) {
    const prefix = `requests/${requestId}`;
    const draw = async () => {
      const { data } = await sb.storage.from("files").list(prefix, { sortBy: { column: "created_at", order: "desc" } });
      const files = (data || []).filter((f) => f.name !== ".emptyFolderPlaceholder");
      host.innerHTML = `<h3 class="sub">الملفات</h3>
        ${files.length ? files.map((f) => `<div class="kv"><span>${esc(f.name.replace(/^\d+-/, ""))}</span><button class="btn small" type="button" data-file="${esc(f.name)}">افتح</button></div>`).join("") : '<p class="empty">مفيش ملفات لسه.</p>'}
        <label class="btn small" for="up-${requestId}">ارفع ملف</label><input type="file" id="up-${requestId}" hidden>`;
      host.querySelectorAll("[data-file]").forEach((b) => b.addEventListener("click", async () => {
        const { data: s, error } = await sb.storage.from("files").createSignedUrl(`${prefix}/${b.dataset.file}`, 300);
        if (error) return toast("ماقدرناش نفتح الملف", true);
        window.open(s.signedUrl, "_blank", "noopener");
      }));
      host.querySelector(`#up-${requestId}`).addEventListener("change", async (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (f.size > 10 * 1024 * 1024) return toast("الملف أكبر من ١٠ ميجا", true);
        const safe = f.name.replace(/[^\w.\-؀-ۿ]+/g, "_");
        const { error } = await sb.storage.from("files").upload(`${prefix}/${Date.now()}-${safe}`, f);
        if (error) return toast("ماقدرناش نرفع الملف", true);
        await sb.from("events").insert({ request_id: requestId, actor_id: state.profile.id, kind: "file", note: f.name });
        toast("اترفع الملف"); draw();
      });
    };
    await draw();
  }

  // A stage is late when it started and its planned days have passed.
  function stageLate(stage) {
    if (!stage?.started_at || stage.done_at) return 0;
    const due = new Date(stage.started_at).getTime() + stage.planned_days * DAY;
    return Math.max(0, Math.floor((Date.now() - due) / DAY));
  }

  function role() {
    const p = state.profile;
    if (!p?.role) return null;
    return p.role === "admin" ? state.viewAs : p.role;
  }
  const isPreview = () => state.profile?.role === "admin" && state.viewAs !== "admin";

  async function services() {
    if (!state.services) {
      const { data, error } = await sb.from("services").select("*").eq("active", true).order("sort");
      if (error) throw error;
      state.services = Object.fromEntries(data.map((s) => [s.id, s]));
    }
    return state.services;
  }

  // How a document stands today: ok, renew soon, or expired.
  function docStatus(doc, svc) {
    if (!doc.expires_on) return { cls: "ok", label: "مالوش تاريخ انتهاء", left: null, startOn: null };
    const exp = new Date(doc.expires_on); exp.setHours(0, 0, 0, 0);
    const left = Math.round((exp - today()) / DAY);
    const lead = (svc?.self_days || 7) + REMINDER_BUFFER_DAYS;
    const startOn = new Date(exp.getTime() - lead * DAY);
    if (left < 0) return { cls: "bad", label: "منتهي", left, startOn };
    if (today() >= startOn) return { cls: "warn", label: "ابدأ التجديد", left, startOn };
    return { cls: "ok", label: "سليم", left, startOn };
  }

  // Offices that offer a service, with their price, time and average ratings.
  async function optionsFor(serviceId) {
    const svc = (await services())[serviceId];
    const [{ data: rows }, { data: ratings }, { data: perf }] = await Promise.all([
      sb.from("office_services").select("fee,days,offices(id,name,active,is_demo)").eq("service_id", serviceId),
      sb.from("ratings").select("office_id,professionalism,speed"),
      sb.rpc("office_stats"),
    ]);
    const perfOf = Object.fromEntries((perf || []).map((p) => [p.office_id, p]));
    const stats = {};
    (ratings || []).forEach((r) => {
      const s = (stats[r.office_id] ||= { pro: 0, speed: 0, n: 0 });
      s.pro += r.professionalism; s.speed += r.speed; s.n++;
    });
    const offices = (rows || []).filter((r) => r.offices?.active && (!r.offices.is_demo || isPreview())).map((r) => {
      const s = stats[r.offices.id];
      return { key: r.offices.id, officeId: r.offices.id, label: r.offices.name, fee: Number(r.fee), cost: Number(r.fee) + Number(svc.gov_fee), days: r.days,
        pro: s ? s.pro / s.n : null, speed: s ? s.speed / s.n : null, count: s ? s.n : 0,
        done: perfOf[r.offices.id]?.done || 0, onTime: perfOf[r.offices.id]?.on_time || 0 };
    }).sort((a, b) => (b.pro ?? 0) - (a.pro ?? 0));
    return [{ key: "self", officeId: null, label: "هعملها بنفسي", sub: "من البوابة الإلكترونية أو بالتقديم بنفسك", fee: 0, cost: Number(svc.gov_fee), days: svc.self_days }, ...offices];
  }

  // Ratings come from owners; the on-time share comes from the requests' own dates.
  function optionLabel(o) {
    if (!o.officeId) return o.sub;
    const parts = [o.count ? `احترافية ${num(o.pro.toFixed(1))} · سرعة ${num(o.speed.toFixed(1))} · ${num(o.count)} تقييم` : "لسه مفيش تقييمات"];
    if (o.done) parts.push(`خلّص ${num(Math.round((o.onTime / o.done) * 100))}٪ من ${num(o.done)} طلب في موعده`);
    return parts.join(" · ");
  }

  // Stroke icons, sized by the surrounding text and colored with currentColor.
  const ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    doc: '<path d="M7 3h7l5 5v13H7zM14 3v5h5"/>',
    docOk: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 14l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    alert: '<path d="M12 4l9 16H3zM12 10v4M12 17.2v.3"/>',
    list: '<path d="M4 7h16M4 12h10M4 17h7M16 16l2 2 3-4"/>',
    arrow: '<path d="M4 12h12M12 6l6 6-6 6"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    building: '<path d="M5 21V5l7-2v18M12 8h7v13M8 8v.5M8 12v.5M8 16v.5M15 12v.5M15 16v.5M3 21h18"/>',
    person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>',
    star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    mail: '<path d="M3 6h18v12H3zM3 7l9 6 9-6"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.9-3.2 3.2-5 6-5s5.1 1.8 6 5M16 5.5a3 3 0 0 1 0 5.5M18 15c1.6.6 2.7 2.2 3 5"/>',
    pulse: '<path d="M4 12h4l3-7 4 14 3-7h2"/>',
  };
  const icon = (name, size = 20) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;

  // A span of days in plain words: months past two months, days before that.
  const span = (n) => (n >= 60 ? (Math.round(n / 30) === 1 ? "شهر" : num(Math.round(n / 30)) + " شهر") : days(n));

  const EVENTS = { rated: "صاحب العمل قيّم المكتب", created: "اتعمل الطلب", accepted: "المكتب قبل الطلب", declined: "المكتب اعتذر عن الطلب", stage_done: "خلصت مرحلة", done: "خلص الطلب", cancelled: "اتلغى الطلب", note: "ملاحظة", file: "اترفع ملف" };
  const STATUS = { new: ["", "جديد"], accepted: ["", "المكتب قبله"], in_progress: ["warn", "جاري التنفيذ"], done: ["ok", "تم"], cancelled: ["", "ملغي"] };

  window.R = { sb, DAY, esc, fmtDate, num, money, days, today, toast, state, role, isPreview, writeViewAs, writePreviewOffice, officeId,
    services, docStatus, optionsFor, optionLabel, filesBlock, stageLate, EVENTS, STATUS, icon, span, views: {} };
})();
