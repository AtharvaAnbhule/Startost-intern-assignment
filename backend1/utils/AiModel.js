import axios from "axios";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

// ✅ Exponential backoff for API rate limits
async function retryRequest(url, data, headers, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(url, data, { headers });
      return response;
    } catch (error) {
      if (error.response) {
        console.error(`🔴 API Error (${error.response.status}):`, error.response.data);

        if (error.response.status === 429) { // Too Many Requests
          const waitTime = (i + 1) * 3000; // Increase wait time (3s, 6s, 9s)
          console.warn(`⚠️ Rate limit hit. Retrying in ${waitTime / 1000} sec...`);
          await new Promise((res) => setTimeout(res, waitTime));
        } else {
          throw error;
        }
      } else {
        console.error("❌ Network Error:", error.message);
        throw error;
      }
    }
  }
  throw new Error("❌ Mistral API failed after retries");
}

// ✅ Calls Mistral AI API
export async function callLLM(query) {
  if (!process.env.MISTRAL_API_KEY) {
    console.error("❌ MISTRAL_API_KEY is missing in .env");
    return { match: false };
  }

  try {
    console.log(`🔍 Calling Mistral AI with query: "${query}"`);

    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: `You are an entity normalization AI specializing in Hebrew text.
                      Always respond in **valid JSON format**:
                      {
                        "match": true/false, 
                        "canonicalName": "Entity Name in Hebrew", 
                        "variations": ["variation1 (Hebrew)", "variation2 (Hebrew)", "variation3 (Hebrew)"], 
                        "category": "Category Name (if applicable)"
                      }.
                      - Ensure variations do **not** contain extra spaces.
                      - Remove any unnecessary spaces between Hebrew letters.
                      - Convert similar words to the same variation.
                      - Do **not** include English translations. 
                      - Only return JSON. No explanations.`
          },
          { role: "user", content: `Normalize the Hebrew entity: "${query}" and provide at least 3 Hebrew variations with no extra spaces.` },
        ],
        max_tokens: 150,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Raw Mistral AI Response:", JSON.stringify(response.data, null, 2));

    if (response.data.choices && response.data.choices.length > 0) {
      const messageContent = response.data.choices[0].message.content.trim();

      console.log("🛑 Raw Content Before Parsing:", messageContent); // Debug log

      try {
        const parsedResult = JSON.parse(messageContent);

        // ✅ Print parsed result for debugging
        console.log("✅ Parsed Result Before Cleanup:", parsedResult);

        // ✅ Remove spaces from Hebrew variations
        parsedResult.variations = parsedResult.variations.map(variation =>
          variation.replace(/\s+/g, "") // Removes all spaces
        );

        console.log("✅ Cleaned Hebrew Variations:", parsedResult);
        return parsedResult;
      } catch (error) {
        console.error("❌ JSON Parsing Error:", messageContent);
        return { match: false, canonicalName: null, variations: [], category: "unknown" };
      }
    }

    return { match: false, canonicalName: null, variations: [], category: "unknown" };
  } catch (error) {
    console.error("❌ Mistral API Error:", error.message);
    return { match: false, canonicalName: null, variations: [], category: "unknown" };
  }
}



