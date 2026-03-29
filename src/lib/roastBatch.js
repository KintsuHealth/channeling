// Calculate roast quarter from date
export function getRoastQuarter(roastDate) {
  if (!roastDate) return null;
  const d = new Date(roastDate);
  if (isNaN(d.getTime())) return null;
  const quarter = Math.ceil((d.getMonth() + 1) / 3);
  const year = d.getFullYear().toString().slice(-2);
  return `Q${quarter} '${year}`;  // e.g., "Q1 '26"
}

// Check if two coffees are from the same batch (same quarter)
export function isSameBatch(coffee1, coffee2) {
  const q1 = getRoastQuarter(coffee1?.roastDate);
  const q2 = getRoastQuarter(coffee2?.roastDate);
  if (!q1 || !q2) return false;
  return q1 === q2;
}
