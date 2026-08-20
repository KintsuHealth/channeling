/**
 * Equipment model — espresso machines and portafilter baskets.
 *
 * Grind numbers throughout the app are Weber EG-1 dial numbers (~0.1 steps).
 * Every prior/delta below is expressed in those units, relative to the
 * reference setup: Slayer Single Group + stock Slayer 18g basket. Recipes
 * saved before equipment tracking existed are assumed to be on that setup.
 *
 * Priors are only starting points — learnEquipmentDelta() replaces them with
 * what your own paired shots actually show, shrinking toward the prior when
 * the sample is thin.
 */

import { getRecipes } from "./recipes";

export const DEFAULT_MACHINE_ID = "slayer-single";
export const DEFAULT_BASKET_ID = "slayer-18";

export const MACHINES = [
  {
    id: "slayer-single",
    name: "Slayer Single Group",
    short: "Slayer",
    image: "/machines/slayer-single.png",
    // Needle-valve low-pressure pre-brew → even saturation lets you run finer.
    grindPrior: 0,
    dialInStyle: "slayer",
    profile: "Needle-valve manual flow: long low-pressure pre-brew, then full throttle.",
  },
  {
    id: "linea-mini",
    name: "La Marzocco Linea Mini",
    short: "Linea Mini",
    image: "/machines/linea-mini.png",
    // No real pre-infusion — grind a touch coarser than the Slayer to avoid choking.
    grindPrior: 0.15,
    dialInStyle: "lm-classic",
    profile: "Dual boiler, fixed 9-bar profile, ~1–2s ramp. No flow control.",
  },
  {
    id: "linea-micra",
    name: "La Marzocco Linea Micra",
    short: "Micra",
    image: "/machines/linea-micra.png",
    grindPrior: 0.15,
    dialInStyle: "lm-classic",
    profile: "Compact dual boiler, fixed 9-bar profile. Same recipe logic as the Mini.",
  },
  {
    id: "gs3",
    name: "La Marzocco GS3",
    short: "GS3",
    image: "/machines/gs3.png",
    // MP paddle gives line-pressure pre-infusion — closer to the Slayer.
    grindPrior: 0.05,
    dialInStyle: "gs3",
    profile: "Prosumer dual boiler; MP paddle allows line-pressure pre-infusion.",
  },
  {
    id: "breville-barista",
    name: "Breville Barista (Express/Pro)",
    short: "Breville",
    image: "/machines/breville-barista.png",
    grindPrior: 0.1,
    dialInStyle: "breville",
    profile: "54mm portafilter, thermocoil, programmed low-pressure pre-infusion.",
  },
];

export const BASKETS = [
  {
    id: "slayer-18",
    name: "Slayer Stock 18g",
    short: "Stock 18g",
    doseG: 18,
    // Reference basket.
    grindPrior: 0,
    note: "The stock basket every pre-upgrade dial-in was recorded on.",
  },
  {
    id: "weber-unifilter-20",
    name: "Weber Workshops Unifilter 20g",
    short: "Unifilter 20g",
    doseG: 20,
    // +2g dose adds puck resistance → start a touch coarser; the Unifilter's
    // high-uniformity geometry pulls part of that back. Net starting prior.
    grindPrior: 0.2,
    note: "Higher dose wants slightly coarser; precision geometry evens the flow.",
  },
];

export const machineById = (id) => MACHINES.find((m) => m.id === id) || MACHINES[0];
export const basketById = (id) => BASKETS.find((b) => b.id === id) || BASKETS[0];

// Equipment identity of a recipe. Legacy recipes predate tagging → reference setup.
export function recipeEquipment(recipe) {
  return {
    machineId: recipe?.machineId || DEFAULT_MACHINE_ID,
    basketId: recipe?.basketId || DEFAULT_BASKET_ID,
  };
}

const equipKey = (machineId, basketId) => `${machineId}::${basketId}`;

// Prior offset of a setup relative to the reference setup.
export function setupPrior(machineId, basketId) {
  return machineById(machineId).grindPrior + basketById(basketId).grindPrior;
}

/**
 * Learn the grind delta between two setups from your own shots.
 *
 * Strongest signal: the same coffee dialed on both setups (paired shots) —
 * delta = grind(to) − grind(from), averaged. With no pairs the prior stands.
 * The learned mean is shrunk toward the prior while the sample is thin:
 * weight n/(n+2), so 2 pairs ≈ half learned, 8 pairs ≈ 80% learned.
 *
 * @returns {{ delta: number, pairs: number, learned: boolean }}
 */
export function learnEquipmentDelta(allCoffees, from, to) {
  const fromKey = equipKey(from.machineId, from.basketId);
  const toKey = equipKey(to.machineId, to.basketId);
  const prior = setupPrior(to.machineId, to.basketId) - setupPrior(from.machineId, from.basketId);
  if (fromKey === toKey) return { delta: 0, pairs: 0, learned: false };

  const deltas = [];
  for (const c of allCoffees || []) {
    const recs = getRecipes(c).filter((r) => !isNaN(parseFloat(r.grind)));
    const fromGrinds = recs.filter((r) => {
      const e = recipeEquipment(r);
      return equipKey(e.machineId, e.basketId) === fromKey;
    }).map((r) => parseFloat(r.grind));
    const toGrinds = recs.filter((r) => {
      const e = recipeEquipment(r);
      return equipKey(e.machineId, e.basketId) === toKey;
    }).map((r) => parseFloat(r.grind));
    if (!fromGrinds.length || !toGrinds.length) continue;
    const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const d = avg(toGrinds) - avg(fromGrinds);
    if (Math.abs(d) <= 2) deltas.push(d); // ignore implausible pairs
  }

  if (deltas.length === 0) return { delta: prior, pairs: 0, learned: false };
  const mean = deltas.reduce((s, x) => s + x, 0) / deltas.length;
  const w = deltas.length / (deltas.length + 2);
  return {
    delta: Math.round((w * mean + (1 - w) * prior) * 20) / 20,
    pairs: deltas.length,
    learned: true,
  };
}

/**
 * Translate a recorded grind from the setup it was dialed on to the current
 * setup — e.g. an archived 18g-basket dial-in re-expressed for the Unifilter.
 * Returns null when there's nothing to translate (no grind, or same setup).
 */
export function translateGrind(recipe, currentSetup, allCoffees) {
  const grind = parseFloat(recipe?.grind);
  if (isNaN(grind) || !currentSetup) return null;
  const from = recipeEquipment(recipe);
  if (equipKey(from.machineId, from.basketId) === equipKey(currentSetup.machineId, currentSetup.basketId)) {
    return null;
  }
  const { delta, pairs, learned } = learnEquipmentDelta(allCoffees, from, currentSetup);
  if (delta === 0 && !learned) return null;
  return {
    grind: Math.round((grind + delta) * 10) / 10,
    delta,
    pairs,
    learned,
    fromBasket: basketById(from.basketId).short,
    fromMachine: machineById(from.machineId).short,
  };
}

// Human-readable delta in EG-1 dial language ("≈0.2 coarser").
export function formatDelta(delta) {
  if (!delta || Math.abs(delta) < 0.05) return "about the same";
  const dir = delta > 0 ? "coarser" : "finer";
  return `≈${Math.abs(delta).toFixed(1)} ${dir}`;
}
