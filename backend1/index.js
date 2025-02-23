import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { Normalization } from "./models/Normalization.js";
import { callLLM } from "./utils/AiModel.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// ✅ MongoDB Connection with improved settings
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // 30s timeout
    socketTimeoutMS: 45000, // 45s socket timeout
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// ✅ Generate phonetic keys for better search matching
function generatePhoneticKeys(query) {
  return [query.toLowerCase()];
}

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
      if (!record.variations.includes(query)) {
        await Normalization.updateOne(
          { _id: record._id },
          { 
            $addToSet: { variations: query, phoneticKeys: { $each: phoneticKeys } }
          }
        );
      }
      return res.json(record);
    } else {
      const llmResult = await callLLM(query);

      if (llmResult.match && llmResult.canonicalName) {
        record = await Normalization.findOne({ canonicalName: llmResult.canonicalName }).lean();
        if (record) {
          await Normalization.updateOne(
            { _id: record._id },
            { 
              $addToSet: { variations: query, phoneticKeys: { $each: phoneticKeys } }
            }
          );
          return res.json(record);
        }
      }

      // ✅ Create new record if no match found
      const newRecord = new Normalization({
        canonicalName: query,
        variations: [query],
        phoneticKeys,
        category: "unknown",
      });
      await newRecord.save();
      return res.json(newRecord);
    }
  } catch (error) {
    console.error("❌ Search Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
