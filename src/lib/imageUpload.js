// Pick a photo from the phone/computer → shrink it in the browser → upload to Supabase Storage.
import { supabase } from "@/lib/supabase";

export const IMAGE_BUCKET = "product-images";
const MAX_SIDE = 1000;   // px — plenty for menu cards, keeps files small (~100–200 KB)
const QUALITY = 0.82;
const MAX_INPUT_MB = 20;

function loadViaImgTag(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This picture format is not supported. Please use a JPG or PNG.")); };
    img.src = url;
  });
}

export async function compressImage(file) {
  if (!file || !file.type?.startsWith("image/")) throw new Error("Please choose a picture (JPG or PNG).");
  if (file.size > MAX_INPUT_MB * 1024 * 1024) throw new Error(`Picture is too big (max ${MAX_INPUT_MB} MB).`);

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); // keeps phone photos upright
  } catch {
    bitmap = await loadViaImgTag(file);
  }
  const srcW = bitmap.width || bitmap.naturalWidth;
  const srcH = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";            // transparent PNGs → white background
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not process the picture."))), "image/jpeg", QUALITY)
  );
}

function friendly(error) {
  const msg = String(error?.message || error || "");
  if (/bucket not found/i.test(msg)) return new Error("Image storage is not set up yet. Run storage_images.sql in Supabase → SQL Editor.");
  if (/row-level security|not authorized|unauthorized|permission/i.test(msg)) return new Error("Only admins can upload pictures. Please log in as admin.");
  if (/mime|type/i.test(msg) && /not (allowed|supported)/i.test(msg)) return new Error("That picture type is not allowed. Use JPG, PNG or WebP.");
  if (/exceeded|too large|size/i.test(msg)) return new Error("Picture is too large.");
  return new Error(msg || "Upload failed.");
}

/** Returns the public URL of the uploaded picture. */
export async function uploadImage(file, folder = "products") {
  const blob = await compressImage(file);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw friendly(error);
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
