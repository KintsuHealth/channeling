/**
 * Grind Predictor - Estimates starting grind settings based on bean characteristics
 */

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

  // 1. Roast Level: -0.4 to +0.4
  // Light roasts need finer grind (negative offset), dark roasts need coarser (positive)
  const roastLevel = coffee?.roastLevel;
  if (roastLevel !== undefined && roastLevel !== null && roastLevel !== '') {
    let roastOffset = 0;

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
    let freshnessOffset = 0;

    if (days < 7) {
      freshnessOffset = 0.1;
      rationale.push(`Fresh (${days}d off roast) → touch coarser`);
    } else if (days >= 7 && days <= 21) {
      freshnessOffset = 0;
      rationale.push(`Peak freshness (${days}d) → baseline`);
    } else if (days > 21 && days <= 35) {
      freshnessOffset = -0.1;
      rationale.push(`Aging (${days}d) → touch finer`);
    } else if (days > 35) {
      freshnessOffset = -0.2;
      rationale.push(`Older (${days}d) → slightly finer`);
    }

    offset += freshnessOffset;
    factorsPresent++;
  }

  // 5. Variety: -0.1 to +0.2 (only for specific varieties)
  if (coffee.variety) {
    const variety = coffee.variety.toLowerCase();
    let varietyOffset = 0;

    if (variety.includes('gesha') || variety.includes('geisha')) {
      varietyOffset = -0.1;
      rationale.push('Gesha variety → touch finer');
      factorsPresent++;
    } else if (variety.includes('robusta')) {
      varietyOffset = 0.2;
      rationale.push('Robusta → slightly coarser');
      factorsPresent++;
    }
    // Other varieties don't contribute to offset

    offset += varietyOffset;
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
export function calculateSuggestedGrind(baseline, offset) {
  if (baseline === null || baseline === undefined) return null;
  // Ensure baseline is a number (Supabase may return string)
  const baselineNum = typeof baseline === 'string' ? parseFloat(baseline) : Number(baseline);
  if (isNaN(baselineNum)) return null;
  return Math.round((baselineNum + offset) * 10) / 10;
}

/**
 * Find previous grind settings for similar coffees
 * @param {Object} coffee - Current coffee
 * @param {Array} allCoffees - All coffees in inventory
 * @returns {{ grind: string, coffee: Object } | null}
 */
export function findPreviousGrindSettings(coffee, allCoffees) {
  if (!coffee || !allCoffees || allCoffees.length === 0) return null;

  // Look for coffees with same name and/or roaster (excluding current)
  const matches = allCoffees.filter(c => {
    if (c.id === coffee.id) return false;
    if (!c.espresso?.grind) return false;

    const sameName = c.name && coffee.name &&
      c.name.toLowerCase() === coffee.name.toLowerCase();
    const sameRoaster = c.roaster && coffee.roaster &&
      c.roaster.toLowerCase() === coffee.roaster.toLowerCase();

    return sameName && sameRoaster;
  });

  if (matches.length === 0) return null;

  // Return most recent match
  const sorted = matches.sort((a, b) => {
    const dateA = new Date(a.finishedAt || a.pulledAt || a.frozenAt || 0);
    const dateB = new Date(b.finishedAt || b.pulledAt || b.frozenAt || 0);
    return dateB - dateA;
  });

  return {
    grind: sorted[0].espresso.grind,
    coffee: sorted[0]
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
