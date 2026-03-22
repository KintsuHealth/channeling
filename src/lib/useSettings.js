import { useState, useEffect, useCallback } from 'react';
import { getSupabase, fromDbFormat, toDbFormat } from './supabase';
import { useAuth } from './useAuth';

export function useSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ baselineGrind: null, doseG: 18 });
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
          // Ensure numeric fields are numbers
          if (formatted.baselineGrind !== null && formatted.baselineGrind !== undefined) {
            formatted.baselineGrind = parseFloat(formatted.baselineGrind);
            setBaselineInput(String(formatted.baselineGrind));
          }
          if (formatted.doseG !== null && formatted.doseG !== undefined) {
            formatted.doseG = parseFloat(formatted.doseG);
          }
          setSettings(formatted);
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
    if (!user) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const dbUpdates = toDbFormat({
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    try {
      const { error: updateError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...dbUpdates,
        });

      if (updateError) throw updateError;

      setSettings(prev => ({ ...prev, ...updates }));
    } catch (err) {
      setError(err.message);
    }
  }, [user]);

  const setBaselineGrind = useCallback((value) => {
    // Always update the raw input for smooth typing
    setBaselineInput(value);

    // Only save to database if it's a valid complete number
    if (value === '' || value === null) {
      updateSettings({ baselineGrind: null });
      setSettings(prev => ({ ...prev, baselineGrind: null }));
    } else {
      const numValue = parseFloat(value);
      // Only save if valid and not ending with decimal point (still typing)
      if (!isNaN(numValue) && !value.endsWith('.')) {
        updateSettings({ baselineGrind: numValue });
        setSettings(prev => ({ ...prev, baselineGrind: numValue }));
      }
    }
  }, [updateSettings]);

  const setDoseG = useCallback((value) => {
    const numValue = value ? Number(value) : 18;
    updateSettings({ doseG: numValue });
  }, [updateSettings]);

  return {
    baselineGrind: settings.baselineGrind, // Numeric value for calculations
    baselineGrindInput: baselineInput, // String value for input display
    setBaselineGrind,
    doseG: settings.doseG || 18,
    setDoseG,
    loading,
    error,
  };
}
