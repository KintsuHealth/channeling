// Recipe helpers — a bean can hold multiple named recipes (e.g. "Flat White",
// "Straight Espresso", "Origami Pour-Over"). Stored as the `recipes` JSONB
// array on a coffee. Backward-compatible with the legacy single `espresso`
// object: any coffee that predates this feature is read as a one-element list
// named "Espresso".
//
// A recipe's `method` is "espresso" (default, covers legacy) or "pourover".
// Pour-over recipes use `brewer` (origami/v60/kalita/chemex/other) plus
// waterG / bloomG / bloomTime / pours instead of yield / preInfuse.
// `machineId` / `basketId` record the equipment an espresso was dialed on —
// see lib/equipment.js. Untagged recipes are assumed to be the reference
// setup (Slayer + stock 18g basket).

export const RECIPE_FIELDS = [
  "dose", "yield", "preInfuse", "brewTime", "totalTime", "time",
  "grind", "feedSpeed", "temp", "tempUnit", "notes",
  "waterG", "bloomG", "bloomTime", "pours",
];

export const POUROVER_BREWERS = [
  { id: "origami", name: "Origami Dripper" },
  { id: "v60", name: "Hario V60" },
  { id: "kalita", name: "Kalita Wave" },
  { id: "chemex", name: "Chemex" },
  { id: "other", name: "Other" },
];

// Fields that signify a recipe actually holds data worth keeping. `tempUnit`,
// `method`, `brewer` and equipment tags are excluded — they carry defaults and
// mean nothing alone.
const DATA_FIELDS = RECIPE_FIELDS.filter((f) => f !== "tempUnit");

export function emptyRecipe(method = "espresso") {
  return {
    name: "", method, brewer: method === "pourover" ? "origami" : "",
    dose: "", yield: "", waterG: "", bloomG: "", bloomTime: "", pours: "",
    preInfuse: "", brewTime: "", totalTime: "", grind: "", feedSpeed: "",
    temp: "", tempUnit: "C", notes: "", machineId: "", basketId: "",
  };
}

export function recipeMethod(r) {
  return r?.method === "pourover" ? "pourover" : "espresso";
}

// True if the object carries any meaningful recipe data (covers legacy fields
// like `time` so migration never silently drops temp/notes/time-only recipes).
export function hasRecipeData(r) {
  return !!r && DATA_FIELDS.some((f) => r[f]);
}

// A recipe is "prominent enough to preview" once it has a ratio, time or grind.
export function recipeHasContent(r) {
  return !!(r && (r.dose || r.yield || r.waterG || r.totalTime || r.time || r.grind));
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

// The primary ESPRESSO recipe — grind prediction and calibration learn only
// from espresso grinds (pour-over numbers live on a different part of the dial).
export function primaryEspressoRecipe(coffee) {
  return getRecipes(coffee).find((r) => recipeMethod(r) === "espresso") || null;
}
