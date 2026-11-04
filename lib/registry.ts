// A guide to how activities are written in the commercial register, built on
// the international classification of economic activities (ISIC Rev. 4),
// which the Egyptian register now codes activities by. Titles are Arabic
// renderings of the classification's classes; the register's own wording is
// often narrower, so each entry also says what tends to be asked alongside it.

export type Kind = "trade" | "make" | "service";
export type Entry = {
  code: string;
  section: string;
  title: string;
  kind: Kind;
  words: string;
  notes?: string[];
  related?: [string, string][]; // [code, why it is often needed too]
  license?: string; // a licensed activity id from lib/activities.ts
};

export const KIND_LABEL: Record<Kind, string> = { trade: "تجارة", make: "صناعة", service: "خدمة" };

export const SECTIONS: [string, string][] = [
  ["C", "الصناعات التحويلية"],
  ["F", "التشييد والبناء"],
  ["G", "تجارة الجملة والتجزئة وإصلاح المركبات"],
  ["H", "النقل والتخزين"],
  ["I", "الإقامة وخدمات الطعام"],
  ["J", "المعلومات والاتصالات"],
  ["K", "الأنشطة المالية والتأمين"],
  ["L", "الأنشطة العقارية"],
  ["M", "الأنشطة المهنية والعلمية والتقنية"],
  ["N", "الخدمات الإدارية وخدمات الدعم"],
  ["P", "التعليم"],
  ["Q", "الصحة البشرية"],
  ["S", "الخدمات الأخرى"],
];

const ONLINE: [string, string] = ["4791", "إذا كنت ستبيع عبر موقع إلكتروني أو تطبيق أو منصات التواصل"];
const IMPORT_NOTE = "إذا كنت ستستورد البضاعة بنفسك، فيلزمك القيد في سجل المستوردين أيضًا.";

export const ENTRIES: Entry[] = [
  // Manufacturing
  { code: "1071", section: "C", title: "صنع منتجات المخابز", kind: "make", words: "مخبز عيش خبز حلويات معجنات كيك فطائر بسكويت", related: [["4721", "إذا كان لديك منفذ بيع للجمهور"]], license: "food" },
  { code: "1079", section: "C", title: "صنع منتجات غذائية أخرى", kind: "make", words: "تعبئة أغذية توابل بهارات شاي قهوة عسل مربى صلصات مكملات", related: [["4630", "إذا كنت ستبيع إنتاجك بالجملة"]], license: "food" },
  { code: "1410", section: "C", title: "صنع الملابس عدا الملابس الفرائية", kind: "make", words: "مصنع ملابس جاهزة خياطة تفصيل مايوهات ملابس بحر ملابس داخلية ملابس أطفال يونيفورم",
    notes: [
      "اذكر أصناف الملابس التي تنتجها، فالصياغة العامة قد لا تشمل كل الأصناف.",
      "من تجربة عملية لشركة مايوهات: لم يكفِ نشاط ملابس جاهزة متنوعة، فأُضيف نشاط ملابس بحر متنوعة، ثم ملابس داخلية متنوعة لتشابه بعض الموديلات بالملابس الداخلية.",
    ],
    related: [["4641", "إذا كنت ستبيع إنتاجك بالجملة"], ["4771", "إذا كان لديك محل بيع للجمهور"], ONLINE], license: "industrial" },
  { code: "1430", section: "C", title: "صنع الملابس والأصناف المحبوكة والمكروشيه", kind: "make", words: "تريكو جوارب شرابات ملابس محبوكة كروشيه", related: [["1410", "إذا كنت تصنع ملابس منسوجة أيضًا"]], license: "industrial" },
  { code: "1520", section: "C", title: "صنع الأحذية", kind: "make", words: "مصنع أحذية شباشب صنادل جزم", related: [["4771", "إذا كان لديك محل بيع للجمهور"]], license: "industrial" },
  { code: "1811", section: "C", title: "الطباعة", kind: "make", words: "مطبعة طباعة مطبوعات كروت فلايرز علب كرتون دعاية", related: [["7310", "إذا كنت تقدم تصميم الحملات الإعلانية أيضًا"]], license: "industrial" },
  { code: "2023", section: "C", title: "صنع الصابون والمنظفات ومستحضرات التجميل والعطور", kind: "make", words: "صابون منظفات شامبو كريمات عطور مستحضرات تجميل عناية بالبشرة", license: "cosmetics" },
  { code: "2220", section: "C", title: "صنع منتجات البلاستيك", kind: "make", words: "بلاستيك أكياس عبوات خراطيم أدوات منزلية بلاستيكية", license: "industrial" },
  { code: "2511", section: "C", title: "صنع المنتجات المعدنية الإنشائية", kind: "make", words: "حدادة كريتال أبواب شبابيك هياكل معدنية مظلات", related: [["4330", "إذا كنت ستركب المنتجات في المواقع"]], license: "industrial" },
  { code: "3100", section: "C", title: "صنع الأثاث", kind: "make", words: "نجارة أثاث موبيليا مطابخ غرف نوم مكاتب", related: [["4759", "إذا كان لديك معرض بيع للجمهور"]], license: "industrial" },

  // Construction
  { code: "4100", section: "F", title: "تشييد المباني", kind: "service", words: "مقاولات عامة بناء مباني عمارات فيلات إنشاءات", related: [["4330", "إذا كنت تنفذ التشطيبات أيضًا"], ["4321", "إذا كنت تنفذ الأعمال الكهربائية"]], license: "contracting" },
  { code: "4210", section: "F", title: "إنشاء الطرق والسكك الحديدية", kind: "service", words: "مقاولات طرق رصف أسفلت كباري", license: "contracting" },
  { code: "4321", section: "F", title: "التركيبات الكهربائية", kind: "service", words: "مقاولات كهرباء تمديدات كهربائية إنارة لوحات", license: "contracting" },
  { code: "4322", section: "F", title: "تركيبات السباكة والتدفئة والتكييف", kind: "service", words: "مقاولات سباكة صحي تكييف تبريد تدفئة", license: "contracting" },
  { code: "4330", section: "F", title: "إكمال المباني وتشطيبها", kind: "service", words: "مقاولات تشطيبات ديكور دهانات محارة بلاط سيراميك جبس أرضيات", related: [["7410", "إذا كنت تقدم تصميم الديكور أيضًا"]], license: "contracting" },

  // Trade
  { code: "4520", section: "G", title: "صيانة المركبات وإصلاحها", kind: "service", words: "ورشة سيارات ميكانيكا صيانة سيارات سمكرة دهان سيارات", related: [["4530", "إذا كنت تبيع قطع الغيار أيضًا"]] },
  { code: "4530", section: "G", title: "بيع قطع غيار المركبات وملحقاتها", kind: "trade", words: "قطع غيار سيارات إكسسوارات سيارات كاوتش بطاريات", notes: [IMPORT_NOTE] },
  { code: "4610", section: "G", title: "البيع بالجملة مقابل رسم أو عمولة", kind: "trade", words: "وكيل تجاري وسيط تجاري عمولة توكيل", license: "commercial_agent" },
  { code: "4630", section: "G", title: "البيع بالجملة للأغذية والمشروبات والتبغ", kind: "trade", words: "تجارة أغذية جملة توزيع مواد غذائية مشروبات بقالة جملة", notes: [IMPORT_NOTE], license: "food" },
  { code: "4641", section: "G", title: "البيع بالجملة للمنسوجات والملابس والأحذية", kind: "trade", words: "ملابس جاهزة جملة أقمشة منسوجات أحذية جملة مايوهات ملابس بحر ملابس داخلية",
    notes: ["اذكر أصناف الملابس التي تتاجر فيها، مثل ملابس البحر أو الملابس الداخلية، إذا كانت تختلف عن الملابس الجاهزة المعتادة.", IMPORT_NOTE],
    related: [["4771", "إذا كان لديك محل بيع للجمهور"], ONLINE] },
  { code: "4649", section: "G", title: "البيع بالجملة للسلع المنزلية الأخرى", kind: "trade", words: "أدوات منزلية أجهزة كهربائية منزلية أواني مفروشات هدايا جملة", notes: [IMPORT_NOTE] },
  { code: "4651", section: "G", title: "البيع بالجملة للحواسيب والبرمجيات", kind: "trade", words: "كمبيوتر لابتوب برامج أجهزة حاسب جملة توريدات", notes: [IMPORT_NOTE] },
  { code: "4659", section: "G", title: "البيع بالجملة للآلات والمعدات الأخرى", kind: "trade", words: "معدات ماكينات آلات توريدات صناعية معدات مكتبية", notes: [IMPORT_NOTE] },
  { code: "4663", section: "G", title: "البيع بالجملة لمواد البناء والأدوات الصحية", kind: "trade", words: "مواد بناء أسمنت حديد تسليح سيراميك أدوات صحية خشب", notes: [IMPORT_NOTE] },
  { code: "4690", section: "G", title: "تجارة الجملة غير المتخصصة", kind: "trade", words: "تجارة عامة توريدات عمومية استيراد وتصدير سلع متنوعة",
    notes: ["صياغة التجارة العامة قد لا تُقبل لبعض السلع التي تحتاج ترخيصًا، فاذكر السلع الرئيسية بأسمائها.", IMPORT_NOTE] },
  { code: "4711", section: "G", title: "البيع بالتجزئة في متاجر غير متخصصة يغلب عليها بيع الأغذية", kind: "trade", words: "سوبر ماركت ماركت بقالة هايبر" },
  { code: "4721", section: "G", title: "البيع بالتجزئة للأغذية في متاجر متخصصة", kind: "trade", words: "محل أغذية حلويات عطارة مكسرات جزارة خضار فاكهة", license: "food" },
  { code: "4741", section: "G", title: "البيع بالتجزئة للحواسيب والبرمجيات وأجهزة الاتصالات", kind: "trade", words: "محل موبايلات كمبيوتر إكسسوارات موبايل", related: [["9512", "إذا كنت تصلح الأجهزة أيضًا"]] },
  { code: "4752", section: "G", title: "البيع بالتجزئة للأدوات المعدنية والدهانات والزجاج", kind: "trade", words: "خردوات عدد وأدوات دهانات بويات زجاج" },
  { code: "4759", section: "G", title: "البيع بالتجزئة للأثاث والأجهزة المنزلية", kind: "trade", words: "معرض أثاث أجهزة كهربائية مفروشات إضاءة نجف" },
  { code: "4771", section: "G", title: "البيع بالتجزئة للملابس والأحذية والمصنوعات الجلدية", kind: "trade", words: "محل ملابس بوتيك أحذية شنط مايوهات ملابس بحر ملابس داخلية ملابس أطفال",
    notes: ["اذكر الأصناف المتخصصة مثل ملابس البحر أو الملابس الداخلية إذا كانت جزءًا أساسيًا من نشاطك."],
    related: [ONLINE, ["4641", "إذا كنت ستبيع بالجملة أيضًا"]] },
  { code: "4772", section: "G", title: "البيع بالتجزئة للأدوية ومستحضرات التجميل", kind: "trade", words: "صيدلية مستحضرات تجميل عطور مستلزمات طبية", license: "pharmacy" },
  { code: "4773", section: "G", title: "البيع بالتجزئة لسلع جديدة أخرى", kind: "trade", words: "هدايا لعب أطفال مستلزمات مكتبية أدوات مدرسية نظارات ساعات إكسسوارات" },
  { code: "4791", section: "G", title: "البيع بالتجزئة عن طريق الإنترنت أو الطلب البريدي", kind: "trade", words: "تجارة إلكترونية متجر إلكتروني أونلاين بيع على الإنترنت فيسبوك إنستجرام",
    notes: ["اذكر نوع السلع التي تبيعها عبر الإنترنت، فالسجل يسأل عادة عما تبيعه لا عن طريقة البيع فقط."] },

  // Transport
  { code: "4923", section: "H", title: "نقل البضائع على الطرق", kind: "service", words: "نقل بضائع شاحنات نقل ثقيل نقل عفش", license: "transport" },
  { code: "5229", section: "H", title: "أنشطة أخرى داعمة للنقل", kind: "service", words: "شحن دولي وكيل شحن تخليص جمركي لوجستيات", license: "customs_broker" },
  { code: "5320", section: "H", title: "أنشطة البريد السريع والتوصيل", kind: "service", words: "توصيل طلبات شحن داخلي كورير دليفري" },

  // Accommodation and food
  { code: "5510", section: "I", title: "أنشطة الإقامة قصيرة الأجل", kind: "service", words: "فندق شقق فندقية شقق إجازات بيوت ضيافة هوستل", license: "holiday_homes" },
  { code: "5610", section: "I", title: "أنشطة المطاعم وخدمات الطعام المتنقلة", kind: "service", words: "مطعم وجبات سريعة كشك أكل عربة طعام", related: [["5621", "إذا كنت تقدم الطعام في المناسبات"], ["5630", "إذا كنت تقدم المشروبات أيضًا"]], license: "restaurant" },
  { code: "5621", section: "I", title: "تقديم الطعام في المناسبات", kind: "service", words: "كاترينج حفلات بوفيه مناسبات", license: "food" },
  { code: "5630", section: "I", title: "أنشطة تقديم المشروبات", kind: "service", words: "كافيه مقهى قهوة عصائر كوفي شوب", license: "restaurant" },

  // Information and communication
  { code: "6201", section: "J", title: "أنشطة البرمجة الحاسوبية", kind: "service", words: "برمجة تطوير برمجيات تطبيقات مواقع إلكترونية سوفتوير", related: [["6202", "إذا كنت تقدم الاستشارات التقنية أيضًا"], ["6311", "إذا كنت تستضيف الأنظمة أو البيانات"]] },
  { code: "6202", section: "J", title: "الاستشارات الحاسوبية وإدارة المرافق الحاسوبية", kind: "service", words: "استشارات تقنية دعم فني شبكات أنظمة معلومات" },
  { code: "6311", section: "J", title: "معالجة البيانات واستضافتها", kind: "service", words: "استضافة مواقع سيرفرات بيانات حوسبة سحابية" },
  { code: "6312", section: "J", title: "بوابات الإنترنت", kind: "service", words: "منصة إلكترونية بوابة موقع محتوى دليل إلكتروني", notes: ["إذا كانت المنصة تنشر أخبارًا أو محتوى إعلاميًا، فقد يلزمها ترخيص من المجلس الأعلى لتنظيم الإعلام."], license: "media" },

  // Finance
  { code: "6492", section: "K", title: "منح الائتمان الأخرى", kind: "service", words: "تمويل تقسيط تمويل استهلاكي تمويل متناهي الصغر", license: "finance" },
  { code: "6622", section: "K", title: "أنشطة وكلاء التأمين ووسطائه", kind: "service", words: "وساطة تأمين وكيل تأمين سمسار تأمين", license: "insurance_broker" },

  // Real estate
  { code: "6810", section: "L", title: "الأنشطة العقارية بالعقارات المملوكة أو المؤجرة", kind: "service", words: "تطوير عقاري بيع عقارات تأجير عقارات استثمار عقاري" },
  { code: "6820", section: "L", title: "الأنشطة العقارية مقابل رسم أو عمولة", kind: "service", words: "سمسرة عقارية تسويق عقاري وساطة عقارية إدارة عقارات", license: "real_estate_broker" },

  // Professional
  { code: "6910", section: "M", title: "الأنشطة القانونية", kind: "service", words: "محاماة استشارات قانونية مكتب محاماة" },
  { code: "6920", section: "M", title: "أنشطة المحاسبة ومسك الدفاتر ومراجعة الحسابات", kind: "service", words: "محاسبة مراجعة ضرائب مسك دفاتر" },
  { code: "7020", section: "M", title: "الأنشطة الاستشارية في مجال الإدارة", kind: "service", words: "استشارات إدارية دراسات جدوى تطوير أعمال موارد بشرية" },
  { code: "7110", section: "M", title: "الأنشطة المعمارية والهندسية", kind: "service", words: "مكتب هندسي تصميم معماري إشراف هندسي استشارات هندسية" },
  { code: "7310", section: "M", title: "الإعلان", kind: "service", words: "دعاية وإعلان تسويق رقمي سوشيال ميديا حملات إعلانية", notes: ["الإعلانات على الطرق العامة تحتاج ترخيصًا من الجهة المختصة بالمحافظة."], license: "outdoor_ads" },
  { code: "7410", section: "M", title: "أنشطة التصميم المتخصصة", kind: "service", words: "تصميم جرافيك تصميم داخلي ديكور تصميم أزياء" },

  // Administrative and support
  { code: "7810", section: "N", title: "أنشطة وكالات التوظيف", kind: "service", words: "توظيف إلحاق عمالة استقدام موارد بشرية", license: "recruitment" },
  { code: "7911", section: "N", title: "أنشطة وكالات السفر", kind: "service", words: "سياحة سفر حجز طيران تذاكر", license: "tourism" },
  { code: "7912", section: "N", title: "أنشطة منظمي الرحلات", kind: "service", words: "رحلات سياحية برامج سياحية رحلات داخلية", license: "tourism" },
  { code: "8010", section: "N", title: "أنشطة الأمن الخاصة", kind: "service", words: "أمن حراسة حراسات خاصة نقل أموال", license: "security" },
  { code: "8121", section: "N", title: "التنظيف العام للمباني", kind: "service", words: "نظافة تنظيف شركات نظافة مكافحة حشرات" },
  { code: "8230", section: "N", title: "تنظيم المؤتمرات والمعارض التجارية", kind: "service", words: "تنظيم معارض مؤتمرات فعاليات إيفنتات حفلات" },

  // Education
  { code: "8510", section: "P", title: "التعليم قبل الابتدائي والابتدائي", kind: "service", words: "حضانة روضة مدرسة ابتدائي", license: "nursery" },
  { code: "8521", section: "P", title: "التعليم الثانوي العام", kind: "service", words: "مدرسة خاصة إعدادي ثانوي", license: "school" },
  { code: "8549", section: "P", title: "أنشطة تعليمية أخرى", kind: "service", words: "مركز تدريب كورسات لغات تنمية مهارات دورات", license: "training" },

  // Health
  { code: "8620", section: "Q", title: "أنشطة الممارسة الطبية وطب الأسنان", kind: "service", words: "عيادة مركز طبي أسنان طبيب", license: "medical" },
  { code: "8690", section: "Q", title: "أنشطة أخرى لصحة الإنسان", kind: "service", words: "معمل تحاليل أشعة علاج طبيعي تمريض منزلي", license: "medical" },

  // Other services
  { code: "9512", section: "S", title: "إصلاح أجهزة الاتصالات", kind: "service", words: "صيانة موبايلات إصلاح هواتف" },
  { code: "9602", section: "S", title: "تصفيف الشعر وأنشطة التجميل الأخرى", kind: "service", words: "صالون كوافير حلاق مركز تجميل سبا" },
];

export const entryByCode = (code: string) => ENTRIES.find((e) => e.code === code);
// Arabic search that ignores the common spelling variants of alef, yeh and teh marbuta.
export const norm = (s: string) => s.replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ً-ْ]/g, "").trim();
export const searchEntries = (q: string) => {
  const t = norm(q).split(/\s+/).filter(Boolean);
  if (!t.length) return [];
  return ENTRIES.filter((e) => { const hay = norm(e.title + " " + e.words + " " + e.code); return t.every((w) => hay.includes(w)); });
};
