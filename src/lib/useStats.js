import { useMemo } from "react";
import { DEFAULT_DOSE_G } from "./portions";

export function useStats(coffees) {
  return useMemo(() => {
    const frozen = coffees.filter((c) => c.status === "frozen");
    const active = coffees.find((c) => c.status === "active");
    const archive = coffees.filter((c) => c.status === "done");
    const all = coffees;

    // ─── Freezer Stats ───
    const freezerGrams = frozen.reduce(
      (sum, c) => sum + c.portions.slice(c.portionIndex).reduce((s, p) => s + p.grams, 0),
      0
    );
    const freezerPortions = frozen.reduce(
      (sum, c) => sum + (c.portions.length - c.portionIndex),
      0
    );
    const freezerDoses = frozen.reduce(
      (sum, c) => sum + c.portions.slice(c.portionIndex).reduce((s, p) => s + p.doses, 0),
      0
    );

    // ─── Consumption Stats (All Time) ───
    const totalConsumed = archive.reduce((sum, c) => sum + (c.gramsTotal || 0), 0);
    const totalFinished = archive.length;
    const totalDoses = archive.reduce(
      (sum, c) => sum + c.portions.reduce((s, p) => s + p.doses, 0),
      0
    );

    // Average rating of finished coffees
    const ratedArchive = archive.filter((c) => c.rating > 0);
    const avgRating =
      ratedArchive.length > 0
        ? ratedArchive.reduce((sum, c) => sum + c.rating, 0) / ratedArchive.length
        : 0;

    // ─── Estimated Days Left ───
    // Calculate average daily consumption based on archive
    let estimatedDaysLeft = null;
    if (archive.length > 0 && freezerGrams > 0) {
      const oldestFinished = archive.reduce((oldest, c) => {
        const date = c.finishedAt || c.addedAt;
        return !oldest || new Date(date) < new Date(oldest) ? date : oldest;
      }, null);
      if (oldestFinished) {
        const daysSinceFirst = Math.max(1, Math.floor((Date.now() - new Date(oldestFinished).getTime()) / 86400000));
        const avgDailyConsumption = totalConsumed / daysSinceFirst;
        if (avgDailyConsumption > 0) {
          estimatedDaysLeft = Math.round(freezerGrams / avgDailyConsumption);
        }
      }
    }

    // ─── Favorites & Top Rated ───
    const allRated = all.filter((c) => c.rating > 0).sort((a, b) => b.rating - a.rating);
    const topRated = allRated.slice(0, 3);

    // Top roasters by frequency
    const roasterCounts = {};
    all.forEach((c) => {
      if (c.roaster) {
        roasterCounts[c.roaster] = (roasterCounts[c.roaster] || 0) + 1;
      }
    });
    const topRoasters = Object.entries(roasterCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    // Top countries by frequency
    const countryCounts = {};
    all.forEach((c) => {
      if (c.country) {
        countryCounts[c.country] = (countryCounts[c.country] || 0) + 1;
      }
    });
    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    // ─── Origin Breakdown (by country) ───
    const totalBags = all.length;
    const byCountry = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        percent: totalBags > 0 ? Math.round((count / totalBags) * 100) : 0,
      }));

    // Calculate "Other" for countries
    const topCountryCount = byCountry.reduce((s, c) => s + c.count, 0);
    const otherCountryCount = totalBags - topCountryCount;
    if (otherCountryCount > 0) {
      byCountry.push({
        name: "Other",
        count: otherCountryCount,
        percent: Math.round((otherCountryCount / totalBags) * 100),
      });
    }

    // ─── Variety Breakdown ───
    const varietyCounts = {};
    all.forEach((c) => {
      if (c.variety) {
        // Split by comma or / for multiple varieties
        const varieties = c.variety.split(/[,\/]/).map((v) => v.trim()).filter(Boolean);
        varieties.forEach((v) => {
          varietyCounts[v] = (varietyCounts[v] || 0) + 1;
        });
      }
    });
    const byVariety = Object.entries(varietyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({
        name,
        count,
        percent: totalBags > 0 ? Math.round((count / totalBags) * 100) : 0,
      }));

    // Calculate "Other" for varieties
    const countedVarieties = byVariety.map((v) => v.name);
    const otherVarietyCount = all.filter(
      (c) => c.variety && !countedVarieties.some((v) => c.variety.includes(v))
    ).length;
    const topVarietyPercent = byVariety.reduce((s, v) => s + v.percent, 0);
    if (topVarietyPercent < 100 && totalBags > 0) {
      byVariety.push({
        name: "Other",
        count: otherVarietyCount,
        percent: 100 - topVarietyPercent,
      });
    }

    // ─── Recent Activity ───
    const recentlyAdded = [...all]
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
      .slice(0, 5);

    const lastFinished = archive.length > 0
      ? [...archive].sort((a, b) => new Date(b.finishedAt || b.addedAt) - new Date(a.finishedAt || a.addedAt))[0]
      : null;

    // ─── Active Coffee Stats ───
    let activeCoffee = null;
    if (active) {
      const currentPortion = active.portions[active.portionIndex];
      const dosesLeft = currentPortion ? currentPortion.doses - active.dosesUsed : 0;
      const gramsLeft = dosesLeft * (active.doseG || DEFAULT_DOSE_G) + (dosesLeft > 0 && currentPortion ? currentPortion.buffer : 0);
      const daysSincePulled = active.pulledAt
        ? Math.floor((Date.now() - new Date(active.pulledAt).getTime()) / 86400000)
        : 0;
      const remainingPortions = active.portions.length - active.portionIndex - 1;

      activeCoffee = {
        ...active,
        currentPortion,
        dosesLeft,
        gramsLeft,
        daysSincePulled,
        remainingPortions,
        isStale: daysSincePulled > 7,
      };
    }

    return {
      // Active
      activeCoffee,

      // Freezer
      freezerGrams,
      freezerPortions,
      freezerDoses,
      estimatedDaysLeft,

      // Consumption (All Time)
      totalConsumed,
      totalFinished,
      totalDoses,
      avgRating,

      // Favorites
      topRated,
      topRoasters,
      topCountries,

      // Breakdowns
      byCountry,
      byVariety,

      // Recent
      recentlyAdded,
      lastFinished,
    };
  }, [coffees]);
}
