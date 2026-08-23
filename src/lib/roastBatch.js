// Calculate roast quarter from date
export function getRoastQuarter(roastDate) {
  if (!roastDate) return null;
  const d = new Date(roastDate);
  if (isNaN(d.getTime())) return null;
  const quarter = Math.ceil((d.getMonth() + 1) / 3);
  const year = d.getFullYear().toString().slice(-2);
  return `Q${quarter} '${year}`;  // e.g., "Q1 '26"
}

// Normalize a roast date to a plain YYYY-MM-DD day, or null if unusable.
function roastDay(roastDate) {
  if (!roastDate) return null;
  const d = new Date(roastDate);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Same batch means the same roast — the same roast date — not merely the same
// quarter. A re-order six weeks later shares a quarter but is a different roast
// with its own freshness curve, and calling that "same batch" invites merging
// two physically separate bags into one row. Quarters stay as display badges.
export function isSameBatch(coffee1, coffee2) {
  const d1 = roastDay(coffee1?.roastDate);
  const d2 = roastDay(coffee2?.roastDate);
  if (!d1 || !d2) return false;
  return d1 === d2;
}
