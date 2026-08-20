// Client-side label cutout — removes the background from a bag photo so it can
// hang in the museum as a floating object. Uses @imgly/background-removal
// (WASM, runs entirely in the browser; the segmentation model is fetched and
// cached on first use). Loaded straight from the CDN at call time — the
// webpackIgnore comment keeps webpack from trying to bundle its ONNX runtime,
// which Next.js cannot compile.

const CDN_URL = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm";

export async function cutoutImage(imageUrl) {
  const mod = await import(/* webpackIgnore: true */ CDN_URL);
  const removeBackground = mod.removeBackground || mod.default?.removeBackground || mod.default;
  const blob = await removeBackground(imageUrl, {
    output: { format: "image/png", quality: 0.9 },
  });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data:image/png;base64,...
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
