// Is this the same coffee as one already on the shelf?
//
// Repeat purchases are the normal case — a third bag of the same beans should
// inherit what the first two taught us. This used to be exact string equality,
// so one OCR wobble in a scanned name ("Gesha" for "Geisha", a dropped "Inza")
// silently forked the coffee into a new one with no history. Comparing token
// sets, with a one-character slack per word, survives that.
//
// Everything that asks "same coffee?" goes through here — scan-time duplicate
// detection and the dial-in predictor alike — so the two can't disagree.

const MIN_TOKEN_LEN = 2;
const NAME_THRESHOLD = 0.6;
const ROASTER_THRESHOLD = 0.6;
const FUZZY_MIN_LEN = 5; // only long words are unambiguous enough to fuzz

export function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, ' ');
}

function tokenize(str) {
  return normalize(str)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= MIN_TOKEN_LEN);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Same word, allowing a single OCR slip on words long enough to stay unambiguous.
function sameToken(t1, t2) {
  if (t1 === t2) return true;
  if (Math.min(t1.length, t2.length) < FUZZY_MIN_LEN) return false;
  return levenshtein(t1, t2) <= 1;
}

/**
 * Token overlap of two strings, scored against the shorter one so a name that
 * merely drops a word still reads as a full match. Returns 0..1.
 */
export function similarity(strA, strB) {
  const a = tokenize(strA);
  const b = tokenize(strB);
  if (!a.length || !b.length) return 0;

  const taken = new Array(b.length).fill(false);
  let shared = 0;
  for (const t of a) {
    const hit = b.findIndex((u, i) => !taken[i] && sameToken(t, u));
    if (hit !== -1) {
      taken[hit] = true;
      shared++;
    }
  }
  if (!shared) return 0;

  const smaller = Math.min(a.length, b.length);
  // One word in common is a coincidence, not a match — "Geisha" and "Natural"
  // are shared by half the shelf. Demand two once both names are multi-word.
  if (smaller >= 2 && shared < 2) return 0;

  return shared / smaller;
}

/**
 * Same coffee, ignoring which bag or batch it is.
 *
 * Roaster is corroborating evidence: when both sides name one it has to agree,
 * and when either is missing the name carries the decision alone. That mirrors
 * how the scan flow already behaved, so a blank roaster field never costs you
 * the match.
 */
export function sameCoffee(a, b) {
  if (!a?.name || !b?.name) return false;
  if (similarity(a.name, b.name) < NAME_THRESHOLD) return false;

  const roasterA = normalize(a.roaster);
  const roasterB = normalize(b.roaster);
  if (!roasterA || !roasterB) return true;

  return similarity(a.roaster, b.roaster) >= ROASTER_THRESHOLD;
}
