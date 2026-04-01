import { useState, useEffect, useCallback } from 'react';
import { getSupabase, fromDbFormat, toDbFormat } from './supabase';
import { useAuth } from './useAuth';
import { calculateDegasDays } from './degasPredictor';

export function useCoffees() {
  const { user } = useAuth();
  const [coffees, setCoffees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setCoffees([]);
      setLoading(false);
      return;
    }

    const fetchCoffees = async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('coffees')
          .select('*')
          .eq('user_id', user.id)
          .order('added_at', { ascending: false });

        if (fetchError) throw fetchError;

        setCoffees((data || []).map(fromDbFormat));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCoffees();
  }, [user]);

  const addCoffee = useCallback(async (coffeeData) => {
    if (!user) return null;

    const supabase = getSupabase();
    if (!supabase) return null;

    const now = new Date().toISOString();
    const status = coffeeData.status || 'frozen';
    const newCoffee = {
      ...coffeeData,
      userId: user.id,
      addedAt: now,
      // Only set frozenAt if going straight to freezer
      frozenAt: status === 'frozen' ? now : null,
      status,
    };

    const dbCoffee = toDbFormat(newCoffee);
    delete dbCoffee.id;

    try {
      console.log("Inserting coffee:", JSON.stringify(dbCoffee, null, 2));
      const { data, error: insertError } = await supabase
        .from('coffees')
        .insert(dbCoffee)
        .select()
        .single();

      if (insertError) {
        console.error("Supabase insert error:", JSON.stringify(insertError, null, 2));
        console.error("Attempted to insert:", JSON.stringify(dbCoffee, null, 2));
        throw insertError;
      }

      console.log("Insert successful:", data);
      const insertedCoffee = fromDbFormat(data);
      setCoffees(prev => [insertedCoffee, ...prev]);
      return insertedCoffee;
    } catch (err) {
      console.error("Coffee insert failed:", err);
      setError(err.message);
      return null;
    }
  }, [user]);

  const updateCoffee = useCallback(async (id, updates) => {
    if (!user) {
      console.error("updateCoffee: No user");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      console.error("updateCoffee: No supabase");
      return;
    }

    const dbUpdates = toDbFormat(updates);
    console.log("updateCoffee:", id, "updates:", updates, "dbUpdates:", dbUpdates);

    try {
      const { error: updateError } = await supabase
        .from('coffees')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateError) {
        console.error("updateCoffee: Error:", updateError);
        throw updateError;
      }

      console.log("updateCoffee: Success, updating local state");
      setCoffees(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    } catch (err) {
      console.error("updateCoffee: Exception:", err);
      setError(err.message);
    }
  }, [user]);

  const moveToFreezer = useCallback(async (id) => {
    if (!user) {
      console.error("moveToFreezer: No user");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      console.error("moveToFreezer: No supabase");
      return;
    }

    try {
      // Fetch fresh data to avoid stale closure
      const { data: freshCoffee, error: fetchError } = await supabase
        .from('coffees')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error("moveToFreezer: Fetch error:", fetchError);
        setError("Could not find the coffee to move: " + fetchError.message);
        return;
      }

      if (!freshCoffee) {
        console.error("moveToFreezer: No coffee found for id:", id);
        setError("Could not find the coffee to move");
        return;
      }

      const coffee = fromDbFormat(freshCoffee);
      const now = new Date();
      // Use roastDate if available, otherwise fall back to addedAt
      const referenceDate = coffee.roastDate
        ? new Date(coffee.roastDate)
        : new Date(coffee.addedAt);
      const daysRested = Math.floor((now - referenceDate) / 86400000);

      const dbUpdates = {
        status: 'frozen',
        frozen_at: now.toISOString(),
        days_rested: daysRested,
      };

      console.log("moveToFreezer: Updating coffee", id, "with:", dbUpdates);

      const { data: updatedData, error: updateError } = await supabase
        .from('coffees')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error("moveToFreezer: Update error:", updateError);
        setError("Failed to move to freezer: " + updateError.message);
        return;
      }

      if (!updatedData) {
        console.error("moveToFreezer: No data returned from update");
        setError("Failed to move to freezer: update returned no data");
        return;
      }

      console.log("moveToFreezer: Success! Updated data:", updatedData);

      // Update local state with the confirmed data from database
      const updatedCoffee = fromDbFormat(updatedData);
      setCoffees(prev => prev.map(c => c.id === id ? updatedCoffee : c));
    } catch (err) {
      console.error("moveToFreezer: Exception:", err);
      setError(err.message);
    }
  }, [user]);

  const archiveCoffee = useCallback(async (id) => {
    await updateCoffee(id, {
      status: 'done',
      finishedAt: new Date().toISOString()
    });
  }, [updateCoffee]);

  const deleteCoffee = useCallback(async (id) => {
    if (!user) return;

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error: deleteError } = await supabase
        .from('coffees')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setCoffees(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }, [user]);

  const uploadLabelImage = useCallback(async (base64Data) => {
    if (!user) return null;

    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      // Convert base64 to blob
      const response = await fetch(base64Data);
      const blob = await response.blob();
      const fileName = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('label-images')
        .upload(fileName, blob);

      if (uploadError) {
        console.error("Image upload error:", JSON.stringify(uploadError, null, 2));
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('label-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [user]);

  const importCoffees = useCallback(async (localCoffees) => {
    if (!user || !localCoffees?.length) return { imported: 0, errors: [] };

    const errors = [];
    let imported = 0;

    for (const coffee of localCoffees) {
      try {
        let labelImage = coffee.labelImage || null;

        // Upload base64 image to storage if present
        if (labelImage && labelImage.startsWith('data:')) {
          const uploadedUrl = await uploadLabelImage(labelImage);
          if (uploadedUrl) {
            labelImage = uploadedUrl;
          }
        }

        const coffeeData = { ...coffee, labelImage };
        delete coffeeData.id;

        await addCoffee(coffeeData);
        imported++;
      } catch (err) {
        errors.push({ coffee: coffee.name, error: err.message });
      }
    }

    return { imported, errors };
  }, [user, addCoffee, uploadLabelImage]);

  // Migration: Update resting coffees without targetRestDays
  const migrateRestingCoffees = useCallback(async () => {
    if (!user) return { updated: 0, errors: [] };

    const supabase = getSupabase();
    if (!supabase) return { updated: 0, errors: [] };

    const errors = [];
    let updated = 0;

    // Find resting coffees without targetRestDays
    const restingWithoutTarget = coffees.filter(
      c => c.status === 'resting' && !c.targetRestDays
    );

    for (const coffee of restingWithoutTarget) {
      try {
        const prediction = calculateDegasDays(coffee);
        const dbUpdates = { target_rest_days: prediction.days };

        const { error: updateError } = await supabase
          .from('coffees')
          .update(dbUpdates)
          .eq('id', coffee.id)
          .eq('user_id', user.id);

        if (updateError) {
          errors.push({ coffee: coffee.name, error: updateError.message });
          continue;
        }

        // Update local state
        setCoffees(prev => prev.map(c =>
          c.id === coffee.id ? { ...c, targetRestDays: prediction.days } : c
        ));
        updated++;
      } catch (err) {
        errors.push({ coffee: coffee.name, error: err.message });
      }
    }

    return { updated, total: restingWithoutTarget.length, errors };
  }, [user, coffees]);

  return {
    coffees,
    setCoffees,
    loading,
    error,
    addCoffee,
    updateCoffee,
    moveToFreezer,
    archiveCoffee,
    deleteCoffee,
    uploadLabelImage,
    importCoffees,
    migrateRestingCoffees,
  };
}
