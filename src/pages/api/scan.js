import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { image, mediaType } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided" });

  // Validate and normalize media type
  let validMediaType = "image/jpeg"; // default fallback
  if (mediaType && ALLOWED_TYPES.includes(mediaType)) {
    validMediaType = mediaType;
  } else if (mediaType && mediaType.startsWith("image/")) {
    // Map unsupported types (like HEIC) to jpeg as fallback
    validMediaType = "image/jpeg";
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: validMediaType, data: image },
            },
            {
              type: "text",
              text: `You are a coffee bag label parser. Extract coffee details and the bag's visual design colors.

Return ONLY a raw JSON object — no markdown, no backticks, no explanation:
{
  "name": "coffee name or blend",
  "country": "origin country",
  "region": "specific region",
  "variety": "coffee variety (Bourbon, Typica, Geisha, Tabi, SL28, Caturra, etc.)",
  "producer": "farm name and/or producer name",
  "roaster": "roasting company",
  "roastLevel": "Light, Medium, Medium-Dark, or Dark",
  "process": "Washed, Natural, Honey, Anaerobic, etc.",
  "altitude": "growing altitude if listed",
  "weight": "bag weight with unit (e.g. 300g, 250g, 12oz, 1lb)",
  "price": "price if visible",
  "tastingNotes": "tasting notes / flavor descriptors, IN ENGLISH (translate if printed in another language)",
  "rawNotes": "harvest date, certifications, other notable text",
  "bagColor": "#C41E3A",
  "textColor": "#FFFFFF"
}

For bagColor: extract the PRIMARY/DOMINANT color of the coffee bag as a hex code. This is usually the main bag color (red, black, white, kraft brown, green, etc.)

For textColor: pick white (#FFFFFF) if bagColor is dark, or black/dark (#1A1A1A) if bagColor is light. This ensures readable contrast.

TASTING NOTES LANGUAGE: If the tasting notes / flavor descriptors on the bag are written in a language other than English (e.g. Spanish, Portuguese, Italian), translate them into natural English flavor descriptors for "tastingNotes", preserving meaning and the concise comma-separated style (e.g. "panela, frutos rojos, chocolate amargo" → "panela, red fruits, dark chocolate"). If they are already in English, return them unchanged. Do not translate proper names of varieties, processes, farms, or places.

Use null for any field not visible. Be precise with the hex color - it will be used to create a digital label card.`,
            },
          ],
        },
      ],
    });

    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Extract JSON robustly
    let cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No JSON in response", raw: rawText.slice(0, 300) });

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Scan error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
