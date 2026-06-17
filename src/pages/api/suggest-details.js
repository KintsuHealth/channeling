import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const coffee = req.body;
  if (!coffee) return res.status(400).json({ error: "No coffee data provided" });

  // Identify which fields are missing
  const missingFields = [];
  if (!coffee.region) missingFields.push("region");
  if (!coffee.altitude) missingFields.push("altitude");

  if (missingFields.length === 0) {
    return res.status(200).json({ suggestions: {}, confidence: "none", notes: "All fields already filled" });
  }

  // Build context from all available data
  const availableData = [];
  if (coffee.name) availableData.push(`Coffee name: ${coffee.name}`);
  if (coffee.roaster) availableData.push(`Roaster: ${coffee.roaster}`);
  if (coffee.country) availableData.push(`Country: ${coffee.country}`);
  if (coffee.producer) availableData.push(`Producer/Farm: ${coffee.producer}`);
  if (coffee.variety) availableData.push(`Variety: ${coffee.variety}`);
  if (coffee.process) availableData.push(`Process: ${coffee.process}`);
  if (coffee.tastingNotes) availableData.push(`Tasting notes: ${coffee.tastingNotes}`);
  if (coffee.roastLevel) availableData.push(`Roast level: ${coffee.roastLevel}`);

  if (availableData.length === 0) {
    return res.status(200).json({
      suggestions: {},
      confidence: "none",
      notes: "Not enough data to make suggestions"
    });
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a specialty coffee expert. Based on the following coffee information, suggest values for the missing fields.

Available information:
${availableData.join("\n")}

Missing fields to suggest: ${missingFields.join(", ")}

Use your knowledge of coffee origins to make educated suggestions:
- For region: Suggest the most likely growing region based on producer name, variety, or country
- For altitude: Suggest typical altitude range for the region/variety (e.g., "1800-2100m")

Examples of inference:
- If producer is "Dumerso" and country is "Ethiopia" → region is likely "Gedeb, Yirgacheffe"
- If variety is "Geisha" and country is "Panama" → region is likely "Boquete" and altitude "1600-1900m"
- If variety is "SL28" and country is "Kenya" → altitude is likely "1700-2100m"
- If producer contains "Finca" + Spanish name in Colombia → look up known Colombian regions

Return ONLY a raw JSON object — no markdown, no backticks:
{
  "confidence": "high" | "medium" | "low",
  "suggestions": {
    "region": "suggested region or null if uncertain",
    "altitude": "suggested altitude or null if uncertain"
  },
  "notes": "Brief explanation of how you determined these values"
}

Only include fields in suggestions that you can reasonably infer. If you're not confident about a field, set it to null.`
        }
      ]
    });

    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Extract JSON
    let cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: "No JSON in response", raw: rawText.slice(0, 300) });
    }

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Suggest details error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
