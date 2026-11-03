// The authorities a company deals with, and which one each service is handled at.
export type PlaceKind = "governorate" | "registry" | "tax_office" | "none";

export const GOVERNORATES = ["القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الدقهلية", "الشرقية", "الغربية", "المنوفية", "البحيرة", "كفر الشيخ", "دمياط",
  "بورسعيد", "الإسماعيلية", "السويس", "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "الوادي الجديد", "مطروح",
  "شمال سيناء", "جنوب سيناء"];

export const PLACE_LABEL: Record<PlaceKind, string> = { governorate: "المحافظة", registry: "مكتب السجل التجاري", tax_office: "المأمورية", none: "" };

type Places = { governorate?: string | null; registry_office?: string | null; tax_office?: string | null };

// The company's own authority for a kind, or null when it has not been set.
export function placeOf(company: Places | null | undefined, kind: PlaceKind): string | null {
  if (!company || kind === "none") return null;
  const v = kind === "registry" ? company.registry_office : kind === "tax_office" ? company.tax_office : company.governorate;
  return v?.trim() || null;
}
