export const DEFAULT_DOSE_G = 18;
export const DEFAULT_DOSES_PER_PORTION = 5;
const PDMIN = 5; // min doses per portion
const PDMAX = 7; // max doses per portion

export function optimizePortions(totalGrams, doseG = DEFAULT_DOSE_G, targetDosesPerPortion = null) {
  // Ensure valid inputs
  if (!totalGrams || totalGrams <= 0) return { portions: [], summary: "No weight", doseG };
  if (!doseG || doseG < 10 || doseG > 30) doseG = DEFAULT_DOSE_G; // Sanity check dose size
  if (totalGrams > 5000) totalGrams = 5000; // Cap at 5kg to prevent runaway loops
  const totalDoses = Math.floor(totalGrams / doseG);
  const remainderG = totalGrams - totalDoses * doseG;

  if (totalDoses === 0)
    return { portions: [{ grams: totalGrams, doses: 0, buffer: totalGrams }], summary: `${totalGrams}g — less than one dose`, doseG };

  // If user specified a target doses per portion, use fixed-size portioning
  if (targetDosesPerPortion && targetDosesPerPortion > 0) {
    const numPortions = Math.ceil(totalDoses / targetDosesPerPortion);
    const dpp = [];
    let remaining = totalDoses;
    for (let i = 0; i < numPortions; i++) {
      const doses = Math.min(targetDosesPerPortion, remaining);
      dpp.push(doses);
      remaining -= doses;
    }

    const baseBuffer = Math.floor(remainderG / numPortions);
    const extraBufferUnits = remainderG - baseBuffer * numPortions;
    const portions = dpp.map((d, i) => {
      const buf = baseBuffer + (i < extraBufferUnits ? 1 : 0);
      return { grams: d * doseG + buf, doses: d, buffer: buf };
    });
    const avgBuf = (remainderG / numPortions).toFixed(1);
    return { portions, summary: `${numPortions} portions · ${totalDoses} doses · ~${avgBuf}g buffer each`, doseG };
  }

  // Default optimization: target 5-7 doses per portion
  if (totalDoses <= PDMAX) {
    return {
      portions: [{ grams: totalGrams, doses: totalDoses, buffer: +remainderG.toFixed(1) }],
      summary: `1 portion · ${totalDoses} doses · ${remainderG.toFixed(1)}g buffer`,
      doseG,
    };
  }

  let best = null;
  const maxN = Math.ceil(totalDoses / PDMIN);
  for (let n = 1; n <= maxN; n++) {
    if (totalDoses < n * PDMIN || totalDoses > n * PDMAX) continue;
    const extra = totalDoses - n * PDMIN;
    const dpp = Array(n).fill(PDMIN);
    for (let i = 0; i < extra; i++) dpp[i % n]++;
    dpp.sort((a, b) => b - a);
    const spread = dpp[0] - dpp[dpp.length - 1];
    const score = n * 100 + spread * 10;
    if (!best || score < best.score) best = { dpp, score, n };
  }

  if (!best) {
    const n = Math.ceil(totalDoses / PDMIN);
    const dpp = Array(n).fill(PDMIN);
    let left = totalDoses - n * PDMIN;
    for (let i = 0; left > 0 && i < n; i++) { dpp[i]++; left--; }
    best = { dpp, n };
  }

  const baseBuffer = Math.floor(remainderG / best.n);
  const extraBufferUnits = remainderG - baseBuffer * best.n;
  const portions = best.dpp.map((d, i) => {
    const buf = baseBuffer + (i < extraBufferUnits ? 1 : 0);
    return { grams: d * doseG + buf, doses: d, buffer: buf };
  });
  const avgBuf = (remainderG / best.n).toFixed(1);
  return { portions, summary: `${best.n} portions · ${totalDoses} doses · ~${avgBuf}g buffer each · zero waste`, doseG };
}

export function parseGrams(w) {
  if (!w) return null;
  const s = String(w).toLowerCase().replace(/\s/g, "");
  let g = null;
  if (s.includes("oz")) g = parseFloat(s) * 28.3495;
  else if (s.includes("lb")) g = parseFloat(s) * 453.592;
  else if (s.includes("kg")) g = parseFloat(s) * 1000;
  else if (s.includes("g")) g = parseFloat(s);
  else g = parseFloat(s); // Default to grams if no unit specified
  return g && !isNaN(g) ? Math.round(g) : null;
}
