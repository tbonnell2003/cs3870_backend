import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import { MONGO_URI } from "dotenv";

DeviceMotionEvent.config();

// --- MongoDB configuration ---
const url = MONGO_URI;
const dbName = "cs3870db";
const collectionName = "contacts";

const client = new MongoClient(url);
const db = client.db(dbName);

// --- Express app setup ---
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // parse JSON bodies

// Server configuration
const PORT = process.env.PORT ?? 8081;
const HOST = process.env.HOST ?? "0.0.0.0";

// GET /contacts : return all contacts
app.get("/contacts", async (req, res) => {
  try {
    await client.connect();
    console.log("Node connected successfully to GET MongoDB");

    const query = {};
    const results = await db
      .collection(collectionName)
      .find(query)
      .limit(100)
      .toArray();

    res.status(200).json(results);
  } catch (error) {
    console.error("Error in GET /contacts:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    await client.close();
  }
});

// GET /contacts/:name : get one contact by contact_name
app.get("/contacts/:name", async (req, res) => {
  const contactName = req.params.name;
  console.log("Contact to find:", contactName);

  try {
    await client.connect();
    console.log("Node connected successfully to GET-id MongoDB");

    const query = { contact_name: contactName };
    const result = await db.collection(collectionName).findOne(query);

    if (!result) {
      res.status(404).send("Not Found");
    } else {
      res.status(200).json(result);
    }
  } catch (error) {
    console.error("Error in GET /contacts/:name:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    await client.close();
  }
});


// POST /contacts : add a new contact
app.post("/contacts", async (req, res) => {
  // Validate that the body is not empty
  if (!req.body || Object.keys(req.body).length === 0) {
    return res
      .status(400)
      .send({ message: "Bad request: No data provided." });
  }

  // Extract fields from body
  const { contact_name, phone_number, message, image_url } = req.body;

  try {
    await client.connect();
    console.log("Node connected successfully to POST MongoDB");

    const contactsCollection = db.collection(collectionName);

    // Check if contact already exists
    const existingContact = await contactsCollection.findOne({
      contact_name: contact_name,
    });

    if (existingContact) {
      return res.status(409).json({
        message: `Contact with name '${contact_name}' already exists.`,
      });
    }

    // Create new document
    const newDocument = {
      contact_name,
      phone_number,
      message,
      image_url,
    };
    console.log(newDocument);

    // Insert into Mongo
    const result = await contactsCollection.insertOne(newDocument);
    console.log("Document inserted:", result);

    // Acknowledge frontend
    res.status(201).json({ message: "New contact added successfully" });
  } catch (error) {
    console.error("Error in POST /contacts:", error);
    res
      .status(500)
      .json({ message: "Failed to add contact: " + error.message });
  } finally {
    await client.close();
  }
});


// PUT /contacts/:name  -> update an existing contact by name
app.put("/contacts/:name", async (req, res) => {
  const oldName = req.params.name;
  const { contact_name, phone_number, message, image_url } = req.body;

  try {
    await client.connect();
    const contactsCollection = db.collection(collectionName);

    const result = await contactsCollection.updateOne(
      { contact_name: oldName },
      {
        $set: {
          contact_name,
          phone_number,
          message,
          image_url,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(200).json({ message: "Contact updated successfully" });
  } catch (error) {
    console.error("Error in PUT /contacts/:name:", error);
    res
      .status(500)
      .json({ message: "Failed to update contact: " + error.message });
  } finally {
    await client.close();
  }
});

// DELETE /contacts/:name  -> delete a contact by name
app.delete("/contacts/:name", async (req, res) => {
  const name = req.params.name;

  try {
    await client.connect();
    const contactsCollection = db.collection(collectionName);

    const result = await contactsCollection.deleteOne({
      contact_name: name,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(204).send(); // No content
  } catch (error) {
    console.error("Error in DELETE /contacts/:name:", error);
    res
      .status(500)
      .json({ message: "Failed to delete contact: " + error.message });
  } finally {
    await client.close();
  }
});


// Start server
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
