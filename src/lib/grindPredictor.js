/**
 * Grind Predictor - Estimates starting grind settings based on bean characteristics
 */

import { primaryEspressoRecipe } from "./recipes";
import { recipeEquipment, learnEquipmentDelta, DEFAULT_MACHINE_ID, DEFAULT_BASKET_ID } from "./equipment";
import { sameCoffee } from "./coffeeMatch";

// Variety density/extraction table (substring match, first hit wins).
// Negative = finer (dense or delicate/aromatic), positive = coarser.
// NOTE: order matters — list specific names before generic ones (e.g. pink bourbon before bourbon).
const VARIETY_OFFSETS = [
  { match: ['gesha', 'geisha'], offset: -0.1, label: 'Gesha → finer (dense, delicate)' },
  { match: ['chiroso'], offset: -0.1, label: 'Chiroso (Gesha-adjacent) → finer' },
  { match: ['sl28', 'sl 28', 'sl-28', 'sl34', 'sl 34', 'sl-34'], offset: -0.1, label: 'SL28/34 → finer (dense Kenyan)' },
  { match: ['pacamara'], offset: -0.05, label: 'Pacamara → touch finer' },
  { match: ['pink bourbon'], offset: -0.05, label: 'Pink Bourbon → touch finer' },
  { match: ['bourbon'], offset: 0, label: 'Bourbon → baseline density' },
  { match: ['typica'], offset: 0, label: 'Typica → baseline density' },
  { match: ['caturra'], offset: 0, label: 'Caturra → baseline density' },
  { match: ['castillo'], offset: 0, label: 'Castillo → baseline density' },
  { match: ['catuai', 'catuaí'], offset: 0, label: 'Catuaí → baseline density' },
  { match: ['robusta'], offset: 0.2, label: 'Robusta → coarser' },
];

// Continuous days-off-roast offset, clamped to [-0.2, +0.1].
// Fresh beans (CO2-heavy) read coarser; offset eases to ~0 by the ~day-12 peak,
// then trends finer with a gentle exponential decay as the bean ages.
function freshnessOffsetCurve(days) {
  const peak = 12;
  let v;
  if (days <= peak) {
    v = 0.1 * (1 - days / peak);
  } else {
    v = -0.2 * (1 - Math.exp(-(days - peak) / 18));
  }
  return Math.max(-0.2, Math.min(0.1, v));
}

/**
 * Parse altitude string into numeric meters
 * @param {string} altitudeStr - Free-form altitude string (e.g., "1800m", "1400-1600 masl")
 * @returns {number|null} Altitude in meters
 */
export function parseAltitudeMeters(altitudeStr) {
  if (!altitudeStr) return null;

  const s = altitudeStr.toLowerCase().replace(/,/g, '');

  // Extract numbers from string
  const numbers = s.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;

  // Use the highest number found (for ranges like "1400-1800m")
  const altitude = Math.max(...numbers.map(n => parseInt(n, 10)));

  // Sanity check - altitude should be reasonable (100m - 3000m for coffee)
  if (altitude < 100 || altitude > 3000) return null;

  return altitude;
}

/**
 * Parse altitude string into category
 * @param {string} altitudeStr - Free-form altitude string (e.g., "1800m", "1400-1600 masl")
 * @returns {"high" | "mid" | "low" | null}
 */
export function parseAltitude(altitudeStr) {
  const meters = parseAltitudeMeters(altitudeStr);
  if (meters === null) return null;

  if (meters >= 1800) return "high";
  if (meters >= 1400) return "mid";
  return "low";
}

/**
 * Calculate altitude offset using continuous interpolation
 * Higher altitude = denser beans = finer grind (negative offset)
 * @param {number} meters - Altitude in meters
 * @returns {{ offset: number, rationale: string }}
 */
function calculateAltitudeOffset(meters) {
  // Scale: -0.2 to +0.2
  // 1000m or below = +0.2 (coarser, low density)
  // 1400m = 0 (baseline, mid density)
  // 1800m+ = -0.2 (finer, high density)

  let offset;
  let descriptor;

  if (meters >= 1800) {
    offset = -0.2 - Math.min((meters - 1800) / 2000, 0.1); // up to -0.3 at 2000m+
    descriptor = `High altitude (${meters}m)`;
  } else if (meters >= 1400) {
    offset = -((meters - 1400) / 2000); // 1400m=0, 1800m=-0.2
    descriptor = `Mid-high altitude (${meters}m)`;
  } else if (meters >= 1000) {
    offset = 0.2 - ((meters - 1000) / 2000); // 1000m=+0.2, 1400m=0
    descriptor = `Mid-low altitude (${meters}m)`;
  } else {
    offset = 0.2 + Math.min((1000 - meters) / 5000, 0.1); // up to +0.3 at 500m
    descriptor = `Low altitude (${meters}m)`;
  }

  // Round to 2 decimal places
  offset = Math.round(offset * 100) / 100;

  const direction = offset > 0 ? 'coarser' : offset < 0 ? 'finer' : 'baseline';
  const rationale = `${descriptor} → ${direction}`;

  return { offset, rationale };
}

/**
 * Normalize process string to standard category
 * @param {string} processStr
 * @returns {string} Normalized process type
 */
export function normalizeProcess(processStr) {
  if (!processStr) return null;

  const s = processStr.toLowerCase();

  // Natural / Dry
  if (s.includes('natural') || s.includes('dry') || s.includes('sundried')) {
    return 'natural';
  }

  // Honey / Pulped Natural
  if (s.includes('honey') || s.includes('pulped natural') || s.includes('semi-washed')) {
    return 'honey';
  }

  // Anaerobic / Experimental
  if (s.includes('anaerobic') || s.includes('carbonic') || s.includes('experimental')) {
    return 'anaerobic';
  }

  // Washed (default for most processing)
  if (s.includes('washed') || s.includes('wet')) {
    return 'washed';
  }

  // Default to washed if unclear
  return 'washed';
}

/**
 * Calculate days since roast
 * @param {string} roastDateIso - ISO date string
 * @returns {number|null} Days since roast
 */
function daysSinceRoast(roastDateIso) {
  if (!roastDateIso) return null;
  const roastDate = new Date(roastDateIso);
  if (isNaN(roastDate.getTime())) return null;
  return Math.floor((Date.now() - roastDate.getTime()) / 86400000);
}

/**
 * Calculate grind offset based on coffee characteristics
 *
 * Positive offset = grind coarser (higher number)
 * Negative offset = grind finer (lower number)
 *
 * @param {Object} coffee - Coffee object with characteristics
 * @param {string} [pulledAt] - ISO date when portion was pulled (for freshness calc)
 * @returns {{ offset: number, rationale: string[], confidence: "high" | "medium" | "low" }}
 */
export function calculateGrindOffset(coffee, pulledAt = null) {
  const rationale = [];
  let offset = 0;
  let factorsPresent = 0;
  let roastOffset = 0; // hoisted so the roast×process interaction term can read it

  // 1. Roast Level: -0.4 to +0.4
  // Light roasts need finer grind (negative offset), dark roasts need coarser (positive)
  const roastLevel = coffee?.roastLevel;
  if (roastLevel !== undefined && roastLevel !== null && roastLevel !== '') {
    roastOffset = 0;

    // Handle numeric scale (1-5)
    if (typeof roastLevel === 'number') {
      const numLevel = roastLevel;
      if (numLevel === 1) {
        roastOffset = -0.4;
        rationale.push('Light roast → finer');
      } else if (numLevel === 2) {
        roastOffset = -0.2;
        rationale.push('Medium-light roast → slightly finer');
      } else if (numLevel === 3) {
        roastOffset = 0;
        rationale.push('Medium roast → baseline');
      } else if (numLevel === 4) {
        roastOffset = 0.2;
        rationale.push('Medium-dark roast → slightly coarser');
      } else if (numLevel === 5) {
        roastOffset = 0.4;
        rationale.push('Dark roast → coarser');
      }
      factorsPresent++;
    } else if (typeof roastLevel === 'string' && roastLevel.length > 0) {
      // Check if it's a numeric string first
      const parsed = parseInt(roastLevel, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
        if (parsed === 1) {
          roastOffset = -0.4;
          rationale.push('Light roast → finer');
        } else if (parsed === 2) {
          roastOffset = -0.2;
          rationale.push('Medium-light roast → slightly finer');
        } else if (parsed === 3) {
          roastOffset = 0;
          rationale.push('Medium roast → baseline');
        } else if (parsed === 4) {
          roastOffset = 0.2;
          rationale.push('Medium-dark roast → slightly coarser');
        } else if (parsed === 5) {
          roastOffset = 0.4;
          rationale.push('Dark roast → coarser');
        }
      } else {
        // Handle string descriptors
        const roast = roastLevel.toLowerCase();
        if (roast.includes('light') && !roast.includes('medium')) {
          roastOffset = -0.4;
          rationale.push('Light roast → finer');
        } else if (roast.includes('medium-light') || roast.includes('medium light')) {
          roastOffset = -0.2;
          rationale.push('Medium-light roast → slightly finer');
        } else if (roast === 'medium' || (roast.includes('medium') && !roast.includes('dark'))) {
          roastOffset = 0;
          rationale.push('Medium roast → baseline');
        } else if (roast.includes('medium-dark') || roast.includes('medium dark')) {
          roastOffset = 0.2;
          rationale.push('Medium-dark roast → slightly coarser');
        } else if (roast.includes('dark')) {
          roastOffset = 0.4;
          rationale.push('Dark roast → coarser');
        }
      }
      factorsPresent++;
    }

    offset += roastOffset;
  }

  // 2. Process: 0 to +0.2
  // Naturals/anaerobics tend to extract more easily
  const process = normalizeProcess(coffee.process);
  if (process) {
    let processOffset = 0;

    if (process === 'natural') {
      processOffset = 0.1;
      rationale.push('Natural process → touch coarser');
    } else if (process === 'anaerobic') {
      processOffset = 0.2;
      rationale.push('Anaerobic process → slightly coarser');
    } else if (process === 'honey') {
      processOffset = 0.05;
      rationale.push('Honey process → touch coarser');
    }
    // Washed = 0, baseline

    offset += processOffset;
    factorsPresent++;
  }

  // 3. Altitude: continuous interpolation for precise predictions
  // Higher altitude = denser beans = finer grind
  // Try to get exact meters first, fall back to category
  const altitudeMeters = parseAltitudeMeters(coffee.altitude);
  const altitudeCategory = coffee.altitudeCategory || parseAltitude(coffee.altitude);

  if (altitudeMeters !== null) {
    // Use precise interpolation when we have exact altitude
    const altResult = calculateAltitudeOffset(altitudeMeters);
    offset += altResult.offset;
    rationale.push(altResult.rationale);
    factorsPresent++;
  } else if (altitudeCategory) {
    // Fall back to category-based estimation
    let altOffset = 0;
    if (altitudeCategory === 'high') {
      altOffset = -0.2;
      rationale.push('High altitude (1800m+) → finer');
    } else if (altitudeCategory === 'mid') {
      altOffset = 0;
      rationale.push('Mid altitude → baseline');
    } else if (altitudeCategory === 'low') {
      altOffset = 0.2;
      rationale.push('Low altitude (<1400m) → coarser');
    }
    offset += altOffset;
    factorsPresent++;
  }

  // 4. Days off roast: -1 to +0.5
  // Fresh beans need coarser grind, stale beans need finer
  const roastDate = coffee.roastDate;
  const effectiveDate = pulledAt || new Date().toISOString();
  const days = roastDate ? daysSinceRoast(roastDate) : null;

  if (days !== null) {
    // Smooth CO2-degas curve instead of hard brackets: coarse when fresh and
    // gassy, easing through the ~day-12 peak, then trending finer as it ages.
    const freshnessOffset = freshnessOffsetCurve(days);
    let label;
    if (days < 7) label = `Fresh (${days}d off roast) → touch coarser`;
    else if (days <= 18) label = `Near peak (${days}d) → ~baseline`;
    else label = `Aging (${days}d) → finer`;
    rationale.push(label);

    offset += freshnessOffset;
    factorsPresent++;
  }

  // 5. Variety: dense/aromatic cultivars trend finer, robusta coarser.
  if (coffee.variety) {
    const variety = coffee.variety.toLowerCase();
    const entry = VARIETY_OFFSETS.find((v) => v.match.some((m) => variety.includes(m)));
    if (entry) {
      offset += entry.offset;
      rationale.push(entry.label);
      factorsPresent++;
    }
  }

  // 6. Interaction: a light roast on a high-extraction (natural/anaerobic) ferment
  // is very soluble — the additive terms nearly cancel and under-predict, so nudge
  // coarser to head off over-extraction (boozy/harsh).
  if (roastOffset <= -0.2 && (process === 'natural' || process === 'anaerobic')) {
    const bump = process === 'anaerobic' ? 0.3 : 0.2;
    offset += bump;
    rationale.push(`Light + ${process} ferment → extra coarser (counter over-extraction)`);
  }

  // Determine confidence based on factors present
  let confidence;
  if (factorsPresent >= 3) {
    confidence = 'high';
  } else if (factorsPresent >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Round to nearest 0.1
  offset = Math.round(offset * 10) / 10;

  return {
    offset,
    rationale,
    confidence
  };
}

/**
 * Format offset for display using qualitative descriptions
 * @param {number} offset
 * @returns {string}
 */
export function formatOffset(offset) {
  if (offset === 0) return 'at baseline';

  const direction = offset > 0 ? 'coarser' : 'finer';
  const absOffset = Math.abs(offset);

  // Use qualitative descriptions instead of click counts
  let intensity;
  if (absOffset <= 0.1) {
    return 'at baseline';
  } else if (absOffset <= 0.3) {
    intensity = 'touch';
  } else if (absOffset <= 0.5) {
    intensity = 'slightly';
  } else if (absOffset <= 0.8) {
    intensity = 'noticeably';
  } else if (absOffset <= 1.2) {
    intensity = 'significantly';
  } else {
    intensity = 'much';
  }

  return `${intensity} ${direction} than baseline`;
}

/**
 * Calculate suggested grind setting
 * @param {number} baseline - User's baseline grind setting
 * @param {number} offset - Calculated offset
 * @returns {number}
 */
export function calculateSuggestedGrind(baseline, offset, calibration = 0) {
  if (baseline === null || baseline === undefined) return null;
  // Ensure baseline is a number (Supabase may return string)
  const baselineNum = typeof baseline === 'string' ? parseFloat(baseline) : Number(baseline);
  if (isNaN(baselineNum)) return null;
  return Math.round((baselineNum + offset + (calibration || 0)) * 10) / 10;
}

/**
 * Learn a personal calibration from the grinds the user actually settled on.
 *
 * For each past coffee that has both a recorded espresso grind and a stored
 * prediction offset, the residual is (actualGrind − (baseline + predictedOffset)).
 * If the user systematically lands finer/coarser than the model predicts, the
 * weighted residual nudges future suggestions toward what has worked for them.
 *
 * The averaging is deliberately learning-shaped:
 *  - exponential recency decay (half-life ~30 days) — the model follows your
 *    averages as they drift, so a new grinder burr season or basket change
 *    fades in rather than lurching;
 *  - favorited / highly-rated coffees weigh more (those are truly "dialed in");
 *  - residuals recorded on other equipment are first translated to the
 *    current setup via the learned equipment delta, so switching to the
 *    Unifilter doesn't poison the history (or vice versa).
 *
 * @param {Array} allCoffees
 * @param {number} baseline - user's baseline grind
 * @param {{machineId, basketId}} [currentSetup] - equipment to calibrate for
 * @returns {{ calibration: number, sampleSize: number }}
 */
export function calculatePersonalCalibration(allCoffees, baseline, currentSetup = null) {
  const baseNum = typeof baseline === 'string' ? parseFloat(baseline) : Number(baseline);
  if (!Array.isArray(allCoffees) || isNaN(baseNum)) return { calibration: 0, sampleSize: 0 };

  const setup = currentSetup || { machineId: DEFAULT_MACHINE_ID, basketId: DEFAULT_BASKET_ID };
  const deltaCache = new Map();
  const deltaTo = (from) => {
    const key = `${from.machineId}::${from.basketId}`;
    if (!deltaCache.has(key)) {
      deltaCache.set(key, learnEquipmentDelta(allCoffees, from, setup).delta);
    }
    return deltaCache.get(key);
  };

  const now = Date.now();
  const HALF_LIFE_DAYS = 30;
  const samples = [];
  for (const c of allCoffees) {
    const rec = primaryEspressoRecipe(c);
    const grindRaw = parseFloat(rec?.grind);
    const predOffset = typeof c?.grindOffsetPrediction === 'number'
      ? c.grindOffsetPrediction
      : parseFloat(c?.grindOffsetPrediction);
    if (isNaN(grindRaw) || isNaN(predOffset)) continue;

    // Normalize the recorded grind onto the current equipment before comparing.
    const grind = grindRaw + deltaTo(recipeEquipment(rec));
    const residual = grind - (baseNum + predOffset);
    // Ignore implausible residuals (likely baseline noise or typos).
    if (Math.abs(residual) > 3) continue;

    const rating = Number(c.rating) || 0;
    const quality = (c.favorite ? 2 : 1) + (rating >= 4 ? 1 : 0); // always >= 1
    const when = new Date(c.finishedAt || c.pulledAt || c.frozenAt || c.addedAt || 0).getTime();
    const ageDays = Math.max(0, (now - when) / 86400000);
    const recency = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    samples.push({ residual, weight: quality * Math.max(recency, 0.05), when });
  }

  if (samples.length < 2) return { calibration: 0, sampleSize: samples.length };

  // Cap at the most recent ~12 dial-ins; decay already de-weights the tail.
  samples.sort((a, b) => b.when - a.when);
  const recent = samples.slice(0, 12);
  const totalW = recent.reduce((s, x) => s + x.weight, 0);
  if (totalW <= 0) return { calibration: 0, sampleSize: recent.length };
  const weighted = recent.reduce((s, x) => s + x.residual * x.weight, 0) / totalW;

  return { calibration: Math.round(weighted * 10) / 10, sampleSize: recent.length };
}

/**
 * Find previous grind settings for the same coffee (name + roaster).
 * @returns {{ grind: string, coffee: Object, recipe: Object } | null}
 */
export function findPreviousGrindSettings(coffee, allCoffees) {
  if (!coffee || !allCoffees || allCoffees.length === 0) return null;

  // Same identity test the scan flow uses, so a bag flagged as a repeat
  // purchase at scan time is never treated as a stranger at dial-in time.
  const matches = allCoffees.filter(c => {
    if (c.id === coffee.id) return false;
    if (!primaryEspressoRecipe(c)?.grind) return false;
    return sameCoffee(c, coffee);
  });

  if (matches.length === 0) return null;

  const sorted = matches.sort((a, b) => {
    const dateA = new Date(a.finishedAt || a.pulledAt || a.frozenAt || 0);
    const dateB = new Date(b.finishedAt || b.pulledAt || b.frozenAt || 0);
    return dateB - dateA;
  });

  const rec = primaryEspressoRecipe(sorted[0]);
  return { grind: rec?.grind, coffee: sorted[0], recipe: rec };
}

/**
 * Compare the bag being dialed in against the previous bag of the same coffee:
 * where did the last one settle, and how does THIS bag differ (fresher/older
 * roast, different batch)? Answers "you landed at 2.4 last time, but this bag
 * is 10 days fresher off roast — start a touch coarser at 2.5".
 *
 * @returns {null | {
 *   previous: Object, previousGrind: number, previousRecipe: Object,
 *   freshnessAdjustment: number, roastDaysNow: number|null, roastDaysPrev: number|null,
 *   suggestedGrind: number, explanation: string[]
 * }}
 */
export function compareToPreviousBag(coffee, allCoffees, pulledAt = null) {
  const prev = findPreviousGrindSettings(coffee, allCoffees);
  const prevGrind = parseFloat(prev?.grind);
  if (!prev || isNaN(prevGrind)) return null;

  const explanation = [];

  // Days off roast for each bag at the moment it was (or is being) dialed.
  const dialMoment = (iso) => (iso ? new Date(iso).getTime() : Date.now());
  const roastDays = (c, atIso) => {
    if (!c.roastDate) return null;
    const d = Math.floor((dialMoment(atIso) - new Date(c.roastDate).getTime()) / 86400000);
    return isNaN(d) ? null : d;
  };
  const roastDaysNow = roastDays(coffee, pulledAt);
  const roastDaysPrev = roastDays(prev.coffee, prev.coffee.pulledAt || prev.coffee.frozenAt);

  // Freshness is the one factor that genuinely differs between two bags of the
  // same coffee — take the difference of the degas curve at each bag's age.
  let freshnessAdjustment = 0;
  if (roastDaysNow !== null && roastDaysPrev !== null && roastDaysNow !== roastDaysPrev) {
    freshnessAdjustment = Math.round(
      (freshnessOffsetCurve(roastDaysNow) - freshnessOffsetCurve(roastDaysPrev)) * 20
    ) / 20;
    const diff = roastDaysNow - roastDaysPrev;
    if (Math.abs(freshnessAdjustment) >= 0.05) {
      explanation.push(
        diff < 0
          ? `This bag is ${-diff}d fresher off roast → ${freshnessAdjustment > 0 ? 'coarser' : 'finer'}`
          : `This bag is ${diff}d further off roast → ${freshnessAdjustment > 0 ? 'coarser' : 'finer'}`
      );
    } else {
      explanation.push('Similar age off roast — same grind should hold');
    }
  } else {
    explanation.push(`Previous bag settled at ${prevGrind}`);
  }

  const suggestedGrind = Math.round((prevGrind + freshnessAdjustment) * 10) / 10;

  return {
    previous: prev.coffee,
    previousGrind: prevGrind,
    previousRecipe: prev.recipe,
    freshnessAdjustment,
    roastDaysNow,
    roastDaysPrev,
    suggestedGrind,
    explanation,
  };
}

/**
 * Validate prediction accuracy after user enters actual grind
 * @param {number} predicted - Predicted grind setting
 * @param {string} actual - Actual grind setting (string from form)
 * @returns {{ status: "close" | "off" | "way_off", diff: number, message: string } | null}
 */
export function validatePrediction(predicted, actual) {
  if (predicted === null || predicted === undefined || !actual) return null;

  const actualNum = parseFloat(actual);
  if (isNaN(actualNum)) return null;

  const diff = Math.abs(actualNum - predicted);

  if (diff <= 1) {
    return {
      status: 'close',
      diff,
      message: 'Prediction was close!'
    };
  } else if (diff <= 3) {
    return {
      status: 'off',
      diff,
      message: `Prediction was off by ~${diff.toFixed(1)}`
    };
  } else {
    return {
      status: 'way_off',
      diff,
      message: 'Big difference — consider updating baseline'
    };
  }
}
