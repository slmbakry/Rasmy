// The guide's paths: from what the owner wants, a few questions lead to the
// procedure, who decides it and by what majority, its steps and documents.
// Every legal fact carries its source; what the sources leave open is marked.

export type Answers = Record<string, string>;
export type Question = { id: string; q: string; options: [string, string, string?][]; when?: (a: Answers) => boolean };
export type Source = { title: string; url: string };
export type Outcome = {
  title: string;
  why: string;
  decider?: { who: string; rule: string; meeting: "ordinary" | "extraordinary" | "owner" | "none" };
  notes: string[];
  unsure: string[];
  serviceId: string | null;
  link?: { href: string; label: string };
  sources: Source[];
};
export type Path = { id: string; title: string; sub: string; group: string; questions: Question[]; outcome: (a: Answers) => Outcome };

const LAW: Source = { title: "قانون الشركات رقم ١٥٩ لسنة ١٩٨١ وتعديلاته", url: "https://alberonsy.com/%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%B1%D9%82%D9%85-159-%D9%84%D8%B3%D9%86%D8%A9-1981-%D8%A8%D8%A5%D8%B5%D8%AF%D8%A7%D8%B1-%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%B4%D8%B1%D9%83%D8%A7%D8%AA-%D8%A7%D9%84/" };
const REGS: Source = { title: "اللائحة التنفيذية لقانون الشركات، الهيئة العامة للاستثمار", url: "https://www.investinegypt.gov.eg/Documents/Executive%20regulations%20of%20Law%20No.%20159%20of%201981%20for%20the%20Law%20of%20Joint%20Stock%20Companies,%20Partnerships%20Limited%20by%20Shares,%20and%20Limited%20Liability%20Companies.pdf" };
const LLC_LAW: Source = { title: "أحكام الشركات ذات المسئولية المحدودة في قانون الشركات", url: "https://lawegypt.net/%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%A7%D9%84%D8%B4%D8%B1%D9%83%D8%A7%D8%AA-%D8%A7%D9%84%D9%85%D8%B3%D8%A4%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D9%85%D8%AD%D8%AF%D9%88%D8%AF%D8%A9/" };
const MGMT: Source = { title: "إدارة الشركة ذات المسئولية المحدودة", url: "http://www.lawforall.info/index.pl/management_of_llcs" };
const ACTIVITY: Source = { title: "تعديل غرض الشركة في هيئة الاستثمار والسجل التجاري", url: "https://alhasswalawfirm.com/articles/amend-company-objects-add-activity-egypt" };
const CREDITORS: Source = { title: "اللائحة التنفيذية لقانون الشركات، المادة ١١٣ عن اعتراض الدائنين", url: "https://alhasswalawfirm.com/law-library/decree-96-1982" };
const ONE_CHANGE: Source = { title: "مصراوي: هيئة الاستثمار تحدد حالات تغيير الشكل القانوني لشركة الشخص الواحد", url: "https://www.masrawy.com/news/news_economy/details/2018/11/7/1458471/%D9%87%D9%8A%D8%A6%D8%A9-%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D8%AB%D9%85%D8%A7%D8%B1-3-%D8%AD%D8%A7%D9%84%D8%A7%D8%AA-%D9%84%D8%AA%D8%BA%D9%8A%D9%8A%D8%B1-%D8%A7%D9%84%D8%B4%D9%83%D9%84-%D8%A7%D9%84%D9%82%D8%A7%D9%86%D9%88%D9%86%D9%8A-%D9%85%D9%86-%D9%88%D8%A5%D9%84%D9%89-%D8%B4%D8%B1%D9%83%D8%A9-%D8%A7%D9%84%D8%B4%D8%AE%D8%B5-%D8%A7%D9%84%D9%88%D8%A7%D8%AD%D8%AF" };
const SOLE_CHANGE: Source = { title: "اقتصاد مصر: هيئة الاستثمار تحدد ضوابط تحويل المنشآت الفردية إلى شركات", url: "https://eqtisadmisr.com/38092/" };
const REGISTRY: Source = { title: "قانون السجل التجاري رقم ٣٤ لسنة ١٩٧٦", url: "https://lawyeregypt.net/%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%B1%D9%82%D9%85-34-%D9%84%D8%B3%D9%86%D8%A9-1976-%D9%81%D9%89-%D8%B4%D8%A3%D9%86-%D8%A7%D9%84%D8%B3%D8%AC%D9%84-%D8%A7%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D9%89/" };
const JSC_MAJ: Source = { title: "مقارنة مواد قانون الشركات قبل وبعد تعديله، المادة ٧٠", url: "https://hamdyabdelghany.net/compare_159.htm" };
const BOARD: Source = { title: "بوابة الأهرام: حق الجمعية العامة في عزل أعضاء مجلس الإدارة في أي وقت", url: "https://gate.ahram.org.eg/News/390779.aspx" };
const OGM_SRC: Source = { title: "اختصاصات الجمعية العامة العادية طبقًا لقانون الشركات", url: "https://ahmed-fathy-shehata.com/%D8%A3%D8%AE%D8%AA%D8%B5%D8%A7%D8%B5%D8%A7%D8%AA-%D8%A7%D9%84%D8%AC%D9%85%D8%B9%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%A7%D9%85%D8%A9-%D8%A7%D9%84%D8%B9%D8%A7%D8%AF%D9%8A%D8%A9-%D8%B7%D8%A8%D9%82%D8%A7/" };
const LIQ: Source = { title: "صادق خليفة: كيف يمكنك تصفية شركتك في مصر", url: "https://sadanykhalifa.com/ar/single-blog/How-to-Liquidate-your-Company-in-Egypt" };
const LIQ_LLC: Source = { title: "حل وتصفية الشركة ذات المسئولية المحدودة", url: "https://www.lawforall.info/index.pl/liquidation_and_dissolution_of_llcs" };
const LIQ_DOCS: Source = { title: "محامي مصر: إجراءات تصفية الشركات", url: "https://lawyeregypt.net/%D8%A5%D8%AC%D8%B1%D8%A7%D8%A1%D8%A7%D8%AA-%D8%AA%D8%B5%D9%81%D9%8A%D8%A9-%D8%A7%D9%84%D8%B4%D8%B1%D9%83%D8%A7%D8%AA/" };
const INS_END: Source = { title: "الوطن: المستندات المطلوبة لإنهاء الاشتراك التأميني للمنشأة", url: "https://www.elwatannews.com/news/details/5632717" };
const TAX_STOP: Source = { title: "اليوم السابع: إجراءات توقف الممول عن النشاط", url: "https://www.youm7.com/story/2019/7/17/%D9%84%D8%B5%D8%BA%D8%A7%D8%B1-%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D8%AB%D9%85%D8%B1%D9%8A%D9%86-%D9%88%D8%A7%D9%84%D8%AA%D8%AC%D9%91%D8%A7%D8%B1-%D8%A7%D9%84%D8%B3%D8%AC%D9%84-%D8%A7%D9%84%D8%AA%D8%AC%D8%A7%D8%B1%D9%89-%D8%A3%D9%88%D9%84%D9%89-%D8%AE%D8%B7%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D9%88%D8%B5%D9%88%D9%84-%D9%84%D8%B3%D9%84%D9%85-%C2%AB%D8%B1%D8%AC%D8%A7%D9%84/4336818" };
const GAFI: Source = { title: "خدمات تعديلات الشركات، الهيئة العامة للاستثمار", url: "https://www.gafi.gov.eg/Arabic/eServices/Pages/DepartmentService.aspx?DSID=30" };

export const MEETINGS = {
  ordinary: "الاجتماع العادي يكون للقرارات التي لا تغيّر عقد الشركة، مثل اعتماد الميزانية وتوزيع الأرباح وتعيين المدير.",
  extraordinary: "الاجتماع غير العادي يكون لأي قرار يغيّر عقد الشركة نفسه، مثل رأس المال والنشاط ودخول الشركاء، وأغلبيته أعلى.",
  owner: "في شركة الشخص الواحد يتخذ المالك وحده القرارات التي يتخذها الشركاء في الشركات الأخرى.",
  none: "",
};

const ENTITY: Question = { id: "entity", q: "ما نوع الشركة؟", options: [
  ["llc", "شركة ذات مسئولية محدودة", "شريكان أو أكثر"],
  ["one", "شركة الشخص الواحد", "مالك واحد"],
  ["jsc", "شركة مساهمة", "رأس المال مقسم إلى أسهم"],
  ["sole", "منشأة فردية", "مملوكة لشخص واحد باسمه"],
] };

// The legal form a company was saved with, as the entity answer.
export function entityOfForm(form?: string | null): string | null {
  if (!form) return null;
  if (form.includes("الشخص الواحد")) return "one";
  if (form.includes("مسئولية محدودة") || form.includes("مسؤولية محدودة")) return "llc";
  if (form.includes("مساهمة")) return "jsc";
  if (form.includes("فردية")) return "sole";
  return null;
}

const ONE_UNSURE = "تطبيق أحكام الشركة ذات المسئولية المحدودة على شركة الشخص الواحد مستنتج من إحالة القانون، وليس من نص خاص بهذا الإجراء.";
const LLC_DECIDER = { who: "جماعة الشركاء", rule: "الأغلبية العددية للشركاء الحائزة لثلاثة أرباع رأس المال", meeting: "extraordinary" as const };
// Capital changes, early dissolution, a change of the original purpose and mergers need three quarters (art. 70).
const JSC_BIG = { who: "الجمعية العامة غير العادية", rule: "ثلاثة أرباع الأسهم الممثلة في الاجتماع", meeting: "extraordinary" as const };
const JSC_EGM = { who: "الجمعية العامة غير العادية", rule: "ثلثا الأسهم الممثلة في الاجتماع", meeting: "extraordinary" as const };
const JSC_OGM = { who: "الجمعية العامة العادية", rule: "الأغلبية المطلقة للأسهم الممثلة في الاجتماع", meeting: "ordinary" as const };
const EGM_QUORUM = "لا يصح اجتماع الجمعية غير العادية إلا بحضور مساهمين يملكون نصف رأس المال على الأقل. فإن لم يكتمل يُدعى إلى اجتماع ثانٍ خلال ثلاثين يومًا، ويصح بحضور ربع رأس المال.";
const OGM_QUORUM = "لا يصح اجتماع الجمعية العادية إلا بحضور مساهمين يملكون ربع رأس المال على الأقل، ما لم يشترط النظام الأساسي نسبة أعلى لا تزيد على النصف. فإن لم يكتمل يُدعى إلى اجتماع ثانٍ خلال ثلاثين يومًا.";
const OGM_UNSURE = "لم نتحقق من نص صريح على أغلبية قرارات الجمعية العادية ولا على نصاب اجتماعها الثاني، والشائع أنها الأغلبية المطلقة للأسهم الممثلة.";
const ONE_DECIDER = { who: "مالك الشركة", rule: "قرار مكتوب من المالك", meeting: "owner" as const };

export const PATHS: Path[] = [
  {
    id: "capital", group: "التعديل", title: "زيادة رأس المال أو تخفيضه", sub: "تعرف من يقرر وبأي أغلبية، وما المطلوب للزيادة النقدية أو العينية",
    questions: [ENTITY,
      { id: "dir", q: "ماذا تريد أن تفعل برأس المال؟", options: [["up", "زيادته"], ["down", "تخفيضه"]] },
      { id: "how", q: "كيف ستتم الزيادة؟", when: (a) => a.dir === "up", options: [["cash", "نقدًا", "مبالغ تودع في حساب الشركة"], ["kind", "حصص عينية", "أصول أو عقار أو معدات"]] },
    ],
    outcome: (a) => {
      const notes: string[] = [], unsure: string[] = [];
      if (a.how === "cash") notes.push("تودع الزيادة النقدية كاملة في حساب الشركة، وتقدَّم شهادة البنك مع مستندات القرار.");
      if (a.how === "kind") notes.push("تُقيَّم الحصص العينية بمعرفة خبير أو لجنة معتمدة قبل اعتماد الزيادة.");
      if (a.dir === "down") {
        notes.push("يُنشر قرار التخفيض، ويحق لدائني الشركة الذين نشأت حقوقهم قبل النشر أن يعترضوا عليه، إلا إذا كان التخفيض بسبب خسائر لحقت بالشركة.");
        notes.push("إذا اعترض دائن فللشركة أن تسدد له حقه أو تقدم له ضمانًا كافيًا، فإن لم يقبل فله أن يلجأ إلى القضاء.");
        notes.push("لا يجوز أن يقل رأس المال بعد التخفيض عن الحد الأدنى الذي يحدده القانون لشكل الشركة.");
        unsure.push("لم نجد مدة محددة بالأيام لتقديم اعتراض الدائنين، فاسأل مقدم الخدمة عنها قبل البدء.");
      }
      if (a.entity === "sole") return { title: "تعديل رأس مال المنشأة في السجل التجاري", why: "المنشأة الفردية ملك لصاحبها وحده، فلا يلزم قرار شركاء، ويكفي تعديل بياناتها في السجل التجاري.",
        decider: { who: "صاحب المنشأة", rule: "طلب تعديل في السجل التجاري", meeting: "none" }, notes, unsure: [...unsure, "لم نتحقق بعد من مستندات تعديل رأس مال المنشأة الفردية بالتحديد."], serviceId: "capital_change", sources: [GAFI] };
      if (a.entity === "one") return { title: a.dir === "up" ? "زيادة رأس مال شركة الشخص الواحد" : "تخفيض رأس مال شركة الشخص الواحد",
        why: "رأس المال جزء من عقد الشركة، فتغييره تعديل للعقد يعتمده المالك، ثم تعتمده الهيئة ويُؤشَّر به في السجل التجاري.", decider: ONE_DECIDER, notes, unsure: [...unsure, ONE_UNSURE], serviceId: "capital_change", sources: [LAW, GAFI] };
      if (a.entity === "jsc") return { title: a.dir === "up" ? "زيادة رأس مال شركة المساهمة" : "تخفيض رأس مال شركة المساهمة",
        why: "تغيير رأس المال تعديل للنظام الأساسي، فيلزمه قرار من الجمعية العامة غير العادية.", decider: JSC_BIG,
        notes: [...notes, EGM_QUORUM],
        unsure, serviceId: "capital_change", sources: a.dir === "down" ? [LAW, JSC_MAJ, CREDITORS] : [LAW, JSC_MAJ] };
      return { title: a.dir === "up" ? "زيادة رأس مال الشركة" : "تخفيض رأس مال الشركة",
        why: "لا يجوز تعديل عقد الشركة ذات المسئولية المحدودة ولا زيادة رأس مالها أو تخفيضه إلا بموافقة الأغلبية العددية للشركاء الحائزة لثلاثة أرباع رأس المال.",
        decider: LLC_DECIDER, notes, unsure, serviceId: "capital_change", sources: a.dir === "down" ? [LAW, REGS, CREDITORS, GAFI] : [LAW, REGS, GAFI] };
    },
  },
  {
    id: "partner", group: "التعديل", title: "دخول شريك أو خروجه", sub: "بيع الحصص وحق الشركاء في استردادها، أو الدخول بزيادة رأس المال",
    questions: [ENTITY,
      { id: "move", q: "ماذا تريد؟", options: [["in", "دخول شريك جديد"], ["out", "خروج شريك"]] },
      { id: "in_how", q: "كيف سيدخل الشريك الجديد؟", when: (a) => a.move === "in" && ["llc", "jsc"].includes(a.entity), options: [["buy", "يشتري حصة من شريك حالي"], ["capital", "بزيادة رأس المال", "يدفع حصة جديدة"]] },
      { id: "out_to", q: "لمن سيبيع الشريك الخارج حصته؟", when: (a) => a.move === "out" && ["llc", "jsc"].includes(a.entity), options: [["partner", "لشريك حالي"], ["outsider", "لشخص من خارج الشركة"]] },
    ],
    outcome: (a) => {
      if (a.entity === "sole") return a.move === "in"
        ? { title: "تأسيس شركة بدل المنشأة الفردية", why: "المنشأة الفردية لا يكون لها شركاء ولا يجوز تحويلها إلى شكل قانوني آخر، فدخول شريك يعني تأسيس شركة جديدة تضم الشريكين.",
          notes: ["يجوز تقديم أصول المنشأة حصة عينية في رأس مال الشركة الجديدة، بشرط ألا يقل الجزء النقدي عن ربع رأس المال."], unsure: [], serviceId: null, link: { href: "/guide", label: "ابدأ دليل التأسيس" }, sources: [SOLE_CHANGE] }
        : { title: "لا ينطبق هذا الإجراء", why: "المنشأة الفردية ليس لها شركاء. لنقل ملكيتها لشخص آخر يلزم إجراء مختلف في السجل التجاري.", notes: [], unsure: ["لم نتحقق بعد من إجراءات نقل ملكية المنشأة الفردية."], serviceId: null, sources: [] };
      if (a.entity === "one") return { title: a.move === "in" ? "دخول شريك في شركة الشخص الواحد" : "بيع شركة الشخص الواحد",
        why: a.move === "in" ? "شركة الشخص الواحد يملكها شخص واحد، فدخول شريك يعني تحولها إلى شركة ذات مسئولية محدودة بتعديل عقدها." : "خروج المالك الوحيد يعني بيع الشركة كلها لمالك جديد، بتعديل عقدها والتأشير في السجل.",
        decider: ONE_DECIDER,
        notes: a.move === "in" ? [
          "يخطر المالك الهيئة العامة للاستثمار مسبقًا بقرار منه أنه سيتصرف في جزء من رأس المال، ويتعهد بإتمام الإجراءات خلال تسعين يومًا.",
          "خلال تسعين يومًا من التصرف تُوفَّق أوضاع الشركة، فتتحول إلى الشكل الذي يختاره الشركاء، وغالبًا شركة ذات مسئولية محدودة.",
          "إذا لم يتم الإخطار والتعهد وتوفيق الأوضاع في المدة، تُعد الشركة تحت التصفية بحكم القانون.",
        ] : [],
        unsure: [ONE_UNSURE], serviceId: "share_transfer", sources: a.move === "in" ? [LAW, ONE_CHANGE] : [LAW] };
      if (a.in_how === "capital") return { title: "دخول شريك بزيادة رأس المال", why: "الشريك الجديد يدفع حصة جديدة فيزيد رأس المال، فيمر الإجراء بقرار زيادة رأس المال ثم تعديل العقد.",
        decider: a.entity === "jsc" ? JSC_BIG : LLC_DECIDER,
        notes: ["المستندات هنا هي مستندات زيادة رأس المال، ويُضاف الشريك الجديد في عقد التعديل."], unsure: [], serviceId: "capital_change", link: { href: "/paths/capital", label: "تفاصيل زيادة رأس المال" }, sources: a.entity === "jsc" ? [LAW, JSC_MAJ] : [LAW] };
      if (a.entity === "jsc") return { title: "انتقال الأسهم في شركة المساهمة", why: "تنتقل الأسهم وفق قواعد تداولها والنظام الأساسي للشركة، ولا يطبق حق الاسترداد الخاص بالشركات ذات المسئولية المحدودة بالطريقة نفسها.",
        notes: [], unsure: ["لم نتحقق بعد من قيود نقل الأسهم في شركات المساهمة غير المقيدة في البورصة."], serviceId: "share_transfer", sources: [LAW] };
      const outsider = a.in_how === "buy" || a.out_to === "outsider";
      return { title: outsider ? "بيع حصة لشخص من خارج الشركة" : "بيع حصة لشريك حالي",
        why: outsider ? "انتقال الحصص في الشركة ذات المسئولية المحدودة يخضع لحق باقي الشركاء في استردادها، فيُعرض البيع عليهم أولًا." : "البيع لشريك حالي لا يُدخل شخصًا جديدًا، لكنه يغيّر توزيع الحصص في العقد، فيلزم تعديل العقد والتأشير في السجل.",
        decider: LLC_DECIDER,
        notes: outsider ? [
          "يبلغ الشريك البائع باقي الشركاء بالعرض عن طريق المديرين.",
          "لا يتم البيع إلا بعد مرور شهر من الإبلاغ دون أن يستخدم أحد الشركاء حق الاسترداد.",
          "من يسترد الحصة يشتريها بنفس الثمن والشروط، وإذا استرد أكثر من شريك تقسم بينهم بنسبة حصصهم.",
          "يكون البيع بمحرر رسمي أو مصدق على التوقيعات.",
        ] : ["يكون البيع بمحرر رسمي أو مصدق على التوقيعات، إلا إذا نص عقد الشركة على غير ذلك."],
        unsure: outsider ? [] : ["قد يضع عقد الشركة شروطًا خاصة للبيع بين الشركاء، فراجعه قبل البدء."], serviceId: "share_transfer", sources: [LLC_LAW, LAW] };
    },
  },
  {
    id: "manager", group: "التعديل", title: "تغيير المدير أو المفوضين بالتوقيع", sub: "من يعيّن المدير ومن يعزله، والتأشير في السجل التجاري",
    questions: [ENTITY,
      { id: "act", q: "ماذا تريد؟", when: (a) => a.entity !== "sole", options: [["appoint", "تعيين مدير جديد أو إضافة مدير"], ["remove", "عزل مدير حالي"]] },
    ],
    outcome: (a) => {
      if (a.entity === "sole") return { title: "تفويض شخص في إدارة المنشأة", why: "صاحب المنشأة الفردية هو مديرها، ويستطيع تفويض غيره في التوقيع والتعامل بتوكيل رسمي.",
        notes: [], unsure: ["لم نتحقق بعد مما إذا كان التفويض يحتاج تأشيرًا في السجل التجاري للمنشأة الفردية."], serviceId: null, sources: [] };
      if (a.entity === "one") return { title: a.act === "remove" ? "عزل مدير شركة الشخص الواحد" : "تعيين مدير لشركة الشخص الواحد",
        why: "المالك يعيّن مديرًا أو أكثر ويحدد صلاحياته، ثم يُؤشَّر بالتغيير في السجل التجاري.", decider: ONE_DECIDER, notes: [], unsure: [ONE_UNSURE], serviceId: "manager_change", sources: [LAW] };
      if (a.entity === "jsc") return { title: a.act === "remove" ? "عزل عضو مجلس الإدارة" : "تغيير مجلس الإدارة أو العضو المنتدب",
        why: "في شركة المساهمة تنتخب الجمعية العامة العادية أعضاء مجلس الإدارة وتعزلهم، ويختار المجلس من بين أعضائه رئيسه والعضو المنتدب.",
        decider: JSC_OGM,
        notes: [
          ...(a.act === "remove" ? ["للجمعية العامة أن تعزل مجلس الإدارة أو أحد أعضائه في أي وقت، ولو لم يكن العزل واردًا في جدول الأعمال."] : []),
          "تغيير رئيس المجلس أو العضو المنتدب من بين الأعضاء الحاليين يقرره مجلس الإدارة نفسه، ولا يحتاج جمعية عامة.",
          OGM_QUORUM,
          "يُؤشَّر بالتغيير في السجل التجاري ليصبح نافذًا أمام البنوك والجهات.",
        ],
        unsure: [OGM_UNSURE], serviceId: "manager_change", sources: [LAW, OGM_SRC, BOARD] };
      return a.act === "remove"
        ? { title: "عزل مدير الشركة", why: "عزل المدير قرار يمس إدارة الشركة، فيلزمه أغلبية أعلى من التعيين.", decider: { who: "جماعة الشركاء", rule: "الأغلبية العددية للشركاء الحائزة لثلاثة أرباع رأس المال", meeting: "extraordinary" },
            notes: ["قد يجيز عقد الشركة عزل المدير لسبب واضح ومقبول، فراجع العقد.", "يُؤشَّر بالعزل في السجل التجاري، ومعه تعيين البديل إن وجد."], unsure: [], serviceId: "manager_change", sources: [LAW, MGMT] }
        : { title: "تعيين مدير جديد للشركة", why: "يُعيَّن مديرو الشركة ذات المسئولية المحدودة ويُستبدلون بقرار من الجمعية العامة للشركاء.", decider: { who: "جماعة الشركاء", rule: "قرار الجمعية العامة", meeting: "ordinary" },
            notes: ["يحدد القرار صلاحيات المدير الجديد وحدود توقيعه.", "يُؤشَّر بالتعيين في السجل التجاري ليصبح نافذًا أمام البنوك والجهات."], unsure: ["لم نتحقق بعد من الأغلبية المطلوبة للتعيين إذا لم يحددها عقد الشركة."], serviceId: "manager_change", sources: [LAW, MGMT] };
    },
  },
  {
    id: "place", group: "التعديل", title: "تغيير العنوان أو النشاط", sub: "نقل المقر داخل المحافظة أو خارجها، أو إضافة نشاط جديد",
    questions: [ENTITY,
      { id: "what", q: "ماذا تريد أن تغيّر؟", options: [["address", "مقر الشركة"], ["activity", "النشاط", "إضافة نشاط أو تعديله"]] },
      { id: "where", q: "أين المقر الجديد؟", when: (a) => a.what === "address", options: [["same", "في نفس المحافظة"], ["other", "في محافظة أخرى"]] },
      { id: "licensed", q: "هل النشاط الجديد يحتاج ترخيصًا من جهة مختصة؟", when: (a) => a.what === "activity", options: [["yes", "نعم", "مثل الأغذية والصحة والتعليم والسياحة"], ["no", "لا"], ["unsure", "لا أعرف"]] },
    ],
    outcome: (a) => {
      const sole = a.entity === "sole";
      if (a.what === "activity") {
        const notes = ["تعتمد الهيئة العامة للاستثمار التعديل، ثم يُؤشَّر به في مكتب السجل التجاري المقيدة به الشركة، وتُحدَّث بيانات الشركة لدى مأمورية الضرائب."];
        if (a.licensed !== "no") notes.push("الأنشطة التي تحتاج ترخيصًا خاصًا تلزمها موافقة الجهة المختصة قبل مزاولتها.");
        return { title: sole ? "تعديل نشاط المنشأة" : "إضافة نشاط أو تعديله",
          why: sole ? "يُعدَّل نشاط المنشأة الفردية في السجل التجاري بطلب من صاحبها." : "إضافة نشاط تعني تعديل غرض الشركة في عقدها، لا مجرد تحديث في السجل، فيلزمها قرار غير عادي.",
          decider: sole ? { who: "صاحب المنشأة", rule: "طلب تعديل في السجل التجاري", meeting: "none" } : a.entity === "one" ? ONE_DECIDER
            : a.entity === "jsc" ? { ...JSC_EGM, rule: "ثلثا الأسهم الممثلة في الاجتماع، وثلاثة أرباعها إذا غيّر القرار الغرض الأصلي للشركة" } : LLC_DECIDER,
          notes: a.entity === "jsc" ? [...notes, EGM_QUORUM] : notes,
          unsure: sole ? ["لم نتحقق بعد من مستندات تعديل نشاط المنشأة الفردية."] : a.entity === "one" ? [ONE_UNSURE] : [],
          serviceId: "activity_change", sources: a.entity === "jsc" ? [ACTIVITY, LAW, JSC_MAJ, GAFI] : [ACTIVITY, GAFI] };
      }
      const notes = ["يلزم عقد إيجار ثابت التاريخ على الأقل أو مستند ملكية موثق للمقر الجديد."];
      const unsure: string[] = [];
      if (a.where === "other") {
        notes.push("القيد في السجل التجاري يكون في المكتب الذي يقع المقر الرئيسي في دائرته، فالانتقال إلى محافظة أخرى يعني التعامل مع مكتب سجل تجاري ومأمورية ضرائب ومكتب تأمينات جديدة.");
        unsure.push("لم نجد نصًا رسميًا يشرح خطوات نقل القيد بين محافظتين. الشائع في الممارسة شطب القيد في المحافظة القديمة وقيد جديد في المحافظة الجديدة، فتأكد من ذلك مع مقدم الخدمة.");
      }
      return { title: sole ? "تغيير مقر المنشأة" : "تغيير مقر الشركة",
        why: sole ? "يُعدَّل مقر المنشأة في السجل التجاري بطلب من صاحبها." : "إذا كان المقر مذكورًا في عقد الشركة فتغييره تعديل للعقد يلزمه قرار غير عادي، ولا يكفي قرار المدير.",
        decider: sole ? { who: "صاحب المنشأة", rule: "طلب تعديل في السجل التجاري", meeting: "none" } : a.entity === "one" ? ONE_DECIDER : a.entity === "jsc" ? JSC_EGM : LLC_DECIDER,
        notes: [...notes, ...(a.entity === "jsc" ? [EGM_QUORUM] : []), "يُطلب التأشير في السجل التجاري خلال شهر من تغيير المقر.", "بعد التأشير في السجل التجاري تُحدَّث بيانات الشركة لدى مأمورية الضرائب والتأمينات."],
        unsure: a.entity === "jsc" ? [...unsure, "لم نتحقق مما إذا كان النظام الأساسي يجيز لمجلس الإدارة نقل المقر داخل المدينة نفسها دون جمعية عامة."] : unsure,
        serviceId: "address_change", sources: a.entity === "jsc" ? [GAFI, REGISTRY, LAW, JSC_MAJ] : [GAFI, REGISTRY, ACTIVITY] };
    },
  },
  {
    id: "accounts", group: "الالتزامات السنوية", title: "اعتماد الميزانية وتوزيع الأرباح", sub: "الاجتماع السنوي للشركاء، وموعده، والمستندات التي تُرسل قبله",
    questions: [ENTITY],
    outcome: (a) => {
      if (a.entity === "sole") return { title: "لا يلزم اجتماع للمنشأة الفردية", why: "المنشأة الفردية ليس لها شركاء يعتمدون ميزانيتها، والمطلوب منها سنويًا هو الإقرار الضريبي.",
        notes: [], unsure: [], serviceId: null, link: { href: "/obligations", label: "التزامات المنشأة السنوية" }, sources: [] };
      if (a.entity === "one") return { title: "اعتماد ميزانية شركة الشخص الواحد", why: "المالك يعتمد القوائم المالية للسنة بقرار منه، خلال ستة أشهر من انتهاء السنة المالية.",
        decider: ONE_DECIDER, notes: ["تُطبَّق أحكام مراقب الحسابات والقوائم المالية الخاصة بشركات المساهمة على شركات الشخص الواحد."], unsure: [ONE_UNSURE], serviceId: "accounts_approval", sources: [LAW, REGS] };
      if (a.entity === "jsc") return { title: "الجمعية العامة العادية السنوية", why: "تجب دعوة الجمعية العامة للانعقاد مرة على الأقل في السنة خلال الستة أشهر التالية لنهاية السنة المالية.",
        decider: JSC_OGM, notes: ["تُنشر القوائم المالية وتقرير مراقب الحسابات قبل الاجتماع.", OGM_QUORUM],
        unsure: [OGM_UNSURE], serviceId: "accounts_approval", sources: [LAW, REGS, OGM_SRC] };
      return { title: "اجتماع الشركاء السنوي واعتماد الميزانية", why: "تجتمع جماعة الشركاء خلال ستة أشهر من انتهاء السنة المالية للنظر في الميزانية وحساب الأرباح والخسائر وتقرير المديرين.",
        decider: { who: "جماعة الشركاء", rule: "قرار الاجتماع السنوي", meeting: "ordinary" },
        notes: ["يُخطر الشركاء بكتاب موصى عليه مع علم الوصول، مرفقًا به الميزانية وتقرير المديرين وتقرير مراقب الحسابات.", "توزيع الأرباح يُقرَّر في الاجتماع نفسه."],
        unsure: ["لم نتحقق بعد من الأغلبية المطلوبة لاعتماد الميزانية إذا لم يحددها عقد الشركة."], serviceId: "accounts_approval", sources: [REGS, LAW] };
    },
  },
  {
    id: "closure", group: "الإنهاء", title: "إنهاء الشركة", sub: "الحل والتصفية للشركات، والشطب للمنشأة الفردية، والخطوات بالترتيب",
    questions: [ENTITY,
      { id: "state", q: "ما حال الشركة الآن؟", when: (a) => a.entity !== "sole", options: [
        ["clean", "لا ديون ولا أصول ولا موظفون", "لم تبدأ العمل، أو توقفت وسوّت كل شيء"],
        ["open", "عليها ديون أو لها أصول أو موظفون", "يلزم تحصيل الحقوق وسداد الديون أولًا"],
      ] },
    ],
    outcome: (a) => {
      const closing = [
        "تُغلق الشركة ملفها لدى الهيئة القومية للتأمين الاجتماعي بالاستمارة رقم ٦ التي تفيد انتهاء النشاط، بعد سداد كل الاشتراكات.",
        "تحصل الشركة على مخالصة من مصلحة الضرائب قبل طلب الشطب، وأي التزام ضريبي غير مسدد يعطّل الشطب.",
      ];
      const unsure = [
        "لم نجد في القانون مدة ثابتة للتصفية، والمدة الشائعة عمليًا من ستة أشهر إلى ثمانية عشر شهرًا.",
        "لم نتحقق بعد من خطوات إلغاء التسجيل في ضريبة القيمة المضافة.",
      ];
      if (a.entity === "sole") return { title: "شطب المنشأة الفردية", why: "المنشأة الفردية ليست شخصًا مستقلًا عن صاحبها، فلا تحتاج قرار حل ولا مصفيًا. يكفي إخطار الجهات بالتوقف وتسوية الالتزامات ثم شطب القيد.",
        decider: { who: "صاحب المنشأة", rule: "طلب منه بالتوقف والشطب", meeting: "none" },
        notes: [
          "يقدم صاحب المنشأة طلبًا كتابيًا لمأمورية الضرائب يوضح فيه تاريخ التوقف والأنشطة التي توقف عنها.",
          "إذا كان للمنشأة موظفون مؤمَّن عليهم، يُغلق ملفها في التأمينات بالاستمارة رقم ٦ بعد سداد الاشتراكات.",
          "بعد المخالصة من الضرائب والتأمينات يُطلب شطب القيد من مكتب السجل التجاري.",
        ],
        unsure: ["لم نتحقق بعد من المدة القانونية لإخطار مأمورية الضرائب بالتوقف.", unsure[1]], serviceId: "sole_closure", sources: [TAX_STOP, INS_END, REGISTRY] };
      const notes = [
        "يحدد القرار المصفي ومهامه ومدة التصفية وأجره. ويجوز أن يكون المصفي من الشركاء أو من غيرهم.",
        "يُقيَّد قرار التصفية في السجل التجاري ويُنشر، ولا يُحتج بالتصفية على الغير إلا من تاريخ قيدها.",
        "خلال التصفية تبقى للشركة شخصيتها بالقدر اللازم للتصفية فقط، ويُضاف إلى اسمها أنها تحت التصفية.",
        ...(a.state === "open" ? [
          "يجرد المصفي أصول الشركة وحقوقها وديونها، ثم يحصّل الحقوق ويسدد الديون، ويوزع ما يبقى على الشركاء بحسب حصصهم.",
        ] : [
          "إذا لم تكن على الشركة ديون ولا لها أصول، تكون أعمال التصفية قصيرة، لكن الخطوات الرسمية نفسها لازمة.",
        ]),
        "يقدم المصفي حسابًا ختاميًا، وتنتهي التصفية باعتماده، ثم يُشهر انتهاؤها ويُطلب شطب القيد من السجل التجاري.",
        ...closing,
        "تُحفظ دفاتر الشركة ومستنداتها عشر سنوات بعد الشطب.",
      ];
      if (a.entity === "one") return { title: "حل شركة الشخص الواحد وتصفيتها", why: "المالك وحده يقرر حل الشركة ووضعها تحت التصفية، ثم تمر بخطوات التصفية نفسها حتى شطب القيد.",
        decider: ONE_DECIDER, notes, unsure: [ONE_UNSURE, ...unsure], serviceId: "liquidation", sources: [LIQ, LIQ_DOCS, INS_END] };
      if (a.entity === "jsc") return { title: "حل شركة المساهمة وتصفيتها", why: "حل الشركة قبل موعدها قرار يغيّر وجودها نفسه، فيلزمه قرار من الجمعية العامة غير العادية بأغلبية مشددة.",
        decider: JSC_BIG,
        notes: [EGM_QUORUM, ...notes],
        unsure, serviceId: "liquidation", sources: [LAW, JSC_MAJ, LIQ, LIQ_DOCS, INS_END] };
      return { title: "حل الشركة وتصفيتها", why: "إنهاء الشركة ذات المسئولية المحدودة يمر بمرحلتين: قرار من الشركاء بالحل ووضع الشركة تحت التصفية، ثم تصفية يقوم بها مصفٍ حتى شطب القيد.",
        decider: { who: "جماعة الشركاء", rule: "الأغلبية التي يحددها عقد الشركة لحلها قبل موعدها", meeting: "extraordinary" },
        notes, unsure: ["لم نتحقق بعد من الأغلبية التي يحددها القانون لقرار الحل إذا لم يذكرها عقد الشركة.", ...unsure], serviceId: "liquidation", sources: [LIQ_LLC, LIQ, LIQ_DOCS, INS_END] };
    },
  },
];

export const SOON_PATHS: { title: string; group: string; sub: string }[] = [];
