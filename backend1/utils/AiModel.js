import axios from "axios";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

// ✅ Exponential backoff for OpenAI rate limits
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
  throw new Error("❌ OpenAI API failed after retries");
}

// ✅ Calls OpenAI GPT-4 API
export async function callLLM(query) {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY is missing in .env");
    return { match: false };
  }

  try {
    console.log(`🔍 Calling OpenAI with query: "${query}"`);

    const response = await retryRequest(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an entity recognition AI." },
          { role: "user", content: `Determine if "${query}" maps to an existing entity.` },
        ],
        max_tokens: 50,
      },
      {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      }
    );

    const result = response.data.choices[0].message.content.trim();
    console.log("✅ LLM Response:", result);

    const match = result.match(/match found:\s*(.+)/i);
    if (match) {
      return { match: true, canonicalName: match[1].trim() };
    }
    return { match: false };
  } catch (error) {
    console.error("❌ LLM API Error:", error.message);
    return { match: false };
  }
}
