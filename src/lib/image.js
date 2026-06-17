// Shared image helpers. Mirrors the image pipeline used for coffee labels so the
// latte-art feed can reuse it. (Phase-2 polish: collapse the duplicate copies of
// compressImage / uploadLabelImage in index.js + useCoffees.js onto these.)

// Downscale + JPEG-compress a File, stepping quality down until under the size cap.
// Rejects (rather than hanging) on a decode failure or a null encode result.
export function compressImage(file, maxSizeBytes = 4 * 1024 * 1024, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    const done = (fn, arg) => { URL.revokeObjectURL(objectUrl); fn(arg); };

    img.onerror = () => done(reject, new Error("Could not decode image"));
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      const tryCompress = (q) => {
        canvas.toBlob((blob) => {
          if (!blob) { done(reject, new Error("Could not encode image")); return; }
          if (blob.size > maxSizeBytes && q > 0.3) {
            tryCompress(q - 0.1);
          } else {
            done(resolve, new File([blob], (file.name || "photo").replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
          }
        }, "image/jpeg", q);
      };
      tryCompress(0.85);
    };
    img.src = objectUrl;
  });
}

// Read a File as a data URL (for preview + upload).
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Upload a base64/data-URL image to a Supabase Storage bucket.
// Returns { url, path } so callers can clean up the object if a later DB write fails.
// Defaults to the existing public "label-images" bucket so it can back any feature.
export async function uploadImageToBucket(supabase, userId, base64Data, { bucket = "label-images", folder = "" } = {}) {
  if (!supabase || !userId || !base64Data) return null;
  const response = await fetch(base64Data);
  const blob = await response.blob();
  const prefix = folder ? `${folder}/` : "";
  // Random suffix avoids same-millisecond collisions (upload defaults to no-overwrite).
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/${prefix}${Date.now()}-${rand}.jpg`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, blob);
  if (uploadError) {
    console.error("uploadImageToBucket error:", JSON.stringify(uploadError, null, 2));
    throw uploadError;
  }
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: publicUrl, path };
}

// Derive the storage object path from a public URL (for deletion).
export function storagePathFromPublicUrl(url, bucket = "label-images") {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}
