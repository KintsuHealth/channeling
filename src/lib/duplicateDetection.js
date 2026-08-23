import { getRoastQuarter, isSameBatch } from './roastBatch';
import { optimizePortions } from './portions';
import { primaryRecipe } from './recipes';
import { sameCoffee } from './coffeeMatch';

// Find previous bags of the same coffee, in any state \u2014 resting, freezer,
// active or archived. Returns { match, isSameBatch } or null if no match.
export function findDuplicateCoffee(newCoffee, allCoffees) {
  if (!newCoffee?.name || !allCoffees?.length) return null;

  const matches = allCoffees.filter(c => sameCoffee(c, newCoffee));

  if (matches.length === 0) return null;

  // Prefer same batch match, then most recent
  const sameBatchMatch = matches.find(c => isSameBatch(c, newCoffee));
  if (sameBatchMatch) {
    return { match: sameBatchMatch, isSameBatch: true };
  }

  // Most recent first...
  const sortedMatches = [...matches].sort((a, b) => {
    const dateA = new Date(a.addedAt || a.frozenAt || 0);
    const dateB = new Date(b.addedAt || b.frozenAt || 0);
    return dateB - dateA;
  });

  // ...but the point of surfacing a previous bag is to inherit its dial-in, and
  // the newest bag is often the one you haven't dialed yet. Prefer the most
  // recent bag that actually carries a recipe, and only fall back to plain
  // recency when none of them do.
  const withRecipe = sortedMatches.find(hasUsableRecipe);

  return { match: withRecipe || sortedMatches[0], isSameBatch: false };
}

// Same test the duplicate modal uses to decide whether there's anything to copy.
function hasUsableRecipe(coffee) {
  const r = primaryRecipe(coffee);
  return !!(r?.dose || r?.yield || r?.grind);
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
