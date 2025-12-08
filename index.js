import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

// --- MongoDB configuration (your existing setup) ---
const url = process.env.MONGO_URL; // or MONGO_URI in your .env
const dbName = "cs3870db";
const collectionName = "contacts";

const client = new MongoClient(url);
const db = client.db(dbName);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ?? 4000;
const HOST = "0.0.0.0";

// =======================
// JWT CONFIG + FAKE USER DB
// =======================

// In real apps use env var for this
const SECRET_KEY = "SUPER_SECRET_KEY_CHANGE_ME";
const ACCESS_TOKEN_EXPIRE_MINUTES = 30;

// Simple in-memory "DB" for users: { [email]: hashedPassword }
const fakeUsersDb = {};

// Helper: save user
function saveUserToDb(email, hashedPw) {
  fakeUsersDb[email] = hashedPw;
  console.log("DB state:", fakeUsersDb); // debug
}

// Helper: get user
function getUserByEmail(email) {
  const hashedPw = fakeUsersDb[email];
  if (!hashedPw) return null;
  return { email, hashedPassword: hashedPw };
}

// =======================
// 1) SIGNUP
// =======================
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ detail: "email and password are required" });
    }

    // Check if user exists
    if (fakeUsersDb[email]) {
      console.log(`User ${email} already exists`);
      return res.status(400).json({ detail: "User already exists" });
    }

    console.log("New user:", email, password); // debug (do not log passwords in prod)

    // Hash password with bcrypt
    const hashedPw = await bcrypt.hash(password, 10); // 10 = salt rounds
    saveUserToDb(email, hashedPw);

    return res.json({ msg: "signup ok" });
  } catch (err) {
    console.error("Error in /signup:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
});

// =======================
// 2) LOGIN
// =======================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ detail: "email and password are required" });
    }

    // Look up user
    const user = getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ detail: "Invalid email or password" });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!passwordMatch) {
      return res.status(401).json({ detail: "Invalid email or password" });
    }

    // Create JWT payload
    const now = Math.floor(Date.now() / 1000); // seconds
    const exp = now + ACCESS_TOKEN_EXPIRE_MINUTES * 60;

    const payload = {
      sub: email,
      exp: exp,
    };

    const token = jwt.sign(payload, SECRET_KEY);

    return res.json({ token });
  } catch (err) {
    console.error("Error in /login:", err);
    return res.status(500).json({ detail: "Internal server error" });
  }
});

// =======================
// 3) JWT AUTH MIDDLEWARE
// =======================
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ detail: "Missing Authorization header" });
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ detail: "Invalid Authorization header" });
  }

  jwt.verify(token, SECRET_KEY, (err, payload) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ detail: "Token expired" });
      }
      return res.status(401).json({ detail: "Invalid token" });
    }

    const email = payload.sub;
    if (!email) {
      return res.status(401).json({ detail: "Invalid token payload" });
    }

    const user = getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ detail: "User not found" });
    }

    // Attach to request so protected routes can use it
    req.userEmail = email;
    next();
  });
}

// =======================
// 4) PROTECTED ROUTE
// =======================
app.get("/protected", authenticateToken, (req, res) => {
  return res.json({ msg: `Hello ${req.userEmail}, this is protected data!` });
});

// =======================
// CONTACTS API (your existing routes)
// =======================

// GET all contacts (public)
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

// GET one by name (public)
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

// POST new contact (NOW PROTECTED WITH JWT)
app.post("/contacts", authenticateToken, async (req, res) => {
  try {
    await client.connect();
    await db.collection(collectionName).insertOne(req.body);
    console.log("User adding contact:", req.userEmail);
    res.status(201).json({ message: "Contact added" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    await client.close();
  }
});

// PUT update contact (still public for now)
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

// DELETE contact (still public for now)
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
  console.log(`Server running at http://localhost:${PORT}`);
});
