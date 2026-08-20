import { useState, useEffect, useCallback } from 'react';
import { getSupabase, fromDbFormat, settingsToDbFormat } from './supabase';
import { useAuth } from './useAuth';
import { DEFAULT_MACHINE_ID, DEFAULT_BASKET_ID, basketById } from './equipment';

// Equipment prefs also mirror to localStorage so they survive until the
// machine_id/basket_id column migration has been run in Supabase (and as a fast
// first paint). DB wins once a row comes back with values.
const EQUIP_LS_KEY = 'expertso-equipment';

function readLocalEquipment() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(EQUIP_LS_KEY)) || {};
  } catch {
    return {};
  }
}

function writeLocalEquipment(patch) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EQUIP_LS_KEY, JSON.stringify({ ...readLocalEquipment(), ...patch }));
  } catch { /* private mode etc. */ }
}

// Postgres "column does not exist" surfaces from PostgREST as PGRST204 or 42703.
const isMissingColumnError = (err) =>
  err && (err.code === 'PGRST204' || err.code === '42703' || /column/i.test(err.message || ''));

export function useSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(() => ({
    baselineGrind: null,
    doseG: 18,
    machineId: readLocalEquipment().machineId || DEFAULT_MACHINE_ID,
    basketId: readLocalEquipment().basketId || DEFAULT_BASKET_ID,
  }));
  const [baselineInput, setBaselineInput] = useState(''); // Raw input string for typing
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        if (data) {
          const formatted = fromDbFormat(data);
          if (formatted.baselineGrind !== null && formatted.baselineGrind !== undefined) {
            formatted.baselineGrind = parseFloat(formatted.baselineGrind);
            setBaselineInput(String(formatted.baselineGrind));
          }
          if (formatted.doseG !== null && formatted.doseG !== undefined) {
            formatted.doseG = parseFloat(formatted.doseG);
          }
          setSettings(prev => ({
            ...prev,
            ...formatted,
            machineId: formatted.machineId || prev.machineId || DEFAULT_MACHINE_ID,
            basketId: formatted.basketId || prev.basketId || DEFAULT_BASKET_ID,
          }));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  const updateSettings = useCallback(async (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
    if (updates.machineId || updates.basketId) {
      writeLocalEquipment({
        ...(updates.machineId ? { machineId: updates.machineId } : {}),
        ...(updates.basketId ? { basketId: updates.basketId } : {}),
      });
    }

    if (!user) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const dbUpdates = settingsToDbFormat({
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    try {
      const { error: updateError } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, ...dbUpdates });

      if (updateError) {
        // Equipment columns may not exist yet — retry without them; the
        // localStorage mirror keeps the preference either way.
        if (isMissingColumnError(updateError) && (dbUpdates.machine_id || dbUpdates.basket_id)) {
          const { machine_id, basket_id, ...rest } = dbUpdates;
          if (Object.keys(rest).length > 1) {
            const { error: retryError } = await supabase
              .from('user_settings')
              .upsert({ user_id: user.id, ...rest });
            if (retryError) throw retryError;
          }
          return;
        }
        throw updateError;
      }
    } catch (err) {
      setError(err.message);
    }
  }, [user]);

  const setBaselineGrind = useCallback((value) => {
    // Always update the raw input for smooth typing
    setBaselineInput(value);

    if (value === '' || value === null) {
      updateSettings({ baselineGrind: null });
    } else {
      const numValue = parseFloat(value);
      // Only save if valid and not ending with decimal point (still typing)
      if (!isNaN(numValue) && !value.endsWith('.')) {
        updateSettings({ baselineGrind: numValue });
      }
    }
  }, [updateSettings]);

  const setDoseG = useCallback((value) => {
    const numValue = value ? Number(value) : 18;
    updateSettings({ doseG: numValue });
  }, [updateSettings]);

  const setMachineId = useCallback((machineId) => {
    updateSettings({ machineId });
  }, [updateSettings]);

  const setBasketId = useCallback((basketId) => {
    // Switching baskets also nudges the default dose to the basket's capacity.
    updateSettings({ basketId, doseG: basketById(basketId).doseG });
  }, [updateSettings]);

  return {
    baselineGrind: settings.baselineGrind, // Numeric value for calculations
    baselineGrindInput: baselineInput, // String value for input display
    setBaselineGrind,
    doseG: settings.doseG || 18,
    setDoseG,
    machineId: settings.machineId || DEFAULT_MACHINE_ID,
    setMachineId,
    basketId: settings.basketId || DEFAULT_BASKET_ID,
    setBasketId,
    loading,
    error,
  };
}
