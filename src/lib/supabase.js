import { createBrowserClient } from '@supabase/ssr';

let supabaseInstance = null;

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured');
    return null;
  }

  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

// Field mapping between camelCase (frontend) and snake_case (database)
export const fieldMap = {
  toDb: {
    roastLevel: 'roast_level',
    altitudeCategory: 'altitude_category',
    tastingNotes: 'tasting_notes',
    roastDate: 'roast_date',
    bagColor: 'bag_color',
    textColor: 'text_color',
    labelImage: 'label_image_url',
    labelCutout: 'label_cutout_url',
    gramsTotal: 'grams_total',
    portionIndex: 'portion_index',
    dosesUsed: 'doses_used',
    doseG: 'dose_g',
    addedAt: 'added_at',
    frozenAt: 'frozen_at',
    pulledAt: 'pulled_at',
    finishedAt: 'finished_at',
    grindOffsetPrediction: 'grind_offset_prediction',
    grindOffsetRationale: 'grind_offset_rationale',
    grindConfidence: 'grind_confidence',
    userId: 'user_id',
    baselineGrind: 'baseline_grind',
    updatedAt: 'updated_at',
    targetRestDays: 'target_rest_days',
    daysRested: 'days_rested',
    dialInNotes: 'dial_in_notes',
    machineId: 'machine_id',
    basketId: 'basket_id',
  },
  fromDb: {
    roast_level: 'roastLevel',
    altitude_category: 'altitudeCategory',
    tasting_notes: 'tastingNotes',
    roast_date: 'roastDate',
    bag_color: 'bagColor',
    text_color: 'textColor',
    label_image_url: 'labelImage',
    label_cutout_url: 'labelCutout',
    grams_total: 'gramsTotal',
    portion_index: 'portionIndex',
    doses_used: 'dosesUsed',
    dose_g: 'doseG',
    added_at: 'addedAt',
    frozen_at: 'frozenAt',
    pulled_at: 'pulledAt',
    finished_at: 'finishedAt',
    grind_offset_prediction: 'grindOffsetPrediction',
    grind_offset_rationale: 'grindOffsetRationale',
    grind_confidence: 'grindConfidence',
    user_id: 'userId',
    baseline_grind: 'baselineGrind',
    updated_at: 'updatedAt',
    target_rest_days: 'targetRestDays',
    days_rested: 'daysRested',
    dial_in_notes: 'dialInNotes',
    machine_id: 'machineId',
    basket_id: 'basketId',
  }
};

// Valid database columns for coffees table
const validCoffeeColumns = new Set([
  'id', 'user_id', 'name', 'country', 'region', 'variety', 'producer', 'roaster',
  'roast_level', 'process', 'altitude', 'altitude_category', 'weight', 'price',
  'tasting_notes', 'roast_date', 'bag_color', 'text_color', 'label_image_url', 'label_cutout_url',
  'status', 'grams_total', 'portions', 'portion_index', 'doses_used', 'dose_g',
  'added_at', 'frozen_at', 'pulled_at', 'finished_at',
  'espresso', 'recipes', 'favorite', 'rating', 'grind_offset_prediction', 'grind_offset_rationale',
  'grind_confidence', 'target_rest_days', 'days_rested', 'dial_in_notes'
]);

// Valid database columns for user_settings table. `machine_id` / `basket_id`
// require the equipment migration in supabase-schema.sql; useSettings falls
// back to localStorage until it has run.
const validSettingsColumns = new Set([
  'user_id', 'dose_g', 'baseline_grind', 'machine_id', 'basket_id', 'updated_at',
]);

export function toDbFormat(obj, filterUnknown = true, columns = validCoffeeColumns) {
  if (!obj) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const dbKey = fieldMap.toDb[key] || key;
    // Skip unknown columns to prevent insert errors
    if (filterUnknown && !columns.has(dbKey)) {
      continue;
    }
    // Convert empty strings to null (PostgreSQL doesn't like empty strings for typed columns)
    if (value === '') {
      result[dbKey] = null;
    } else {
      result[dbKey] = value;
    }
  }
  return result;
}

// user_settings writes were previously filtered against the COFFEE column set,
// which silently dropped baseline_grind — settings must use their own set.
export function settingsToDbFormat(obj) {
  return toDbFormat(obj, true, validSettingsColumns);
}

export function fromDbFormat(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const jsKey = fieldMap.fromDb[key] || key;
    result[jsKey] = value;
  }
  return result;
}
