import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "./supabase";
import { useAuth } from "./useAuth";
import { uploadImageToBucket, storagePathFromPublicUrl } from "./image";

// Personal latte-art pour feed. Standalone table (latte_art), per-user RLS —
// mirrors the useCoffees CRUD shape. Pours are chronological and bean-independent.

const BUCKET = "label-images";

function fromDb(row) {
  return {
    id: row.id,
    photoUrl: row.photo_url,
    rating: row.rating || 0,
    note: row.note || "",
    beanName: row.bean_name || "",
    coffeeId: row.coffee_id || null,
    createdAt: row.created_at,
  };
}

export function useLatteArt() {
  const { user } = useAuth();
  const [pours, setPours] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setPours([]); setLoading(false); return; }
    let cancelled = false;
    // Reset so a previous user's pours never linger across an account switch.
    setPours([]);
    setLoading(true);
    (async () => {
      const supabase = getSupabase();
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("latte_art")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) console.error("useLatteArt fetch:", error);
      else setPours((data || []).map(fromDb));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Upload the photo, then insert the row. If the insert fails, remove the
  // just-uploaded object so we don't leave an orphan in storage.
  const createPour = useCallback(async ({ base64, rating, note, beanName, coffeeId }) => {
    if (!user || !base64) return null;
    const supabase = getSupabase();
    if (!supabase) return null;

    let uploaded;
    try {
      uploaded = await uploadImageToBucket(supabase, user.id, base64, { bucket: BUCKET, folder: "latte" });
    } catch (err) {
      console.error("createPour upload:", err);
      return null;
    }
    if (!uploaded?.url) return null;

    const row = {
      user_id: user.id,
      photo_url: uploaded.url,
      rating: rating || 0,
      note: note || null,
      bean_name: beanName || null,
      coffee_id: coffeeId || null,
    };
    const { data, error } = await supabase.from("latte_art").insert(row).select().single();
    if (error) {
      console.error("createPour insert:", error);
      if (uploaded.path) await supabase.storage.from(BUCKET).remove([uploaded.path]).catch(() => {});
      return null;
    }
    const pour = fromDb(data);
    setPours((prev) => [pour, ...prev]);
    return pour;
  }, [user]);

  // Delete the row, then best-effort remove its storage object.
  const deletePour = useCallback(async (pour) => {
    if (!user || !pour) return false;
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from("latte_art").delete().eq("id", pour.id).eq("user_id", user.id);
    if (error) { console.error("deletePour:", error); return false; }
    setPours((prev) => prev.filter((p) => p.id !== pour.id));
    const path = storagePathFromPublicUrl(pour.photoUrl, BUCKET);
    if (path) await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    return true;
  }, [user]);

  return { pours, loading, createPour, deletePour };
}
