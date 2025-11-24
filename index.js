import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

// --- MongoDB configuration ---
const url = process.env.MONGO_URL;
const dbName = "cs3870db";
const collectionName = "contacts";

const client = new MongoClient(url);
const db = client.db(dbName);

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ?? 8081;
const HOST = "0.0.0.0";

// GET all contacts
app.get("/contacts", async (req, res) => {
  try {
    await client.connect();
    const results = await db.collection(collectionName).find({}).toArray();
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    await client.close();
  }
});

// GET one by name
app.get("/contacts/:name", async (req, res) => {
  try {
    await client.connect();
    const result = await db
      .collection(collectionName)
      .findOne({ contact_name: req.params.name });

    if (!result) return res.status(404).json({ message: "Not found" });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    await client.close();
  }
});

// POST
app.post("/contacts", async (req, res) => {
  try {
    await client.connect();
    await db.collection(collectionName).insertOne(req.body);
    res.status(201).json({ message: "Contact added" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    await client.close();
  }
});

// PUT
app.put("/contacts/:name", async (req, res) => {
  try {
    await client.connect();
    const result = await db
      .collection(collectionName)
      .updateOne({ contact_name: req.params.name }, { $set: req.body });

    if (result.matchedCount === 0)
      return res.status(404).json({ message: "Contact not found" });

    res.status(200).json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    await client.close();
  }
});

// DELETE
app.delete("/contacts/:name", async (req, res) => {
  try {
    await client.connect();
    const result = await db
      .collection(collectionName)
      .deleteOne({ contact_name: req.params.name });

    if (result.deletedCount === 0)
      return res.status(404).json({ message: "Contact not found" });

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    await client.close();
  }
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
