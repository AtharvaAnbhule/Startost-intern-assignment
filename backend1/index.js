import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
import { Normalization } from "./models/Normalization.js";
import { callLLM } from "./utils/AiModel.js";


dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// ✅ Generate Phonetic Keys (Basic Example using Lowercase Matching)
function generatePhoneticKeys(query) {
  return [query.toLowerCase()];
}

// ✅ Calls Mistral AI for LLM-based Normalization
// async function callLLM(query) {
//   if (!process.env.MISTRAL_API_KEY) {
//     console.error("❌ MISTRAL_API_KEY is missing in .env");
//     return { match: false };
//   }
//   try {
//     console.log(`🔍 Calling Mistral AI with query: "${query}"`);
    
//     const response = await axios.post(
//       "https://api.mistral.ai/v1/chat/completions",
//       {
//         model: "mistral-small",
//         messages: [
//           { role: "system", content: "You are an entity normalization AI." },
//           { role: "user", content: `Determine if \"${query}\" maps to an existing entity.` },
//         ],
//         max_tokens: 50,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     const result = response.data.choices[0].message.content.trim();
//     console.log("✅ LLM Response:", result);

//     const match = result.match(/match found:\s*(.+)/i);
//     if (match) {
//       return { match: true, canonicalName: match[1].trim() };
//     }
//     return { match: false };
//   } catch (error) {
//     console.error("❌ LLM API Error:", error.message);
//     return { match: false };
//   }
// }

// ✅ Search API Route
app.get("/api/search", async (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Query parameter is required and must be a string" });
  }

  const phoneticKeys = generatePhoneticKeys(query);

  try {
    let record = await Normalization.findOne({ variations: query }).lean();

    if (!record) {
      record = await Normalization.findOne({ phoneticKeys: { $in: phoneticKeys } }).lean();
    }

    if (record) {
      return res.json(record);
    } else {
      const llmResult = await callLLM(query);

      if (llmResult.match && llmResult.canonicalName && llmResult.variations.length > 0) {
        record = await Normalization.findOne({ canonicalName: llmResult.canonicalName }).lean();
        if (record) {
          return res.json(record);
        }

        const newCategory = llmResult.category && llmResult.category !== "unknown"
          ? llmResult.category
          : "Uncategorized";

        // ✅ Remove duplicate variations (normalize by removing spaces)
        const uniqueVariations = [...new Set(llmResult.variations.map(v => v.replace(/\s+/g, "")))];

        const newRecord = new Normalization({
          canonicalName: llmResult.canonicalName,
          variations: uniqueVariations,
          phoneticKeys,
          category: newCategory,
        });

        await newRecord.save();
        return res.json(newRecord);
      } else {
        console.error("❌ Mistral AI failed to provide a valid entity.");
        return res.status(500).json({ error: "Entity not found." });
      }
    }
  } catch (error) {
    console.error("❌ Search Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});





app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
