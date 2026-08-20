import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// AI dial-in assistant: from the bean's VARIETY + PROCESS, returns concise
// guidance for Espresso vs Flat White — grind direction (coarser/finer) and brew
// ratio — not absolute settings. No roaster/provenance, no web search. One-shot.

// Verify the caller is a signed-in Supabase user — keep the LLM endpoint off
// anonymous traffic.
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

  // Variety + process drive the call; origin/roast give context. No roaster/farm.
  const facts = [
    ["Variety", c.variety],
    ["Process", c.process],
    ["Country", c.country],
    ["Region", c.region],
    ["Altitude", c.altitude || c.altitudeCategory],
    ["Roast level", c.roastLevel],
    ["Tasting notes", c.tastingNotes],
  ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");

  const dose = c.doseG || 18;
  const method = c.method === "pourover" ? "pourover" : "espresso";

  // Machine-specific technique framing for the espresso prompt.
  const MACHINE_TECHNIQUES = {
    "slayer-single": `a SLAYER single-group machine (needle-valve manual flow control). Slayer technique: a long, gentle low-pressure PRE-BREW (needle valve cracked open) saturates the puck evenly, then you open to FULL THROTTLE for the main extraction. preBrew = the low-pressure phase in seconds (e.g. "25–35s"); fullThrottle = the full-flow phase after it.`,
    "linea-mini": `a LA MARZOCCO LINEA MINI (dual boiler, fixed ~9-bar profile, no flow control). There is no real pre-infusion — give preBrew as the brief natural ramp ("1–2s") and put the dial-in work into grind, ratio and temperature. fullThrottle = the full extraction time in seconds.`,
    "linea-micra": `a LA MARZOCCO LINEA MICRA (compact dual boiler, fixed ~9-bar profile, no flow control). There is no real pre-infusion — give preBrew as the brief natural ramp ("1–2s") and put the dial-in work into grind, ratio and temperature. fullThrottle = the full extraction time in seconds.`,
    "gs3": `a LA MARZOCCO GS3 MP (conical-valve paddle). Technique: hold the paddle at line pressure for a true low-pressure pre-infusion, then open to full pressure. preBrew = the line-pressure phase in seconds; fullThrottle = the full-pressure phase.`,
    "breville-barista": `a BREVILLE BARISTA (54mm portafilter, thermocoil, programmed low-pressure pre-infusion). The 54mm basket runs a slightly lower headroom — keep doses moderate. preBrew = the programmed pre-infusion in seconds (hold the button to extend); fullThrottle = the main extraction.`,
  };
  const technique = MACHINE_TECHNIQUES[c.machineId] || MACHINE_TECHNIQUES["slayer-single"];

  const BREWER_TECHNIQUES = {
    origami: `an ORIGAMI DRIPPER (with a flat Kalita-style wave filter unless stated otherwise — the ribs give fast drawdown, so it rewards slightly finer grinds and controlled pours)`,
    v60: `a HARIO V60 (cone, fast drawdown driven by pour technique — spiral pours, grind controls contact time)`,
    kalita: `a KALITA WAVE (flat bed, self-levelling, forgiving — pulse pours keep the bed even)`,
    chemex: `a CHEMEX (thick filter, slower drawdown — grind coarser than other pour-overs)`,
    other: `a flat-bottom pour-over brewer`,
  };
  const brewerTech = BREWER_TECHNIQUES[c.brewer] || BREWER_TECHNIQUES.origami;

  const prompt = method === "pourover"
    ? `You are a specialty-coffee brewer designing a pour-over recipe for ${brewerTech}. Use ONLY the bean's VARIETY and PROCESS (with origin and roast level as context). Do NOT mention or research the roaster, farm, or provenance.

Bean:
${facts || "(minimal data — infer sensibly from variety/process conventions)"}

Give ONE dialed recipe (plus an optional stronger variation if the bean merits it). For each give:
- grindDirection: relative to a normal medium filter grind. EXACTLY one of: "much finer", "finer", "slightly finer", "about the same", "slightly coarser", "coarser".
- doseG: coffee dose in grams, e.g. "20".
- ratio: e.g. "1:16" (delicate/floral → 1:16–1:17 for clarity; heavier/naturals → 1:15).
- waterG: total water in grams matching dose × ratio.
- bloom: bloom water and time, e.g. "45g · 35s".
- pours: number of pours after the bloom and their structure, e.g. "2 × 130g".
- totalTime: target drawdown finish, e.g. "3:00–3:30".
- temp: like "94–96°C" (lighter/denser → hotter; darker/soluble → cooler).
- note: ONE short line — the key lever or what to taste for.

"insight": at most 2 sentences on what this variety + process mean for percolation on this brewer. No roaster, no farm history, no sources.

End with EXACTLY ONE fenced \`\`\`json block and nothing after it:
\`\`\`json
{
  "insight": "...",
  "drinks": [
    {"name": "Pour-Over", "grindDirection": "...", "doseG": "20", "ratio": "1:16", "waterG": "320", "bloom": "45g · 35s", "pours": "2 × 130g", "totalTime": "3:00–3:30", "temp": "94–96°C", "note": "..."}
  ]
}
\`\`\``
    : `You are a specialty-espresso expert dialing for ${technique} Use ONLY the bean's VARIETY and PROCESS (with origin and roast level as context). Do NOT mention or research the roaster, farm, or provenance.

Bean:
${facts || "(minimal data — infer sensibly from variety/process conventions)"}

For a ${dose}g dose, say how to pull this as ESPRESSO (black) vs FLAT WHITE (in milk). For each drink give:
- grindDirection: relative to a normal medium-roast espresso grind. EXACTLY one of: "much finer", "finer", "slightly finer", "about the same", "slightly coarser", "coarser". (Dense/delicate/floral varieties like Gesha, Chiroso, SL28 grind finer; soluble naturals and extended/anaerobic ferments grind coarser to avoid over-extraction.)
- ratio: brew ratio as input:output, e.g. "1:2.5". Espresso for delicate/floral beans runs LONGER (1:2.5–1:3) for aromatic clarity; sweeter/heavier beans nearer 1:2. Flat White CONCENTRATES (1:1.3–1:2, ristretto-leaning) so it cuts through milk.
- preBrew: as defined for this machine above, e.g. "25–35s".
- fullThrottle: main extraction duration in seconds AFTER the pre-brew/ramp, e.g. "12–20s".
- temp: a short range like "94–96°C".
- note: ONE short line — the key lever on this machine or what to taste for.

"insight": at most 2 sentences on what this variety + process mean for extraction on this machine, plus the principle "extend for black, concentrate for milk". No roaster, no farm history, no sources.

End with EXACTLY ONE fenced \`\`\`json block and nothing after it:
\`\`\`json
{
  "insight": "...",
  "drinks": [
    {"name": "Espresso", "grindDirection": "...", "ratio": "1:2.5", "preBrew": "25–35s", "fullThrottle": "12–20s", "temp": "94–96°C", "note": "..."},
    {"name": "Flat White", "grindDirection": "...", "ratio": "1:1.5", "preBrew": "15–25s", "fullThrottle": "10–18s", "temp": "93–95°C", "note": "..."}
  ]
}
\`\`\``;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = extractJson(text);
    if (!parsed || !Array.isArray(parsed.drinks) || parsed.drinks.length === 0) {
      console.error("Dial-in parse failure. Raw:", text.slice(0, 500));
      return res.status(502).json({ error: "Could not read the dial-in result. Please try again." });
    }
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Dial-in error:", err);
    return res.status(500).json({ error: "Dial-in failed. Please try again." });
  }
}
