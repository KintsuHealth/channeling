// Recipe helpers — a bean can hold multiple named recipes (e.g. "Flat White",
// "Straight Espresso"). Stored as the `recipes` JSONB array on a coffee.
// Backward-compatible with the legacy single `espresso` object: any coffee that
// predates this feature is read as a one-element list named "Espresso".

export const RECIPE_FIELDS = [
  "dose", "yield", "preInfuse", "brewTime", "totalTime", "time",
  "grind", "feedSpeed", "temp", "tempUnit", "notes",
];

// Fields that signify a recipe actually holds data worth keeping. `tempUnit`
// is excluded because it always carries a default ("C") and means nothing alone.
const DATA_FIELDS = RECIPE_FIELDS.filter((f) => f !== "tempUnit");

export function emptyRecipe() {
  return {
    name: "", dose: "", yield: "", preInfuse: "", brewTime: "",
    totalTime: "", grind: "", feedSpeed: "", temp: "", tempUnit: "C", notes: "",
  };
}

// True if the object carries any meaningful recipe data (covers legacy fields
// like `time` so migration never silently drops temp/notes/time-only recipes).
export function hasRecipeData(r) {
  return !!r && DATA_FIELDS.some((f) => r[f]);
}

// A recipe is "prominent enough to preview" once it has a ratio, time or grind.
export function recipeHasContent(r) {
  return !!(r && (r.dose || r.yield || r.totalTime || r.time || r.grind));
}

export function newRecipeId() {
  return "r" + Math.random().toString(36).slice(2, 10);
}

// Normalize any coffee into an array of recipes, migrating legacy `espresso`.
// Every returned recipe is guaranteed a stable id (synthetic, index-based when
// missing) so React keys and the editor's selected-recipe identity never collide.
export function getRecipes(coffee) {
  if (!coffee) return [];
  const arr = Array.isArray(coffee.recipes) ? coffee.recipes : [];
  const meaningful = arr.filter((r) => r && (r.name || hasRecipeData(r)));
  if (meaningful.length > 0) {
    return meaningful.map((r, i) => (r.id ? r : { ...r, id: `idx-${i}` }));
  }
  if (hasRecipeData(coffee.espresso)) {
    return [{ id: "legacy", name: "Espresso", ...coffee.espresso }];
  }
  return [];
}

// The bean's primary recipe — drives card previews, stats and grind prediction.
// With manual ordering, that's simply the first one.
export function primaryRecipe(coffee) {
  return getRecipes(coffee)[0] || null;
}
