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
      model: "claude-sonnet-4-20250514",
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
              text: `You are a coffee bag label parser. Analyze this coffee bag image and extract every detail visible on the label.

Return ONLY a raw JSON object — no markdown, no backticks, no explanation:
{
  "name": "coffee name or blend",
  "country": "origin country",
  "region": "specific region",
  "variety": "coffee variety (Bourbon, Typica, Geisha, Tabi, SL28, Caturra, etc.)",
  "producer": "farm name and/or producer name",
  "roaster": "roasting company",
  "roastLevel": "Light, Medium, Medium-Dark, or Dark — infer from visual indicators if not stated",
  "process": "Washed, Natural, Honey, Anaerobic, Carbonic Maceration, etc.",
  "altitude": "growing altitude if listed",
  "weight": "bag weight with unit (e.g. 300g, 250g, 12oz, 1lb)",
  "price": "price if visible",
  "tastingNotes": "tasting notes / cup profile / flavor descriptors",
  "rawNotes": "harvest date, certifications, or any other notable text"
}

Use null for any field not visible or confidently inferrable. Be precise.`,
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
