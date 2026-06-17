import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// AI dial-in assistant: researches the specific coffee (farm / variety / producer)
// with live web search, then returns saveable Espresso + Flat White recipes tuned
// for a Slayer single-group (needle-valve pre-infusion). One-shot, no chat.

// Verify the caller is a signed-in Supabase user — this endpoint is expensive
// (Opus + web search), so it must not be open to anonymous traffic.
async function getUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const supabase = createClient(url, anon);
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

// Pull the last fenced ```json block (falls back to a balanced-brace scan).
// Web-search responses contain many text/citation blocks, so a greedy match is unsafe.
function extractJson(text) {
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (let i = fences.length - 1; i >= 0; i--) {
    try { return JSON.parse(fences[i][1].trim()); } catch { /* keep looking */ }
  }
  // Fallback: from each "{" (last first), walk a brace-depth counter to its
  // matching "}" and try to parse that balanced slice.
  const starts = [];
  for (let i = 0; i < text.length; i++) if (text[i] === "{") starts.push(i);
  for (let s = starts.length - 1; s >= 0; s--) {
    let depth = 0;
    for (let i = starts[s]; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}" && --depth === 0) {
        try { return JSON.parse(text.slice(starts[s], i + 1)); } catch { /* keep looking */ }
        break;
      }
    }
  }
  return null;
}

// Best-effort per-user throttle. In-memory, so it only bounds a single warm
// serverless instance — a speed-bump against runaway cost, not a hard guarantee
// (durable limiting would need a shared store).
const RATE = new Map();
function rateLimited(userId) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const max = 12;
  const arr = (RATE.get(userId) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { RATE.set(userId, arr); return true; }
  arr.push(now);
  RATE.set(userId, arr);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  if (rateLimited(user.id)) return res.status(429).json({ error: "Too many dial-ins — give it a few minutes." });

  const c = req.body || {};
  const baselineGrind = c.baselineGrind;
  const priorGrinds = Array.isArray(c.priorGrinds) ? c.priorGrinds.filter(Boolean) : [];

  const facts = [
    ["Name", c.name],
    ["Roaster", c.roaster],
    ["Country", c.country],
    ["Region", c.region],
    ["Variety", c.variety],
    ["Producer / farm", c.producer],
    ["Process", c.process],
    ["Roast level", c.roastLevel],
    ["Altitude", c.altitude || c.altitudeCategory],
    ["Roast date", c.roastDate],
    ["Tasting notes", c.tastingNotes],
    ["Bag weight", c.weight],
  ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");

  const dose = c.doseG || 18;
  const baselineLine = baselineGrind != null
    ? `The user's baseline grind setting (medium roast reference) is ${baselineGrind}. Give the "grind" and "startingGrind" as ABSOLUTE settings on that same scale (a Geisha/dense light roast usually goes finer than baseline; a soluble extended-ferment lot a touch coarser).`
    : `The user has not set a baseline grind. Express "grind" and "startingGrind" qualitatively (e.g. "fine", "finer than medium", "medium-fine").`;
  const priorLine = priorGrinds.length
    ? `Grind settings the user previously dialed for this or similar coffees: ${priorGrinds.join(", ")}. Lean on these.`
    : "";

  const prompt = `You are a specialty-coffee expert dialing espresso for a SLAYER single-group machine with a needle valve (manual flow / pressure profiling). Slayer technique: a long, gentle low-pressure PRE-BREW (needle valve barely open) to saturate the puck, then open to FULL THROTTLE for the main extraction. Recipes must give explicit pre-brew and full-throttle phase timings and a feed speed.

Research THIS specific coffee using web search — the farm/estate, the producer, the variety's character, and the roaster if identifiable. Use that provenance to inform the recipes. Cite real sources.

Coffee:
${facts || "(minimal label data — infer sensibly from what is given)"}

Dose to target: ${dose}g.
${baselineLine}
${priorLine}

Produce TWO recipes for a ${dose}g dose:
- "Espresso" (black): play to the bean's strengths. Delicate washed/floral coffees want a LONGER, hotter, gentler pull (stretch the ratio, longer pre-brew) for aromatic clarity; sweeter/heavier/extended-ferment coffees want a more standard, slightly cooler pull for structure.
- "Flat White" (in milk): CONCENTRATE so it reads through dairy — shorter ratio / ristretto-leaning, especially for delicate beans whose top notes milk would erase.
The more delicate and aromatic the coffee, the bigger the gap between the two recipes.

Then write a short "insight" (3–5 sentences): the provenance you found and the one-line dialing rationale ("extend for black, concentrate for milk"), plus a quick correction cheat-sheet (sour/fast → finer + hotter + longer pre-brew; harsh/slow → coarser + cooler).

End your reply with EXACTLY ONE fenced \`\`\`json code block, no prose after it, matching this shape (strings only; omit a field with "" if unknown; tempUnit "C"):
\`\`\`json
{
  "insight": "...",
  "sources": [{"title": "...", "url": "..."}],
  "startingGrind": "absolute grind for the espresso recipe",
  "espresso":  {"name": "Espresso",  "dose": "${dose}", "yield": "", "preInfuse": "", "brewTime": "", "totalTime": "", "grind": "", "feedSpeed": "slow|medium|fast|auto", "temp": "", "tempUnit": "C", "notes": ""},
  "flatWhite": {"name": "Flat White", "dose": "${dose}", "yield": "", "preInfuse": "", "brewTime": "", "totalTime": "", "grind": "", "feedSpeed": "slow|medium|fast|auto", "temp": "", "tempUnit": "C", "notes": ""}
}
\`\`\``;

  try {
    let messages = [{ role: "user", content: prompt }];
    let response;
    // Server-tool loop: continue while the model pauses mid-search.
    for (let i = 0; i < 4; i++) {
      response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 3500,
        messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      });
      if (response.stop_reason !== "pause_turn") break;
      messages = [...messages, { role: "assistant", content: response.content }];
    }

    // Still paused after the loop → research didn't finish; let the client retry.
    if (response.stop_reason === "pause_turn") {
      return res.status(504).json({ error: "Dial-in timed out while researching. Please try again." });
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = extractJson(text);
    if (!parsed || (!parsed.espresso && !parsed.flatWhite)) {
      console.error("Dial-in parse failure. Raw:", text.slice(0, 500));
      return res.status(502).json({ error: "Could not read the dial-in result. Please try again." });
    }
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Dial-in error:", err);
    return res.status(500).json({ error: "Dial-in failed. Please try again." });
  }
}
