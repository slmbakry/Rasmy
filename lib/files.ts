// Company files: compressing scans before upload, the plan's allowance, and
// the merged company file that is shared on WhatsApp.
import { PDFDocument } from "pdf-lib";
import { sb } from "./supabase";
import { num } from "./format";

export type Plan = { id: string; title: string; storage_bytes: number; image_max_side: number; image_quality: number };
export type CompanyFile = { id: string; company_id: string; document_id: string | null; name: string; path: string; mime: string; size: number; created_at: string;
  extracted?: { type: string; label: string; fields: { key: string; label: string; value: string; state: "ok" | "check" | "missing" }[] } | null; read_at?: string | null };

export const MAX_FILE = 10 * 1024 * 1024;
export const PACK_DAYS = 7;

export function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return num((bytes / 1024 ** 3).toFixed(1)) + " جيجابايت";
  if (bytes >= 1024 * 1024) return num((bytes / 1024 ** 2).toFixed(1)) + " ميجابايت";
  return num(Math.max(1, Math.round(bytes / 1024))) + " كيلوبايت";
}

const loadImage = (file: Blob) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
  img.src = url;
});

// Images are scaled down to the plan's longest side and saved as JPEG at its
// quality; a PDF is kept as it is. The smaller of the two results is kept.
export async function prepareUpload(file: File, plan: Plan): Promise<{ blob: Blob; name: string; mime: string }> {
  if (file.type === "application/pdf") return { blob: file, name: file.name, mime: file.type };
  if (!file.type.startsWith("image/")) throw new Error("bad_type");
  const img = await loadImage(file);
  const scale = Math.min(1, plan.image_max_side / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((r) => c.toBlob(r, "image/jpeg", plan.image_quality));
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  // An original that already fits the plan's size and is smaller is kept as it is.
  if (scale === 1 && ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= blob.size) return { blob: file, name: file.name, mime: file.type };
  return { blob, name, mime: "image/jpeg" };
}

const safeName = (name: string) => name.replace(/[^\w.\-؀-ۿ]+/g, "_").slice(-80);

// The row comes first (the database checks the allowance), then the bytes.
export async function uploadCompanyFile(companyId: string, documentId: string | null, file: File, plan: Plan) {
  const { blob, name, mime } = await prepareUpload(file, plan);
  if (blob.size > MAX_FILE) throw new Error("too_big");
  const path = `companies/${companyId}/${crypto.randomUUID()}-${safeName(name)}`;
  const { data: row, error } = await sb.from("company_files")
    .insert({ company_id: companyId, document_id: documentId, name, path, mime, size: blob.size }).select().single();
  if (error) throw new Error(error.message.includes("quota_exceeded") ? "quota" : "save");
  const { error: upErr } = await sb.storage.from("files").upload(path, blob, { contentType: mime });
  if (upErr) { await sb.from("company_files").delete().eq("id", row.id); throw new Error("upload"); }
  return row as CompanyFile;
}

export async function deleteCompanyFile(f: CompanyFile) {
  const { error } = await sb.storage.from("files").remove([f.path]);
  if (error) throw error;
  await sb.from("company_files").delete().eq("id", f.id);
}

// One A4 PDF from the chosen files: each image on its own page, each PDF's pages copied over.
export async function buildPack(files: CompanyFile[], onStep?: (i: number) => void): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const A4: [number, number] = [595.28, 841.89], M = 24;
  for (let i = 0; i < files.length; i++) {
    onStep?.(i);
    const f = files[i];
    const { data, error } = await sb.storage.from("files").download(f.path);
    if (error) throw error;
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (f.mime === "application/pdf") {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
      continue;
    }
    let jpg = bytes;
    if (f.mime !== "image/jpeg") {
      const img = await loadImage(data);
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0);
      jpg = new Uint8Array(await (await new Promise<Blob>((r) => c.toBlob(r, "image/jpeg", 0.85))).arrayBuffer());
    }
    const img = await out.embedJpg(jpg);
    const landscape = img.width > img.height;
    const [W, H] = landscape ? [A4[1], A4[0]] : A4;
    const s = Math.min((W - 2 * M) / img.width, (H - 2 * M) / img.height, 1.5);
    const page = out.addPage([W, H]);
    page.drawImage(img, { x: (W - img.width * s) / 2, y: (H - img.height * s) / 2, width: img.width * s, height: img.height * s });
  }
  return out.save();
}

// Keeps one pack per company: older ones are removed when a new one is made.
export async function savePack(companyId: string, pdf: Uint8Array, fileName: string) {
  const dir = `packs/${companyId}`;
  const { data: old } = await sb.storage.from("files").list(dir);
  if (old?.length) await sb.storage.from("files").remove(old.map((o) => `${dir}/${o.name}`));
  const path = `${dir}/${Date.now()}-${safeName(fileName)}`;
  const { error } = await sb.storage.from("files").upload(path, new Blob([pdf], { type: "application/pdf" }), { contentType: "application/pdf" });
  if (error) throw error;
  const { data, error: e2 } = await sb.storage.from("files").createSignedUrl(path, PACK_DAYS * 86400, { download: fileName });
  if (e2) throw e2;
  return data.signedUrl;
}
