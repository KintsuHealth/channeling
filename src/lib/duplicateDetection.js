import { getRoastQuarter, isSameBatch } from './roastBatch';
import { optimizePortions } from './portions';
import { primaryRecipe } from './recipes';

// Normalize string for comparison (lowercase, trim, remove extra spaces, strip accents)
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Strip accents
}

// Check if two strings are similar enough to be considered a match
function isMatch(str1, str2) {
  return normalize(str1) === normalize(str2);
}

// Find duplicate coffees matching name + roaster
// Returns { match, isSameBatch } or null if no match
export function findDuplicateCoffee(newCoffee, allCoffees) {
  if (!newCoffee?.name || !allCoffees?.length) return null;

  const newName = normalize(newCoffee.name);
  const newRoaster = normalize(newCoffee.roaster);

  // Find all matches (same name + roaster)
  const matches = allCoffees.filter(c => {
    const nameMatch = isMatch(c.name, newCoffee.name);
    // If no roaster on either, match on name only
    // If both have roaster, they must match
    const roasterMatch = !newRoaster || !normalize(c.roaster) || isMatch(c.roaster, newCoffee.roaster);
    return nameMatch && roasterMatch;
  });

  if (matches.length === 0) return null;

  // Prefer same batch match, then most recent
  const sameBatchMatch = matches.find(c => isSameBatch(c, newCoffee));
  if (sameBatchMatch) {
    return { match: sameBatchMatch, isSameBatch: true };
  }

  // Return most recently added match
  const sortedMatches = [...matches].sort((a, b) => {
    const dateA = new Date(a.addedAt || a.frozenAt || 0);
    const dateB = new Date(b.addedAt || b.frozenAt || 0);
    return dateB - dateA;
  });

  return { match: sortedMatches[0], isSameBatch: false };
}

// Merge new grams into existing coffee portions
// Returns updated portions array and new gramsTotal
export function mergePortions(existingCoffee, newGrams, doseG) {
  if (!existingCoffee || !newGrams) return null;

  const currentDoseG = doseG || existingCoffee.doseG || 18;

  // Calculate remaining grams from existing portions
  const existingPortions = existingCoffee.portions || [];
  const currentIndex = existingCoffee.portionIndex || 0;

  // Sum up remaining portions (from current index onward)
  let remainingGrams = 0;
  for (let i = currentIndex; i < existingPortions.length; i++) {
    remainingGrams += existingPortions[i].grams || 0;
  }

  // If there's an active portion being used, subtract used doses
  if (currentIndex < existingPortions.length && existingCoffee.dosesUsed) {
    remainingGrams -= existingCoffee.dosesUsed * currentDoseG;
  }

  // Total new weight to portion
  const totalNewGrams = remainingGrams + newGrams;

  // Recalculate optimal portions
  const { portions: newPortions } = optimizePortions(totalNewGrams, currentDoseG);

  return {
    portions: newPortions,
    gramsTotal: (existingCoffee.gramsTotal || 0) + newGrams,
    // Reset portion tracking since we're recalculating
    portionIndex: 0,
    dosesUsed: 0
  };
}

// Get a summary of the duplicate match for display
export function getDuplicateSummary(match, newCoffee) {
  if (!match) return null;

  const matchQuarter = getRoastQuarter(match.roastDate);
  const newQuarter = getRoastQuarter(newCoffee?.roastDate);
  const sameBatch = isSameBatch(match, newCoffee);

  return {
    matchQuarter,
    newQuarter,
    sameBatch,
    hasRecipe: (() => { const r = primaryRecipe(match); return !!(r?.dose || r?.yield || r?.grind); })(),
    portionsRemaining: (match.portions?.length || 0) - (match.portionIndex || 0),
    gramsRemaining: calculateRemainingGrams(match)
  };
}

// Calculate remaining grams in a coffee
function calculateRemainingGrams(coffee) {
  if (!coffee?.portions?.length) return 0;

  const currentIndex = coffee.portionIndex || 0;
  let remaining = 0;

  for (let i = currentIndex; i < coffee.portions.length; i++) {
    remaining += coffee.portions[i].grams || 0;
  }

  // Subtract used doses from current portion
  if (currentIndex < coffee.portions.length && coffee.dosesUsed) {
    remaining -= coffee.dosesUsed * (coffee.doseG || 18);
  }

  return Math.max(0, Math.round(remaining));
}
