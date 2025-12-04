// server.js (Improved & Fixed)
import express from "express";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import { Pool } from "pg";
import { cacheMiddleware } from "./cache.js";


dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;


const SECRET_KEY = process.env.SECRET_KEY;
// 🔹 Require SECRET_KEY
if (!process.env.SECRET_KEY) {
  console.error("❌ SECRET_KEY not set in ENV");
  process.exit(1);
}


// הגשה ידנית של robots.txt
app.get("/robots.txt", (req, res) => {
  res.set("Cache-Control", "public, max-age=86400"); // 24 שעות
  res.type("text/plain");
  res.sendFile(path.join(__dirname, "robots.txt"));
});

let serverReady = false;

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use("/admin.html", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});
;




// ===== Uploads Folder =====
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ===== Multer =====
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error("❌ ADMIN_USER or ADMIN_PASS not set in ENV");
  process.exit(1);
}


async function initSharesTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS shares (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      imageurl TEXT,
      public_id TEXT,
      published BOOLEAN DEFAULT FALSE
    )
  `);
  console.log("✅ Shares table ready");
}

async function initContactsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      region TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✅ Contacts table ready");
}

// ===== Database =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = { query: (text, params) => pool.query(text, params) };
// ✅ Ensure public_id column exists (run once)
async function ensurePublicIdColumn() {
  try {
    await db.query(`
      ALTER TABLE shares
      ADD COLUMN IF NOT EXISTS public_id TEXT;
    `);
    console.log("✅ public_id column is ready");
  } catch (err) {
    console.error("❌ Failed to add public_id column:", err.stack);
  }
}

// קריאה חד־פעמית
ensurePublicIdColumn();


pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

// ===== JWT Authentication =====
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.admin = decoded;
    next();
  } catch (err) {
    console.error("JWT error:", err.stack);
    res.status(403).json({ error: "Invalid token" });
  }
}

app.use("/admin", (req, res, next) => {
  if (req.path === "/login") return next();
  return authenticateAdmin(req, res, next);
});

// ===== Cloudinary Config =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});


// ===== Admin Login =====

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASS) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "30m" });
  res.json({ token });
});


// ===== Verify Token =====
app.post("/admin/verify-token", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ valid: false });

  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, SECRET_KEY);
    res.json({ valid: true });
  } catch {
    res.status(403).json({ valid: false });
  }
});

// ===== Upload Single =====
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const streamifier = (await import("streamifier")).default;
    const streamUpload = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "shares" },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

    const result = await streamUpload();
    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ===== Upload Multiple with Tag =====
app.post("/upload-with-tag", upload.array("files"), async (req, res) => {
  try {
    const tag = req.body.tag;
    if (!tag) return res.status(400).json({ error: "Missing tag" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files selected" });

    const streamifier = (await import("streamifier")).default;
    const uploadFile = (file) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: tag, tags: [tag] },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        streamifier.createReadStream(file.buffer).pipe(stream);
      });

    const uploadResults = [];
    for (const file of req.files) {
      const result = await uploadFile(file);
      uploadResults.push({ originalName: file.originalname, url: result.secure_url, public_id: result.public_id });
    }

    res.json({ success: true, files: uploadResults });
  } catch (err) {
    console.error("Upload with tag error:", err.stack);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ===== Shares =====
app.post("/shares", upload.single("file"), async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ error: "Missing fields" });
    }

    let imageUrl = null;
    let public_id = null;

    // ✅ רק אם נשלחה תמונה — נעלה ל־Cloudinary
    if (req.file && req.file.buffer) {
      const streamifier = (await import("streamifier")).default;
      const streamUpload = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "shares" },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

      const uploadResult = await streamUpload();
      imageUrl = uploadResult.secure_url;
      public_id = uploadResult.public_id;
    }

    // ✅ שמירה במסד הנתונים
    const result = await db.query(
      "INSERT INTO shares (name, message, imageUrl, public_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, message, imageUrl, public_id]
    );

    res.json({ success: true, share: result.rows[0] });
  } catch (err) {
    console.error("❌ Error saving share:", err.stack);
    res.status(500).json({ error: "Failed to save share" });
  }
});


// ===== Images by Tag or Folder with Cache & Pagination =====
const imageCache = {}; // { tagOrFolderName: { images: [...], expires: timestamp } }
const CACHE_DURATION = 30 * 60 * 1000; // 1 שעה

app.get("/images/:name", async (req, res) => {
  const { name } = req.params;

  const cached = imageCache[name];
  if (cached && cached.expires > Date.now()) return res.json(cached.images);

  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ error: "Cloudinary not configured" });
    }

    let allImages = [];
    let cursor = undefined;

    do {
      const options = { type: "upload", prefix: name === "shares" ? "shares/" : undefined, max_results: 100 };
      if (name !== "shares") options.tags = [name];
      if (cursor) options.next_cursor = cursor;

      let result;
      try {
        result = name === "shares"
          ? await cloudinary.api.resources(options)
          : await cloudinary.api.resources_by_tag(name, options);
      } catch (err) {
        if (err.http_code === 420) return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
        throw err;
      }

      allImages.push(...result.resources.map(r => ({ public_id: r.public_id, secure_url: r.secure_url })));
      cursor = result.next_cursor;
    } while (cursor);

    imageCache[name] = { images: allImages, expires: Date.now() + CACHE_DURATION };
    res.json(allImages);
  } catch (err) {
    console.error("❌ Failed to fetch images:", err.stack);
    res.status(500).json({ error: "Server error while fetching images" });
  }
});

// ===== Published Shares =====
app.get("/shares/published", cacheMiddleware, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM shares WHERE published=TRUE ORDER BY id DESC");
    if (result.rows.length === 0) return res.json({ message: "לא נמצאו טפסים" });
    res.json(result.rows);
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "DB error" });
  }
});

// ===== Admin Shares =====
app.get("/admin/shares",authenticateAdmin, async (req, res) => {
  const result = await db.query("SELECT * FROM shares ORDER BY id DESC");
  res.json(result.rows);
});

app.post("/admin/shares/publish/:id", authenticateAdmin, async (req, res) => {
  await db.query("UPDATE shares SET published=TRUE WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

app.post("/admin/shares/unpublish/:id", authenticateAdmin, async (req, res) => {
  await db.query("UPDATE shares SET published=FALSE WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

app.delete("/admin/shares/:id", authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM shares WHERE id=$1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "לא נמצא" });

    const share = rows[0];
    await db.query("DELETE FROM shares WHERE id=$1", [req.params.id]);

    if (share.public_id) {
      try {
        await cloudinary.uploader.destroy(share.public_id);
      } catch (err) {
        console.error("❌ Failed to delete from Cloudinary:", err.stack);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ===== Contacts =====
app.post("/contacts", async (req, res) => {
  const { contact_name, phone, region, message } = req.body;
  if (!contact_name || !phone || !region || !message)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const result = await db.query(
      "INSERT INTO contacts (name, phone, region, message) VALUES ($1,$2,$3,$4) RETURNING *",
      [contact_name, phone, region, message]
    );
    res.json({ success: true, contact: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/admin/contacts",authenticateAdmin, async (req, res) => {
  const result = await db.query("SELECT * FROM contacts ORDER BY created_at DESC");
  res.json(result.rows);
});

app.delete("/admin/contacts/:id", authenticateAdmin, async (req, res) => {
  await db.query("DELETE FROM contacts WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// ✅ Public shares route (alias)
app.get("/shares", cacheMiddleware, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM shares WHERE published=TRUE ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "DB error" });
  }
});


// ===== Catch-All =====
app.get("*", cacheMiddleware, (req, res) => {
  // תמיד מאפשר robots.txt גם אם serverReady=false
  if (req.path === "/robots.txt") return res.sendFile(path.join(__dirname, "robots.txt"));

  if (!serverReady) return res.sendFile(path.join(__dirname, "loading.html"));
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "Endpoint not found" });

  res.sendFile(path.join(__dirname, "index.html"));
});


// ===== Start Server (with Loading Mode) =====
app.listen(PORT, () => console.log(`🌸 Server starting on port ${PORT}...`));

// נתחיל לטעון את ה־DB והטבלאות ברקע
Promise.all([initSharesTable(), initContactsTable()])
  .then(() => {
    serverReady = true;
    console.log("✅ Server fully ready!");
  })
  .catch(err => {
    console.error("❌ Init error:", err.stack);
    serverReady = true; // נמשיך להריץ גם אם קרתה שגיאה
  });





