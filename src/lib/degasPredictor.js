// Degas Predictor - Calculate recommended degassing period based on coffee characteristics
// Based on coffee science research on CO2 release rates

// Roast level base days (primary factor)
// Light roasts are denser with slower CO2 release (3x slower than dark)
const ROAST_LEVEL_BASE = {
  1: 14,  // Very Light
  2: 12,  // Light
  3: 10,  // Medium-Light
  4: 8,   // Medium
  5: 6,   // Medium-Dark
  6: 4,   // Dark
  7: 3,   // Very Dark
};

// Process method adjustments (secondary factor)
// Natural and fermented processes create denser beans
const PROCESS_ADJUSTMENTS = {
  'natural': 2,
  'dry': 2,
  'honey': 1,
  'black honey': 2,
  'red honey': 1,
  'yellow honey': 1,
  'anaerobic': 3,
  'carbonic maceration': 3,
  'washed': 0,
  'wet': 0,
  'semi-washed': 0,
};

// Altitude category adjustments (tertiary factor)
// Higher altitude = denser beans = slower degassing
const ALTITUDE_ADJUSTMENTS = {
  'very-high': 2,  // 2000m+
  'high': 1,       // 1800-2000m
  'mid': 0,        // 1400-1800m
  'low': -1,       // <1400m
};

/**
 * Parse roast level from various formats to a numeric 1-7 scale
 */
function parseRoastLevel(roastLevel) {
  if (!roastLevel) return null;

  // Already a number
  if (typeof roastLevel === 'number') {
    return Math.max(1, Math.min(7, Math.round(roastLevel)));
  }

  const lower = String(roastLevel).toLowerCase().trim();

  // Check for numeric strings
  const num = parseFloat(lower);
  if (!isNaN(num) && num >= 1 && num <= 7) {
    return Math.round(num);
  }

  // Text-based roast levels
  if (lower.includes('very light') || lower.includes('cinnamon') || lower.includes('blonde')) return 1;
  if (lower.includes('light') && !lower.includes('medium')) return 2;
  if (lower.includes('medium-light') || lower.includes('medium light')) return 3;
  if (lower.includes('medium-dark') || lower.includes('medium dark')) return 5;
  if (lower.includes('medium') && !lower.includes('light') && !lower.includes('dark')) return 4;
  if (lower.includes('very dark') || lower.includes('italian') || lower.includes('french')) return 7;
  if (lower.includes('dark') || lower.includes('full city+') || lower.includes('vienna')) return 6;
  if (lower.includes('city') || lower.includes('full city')) return 4;

  return null;
}

/**
 * Parse process method and return normalized key
 */
function parseProcess(process) {
  if (!process) return null;

  const lower = String(process).toLowerCase().trim();

  // Check each known process
  for (const key of Object.keys(PROCESS_ADJUSTMENTS)) {
    if (lower.includes(key)) return key;
  }

  // Common variations
  if (lower.includes('natural') || lower.includes('dry')) return 'natural';
  if (lower.includes('washed') || lower.includes('wet')) return 'washed';
  if (lower.includes('honey')) return 'honey';
  if (lower.includes('anaerobic') || lower.includes('ferment')) return 'anaerobic';

  return null;
}

/**
 * Calculate recommended degas days based on coffee characteristics
 * @param {Object} coffee - Coffee object with roastLevel, process, altitudeCategory
 * @returns {Object} { days, confidence, rationale[] }
 */
export function calculateDegasDays(coffee) {
  const rationale = [];
  let confidence = 'low';

  // Parse roast level
  const roastLevel = parseRoastLevel(coffee.roastLevel);
  let baseDays = 10; // Default if no roast info

  if (roastLevel !== null) {
    baseDays = ROAST_LEVEL_BASE[roastLevel] || 10;
    const roastNames = ['', 'Very Light', 'Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark', 'Very Dark'];
    rationale.push(`${roastNames[roastLevel]} roast → ${baseDays} day base`);
    confidence = 'medium';
  } else {
    rationale.push('Unknown roast → 10 day default');
  }

  // Process adjustment
  const process = parseProcess(coffee.process);
  let processAdj = 0;

  if (process !== null) {
    processAdj = PROCESS_ADJUSTMENTS[process] || 0;
    if (processAdj !== 0) {
      rationale.push(`${process.charAt(0).toUpperCase() + process.slice(1)} process → ${processAdj > 0 ? '+' : ''}${processAdj} days`);
    }
    if (roastLevel !== null) {
      confidence = 'high';
    }
  }

  // Altitude adjustment
  let altAdj = 0;
  const altCat = coffee.altitudeCategory;

  if (altCat && ALTITUDE_ADJUSTMENTS[altCat] !== undefined) {
    altAdj = ALTITUDE_ADJUSTMENTS[altCat];
    if (altAdj !== 0) {
      const altNames = { 'very-high': 'Very high altitude', 'high': 'High altitude', 'mid': 'Mid altitude', 'low': 'Low altitude' };
      rationale.push(`${altNames[altCat]} → ${altAdj > 0 ? '+' : ''}${altAdj} day${Math.abs(altAdj) !== 1 ? 's' : ''}`);
    }
  }

  // Calculate final days
  const totalDays = Math.max(3, Math.min(21, baseDays + processAdj + altAdj));

  return {
    days: totalDays,
    confidence,
    rationale,
  };
}

/**
 * Get degas suggestion with action recommendation
 * @param {Object} coffee - Coffee object with roastDate, roastLevel, process, altitudeCategory
 * @returns {Object} { action, days, message, daysElapsed, daysRemaining }
 */
export function getDegasSuggestion(coffee) {
  const prediction = calculateDegasDays(coffee);

  // Calculate days since roast
  let daysElapsed = 0;
  if (coffee.roastDate) {
    const roastDate = new Date(coffee.roastDate);
    daysElapsed = Math.floor((Date.now() - roastDate.getTime()) / 86400000);
  }

  const daysRemaining = Math.max(0, prediction.days - daysElapsed);

  let action, message;

  if (daysRemaining <= 0) {
    action = 'freeze_now';
    if (daysElapsed > prediction.days + 7) {
      message = `Fully degassed (${daysElapsed} days since roast)`;
    } else {
      message = `Ready to freeze! (${daysElapsed} days rested)`;
    }
  } else {
    action = 'wait';
    message = `Rest ${daysRemaining} more day${daysRemaining !== 1 ? 's' : ''} (${daysElapsed}/${prediction.days})`;
  }

  return {
    action,
    suggestedDays: prediction.days,
    daysElapsed,
    daysRemaining,
    message,
    confidence: prediction.confidence,
    rationale: prediction.rationale,
  };
}

/**
 * Get freeze date based on roast date and target rest days
 */
export function getFreezeDate(roastDate, targetDays) {
  if (!roastDate) return null;
  const roast = new Date(roastDate);
  return new Date(roast.getTime() + targetDays * 86400000);
}
