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
    const [{ data: rows }, { data: ratings }] = await Promise.all([
      sb.from("office_services").select("fee,days,offices(id,name,active)").eq("service_id", serviceId),
      sb.from("ratings").select("office_id,professionalism,speed"),
    ]);
    const stats = {};
    (ratings || []).forEach((r) => {
      const s = (stats[r.office_id] ||= { pro: 0, speed: 0, n: 0 });
      s.pro += r.professionalism; s.speed += r.speed; s.n++;
    });
    const offices = (rows || []).filter((r) => r.offices?.active).map((r) => {
      const s = stats[r.offices.id];
      return { key: r.offices.id, officeId: r.offices.id, label: r.offices.name, fee: Number(r.fee), cost: Number(r.fee) + Number(svc.gov_fee), days: r.days,
        pro: s ? s.pro / s.n : null, speed: s ? s.speed / s.n : null, count: s ? s.n : 0 };
    }).sort((a, b) => (b.pro ?? 0) - (a.pro ?? 0));
    return [{ key: "self", officeId: null, label: "هعملها بنفسي", sub: "من البوابة الإلكترونية أو بالتقديم بنفسك", fee: 0, cost: Number(svc.gov_fee), days: svc.self_days }, ...offices];
  }

  function optionLabel(o) {
    if (!o.officeId) return o.sub;
    if (!o.count) return "لسه مفيش تقييمات";
    return `احترافية ${num(o.pro.toFixed(1))} · سرعة ${num(o.speed.toFixed(1))} · ${num(o.count)} تقييم`;
  }

  const EVENTS = { created: "اتعمل الطلب", accepted: "المكتب قبل الطلب", declined: "المكتب اعتذر عن الطلب", stage_done: "خلصت مرحلة", done: "خلص الطلب", cancelled: "اتلغى الطلب", note: "ملاحظة", file: "اترفع ملف" };
  const STATUS = { new: ["", "جديد"], accepted: ["", "المكتب قبله"], in_progress: ["warn", "جاري التنفيذ"], done: ["ok", "تم"], cancelled: ["", "ملغي"] };

  window.R = { sb, DAY, esc, fmtDate, num, money, days, today, toast, state, role, isPreview, writeViewAs, writePreviewOffice, officeId,
    services, docStatus, optionsFor, optionLabel, filesBlock, stageLate, EVENTS, STATUS, views: {} };
})();
