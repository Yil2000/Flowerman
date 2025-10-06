// server.js
import express from "express";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import multer from "multer";
import fs from "fs";
import { Pool } from "pg";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const SECRET_KEY = process.env.JWT_SECRET || process.env.SECRET_KEY || "default_secret";
let serverReady = false;

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ===== Uploads Folder =====
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ===== Database =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = { query: (text, params) => pool.query(text, params) };

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
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
}

// ===== Cloudinary =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

// ===== Multer =====
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ===== Initialize Tables =====
async function initAdmin() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);
  const username = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASS;
  const result = await db.query("SELECT * FROM admins WHERE username=$1", [username]);
  if (result.rows.length === 0) {
    const hash = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO admins (username, password) VALUES ($1, $2)", [username, hash]);
    console.log("✅ Admin created from ENV");
  }
}

async function initSharesTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS shares (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      imageUrl TEXT,
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

// ===== Admin Login =====
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM admins WHERE username=$1", [username]);
    const admin = result.rows[0];
    if (!admin) return res.status(401).json({ error: "User not found" });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ error: "Wrong password" });

    const token = jwt.sign({ username: admin.username }, SECRET_KEY, { expiresIn: "30m" });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/admin/verify-token", authenticateAdmin, (req, res) => {
  res.json({ valid: true });
});

// ===== Upload =====
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
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ===== Upload Multiple Images with Tag Admin Side =====
app.post("/upload-with-tag", upload.array("files"), async (req, res) => {
  try {
    const tag = req.body.tag; // הערך מה-select
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
      uploadResults.push({ originalName: file.originalname, url: result.secure_url });
    }

    res.json({ success: true, files: uploadResults });
  } catch (err) {
    console.error("Upload with tag error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});


// ===== Shares =====
app.post("/shares", upload.single("file"), async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: "Missing fields" });

    let imageUrl = null;
    if (req.file) {
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
    }

    const result = await db.query(
      "INSERT INTO shares (name, message, imageUrl) VALUES ($1, $2, $3) RETURNING *",
      [name, message, imageUrl]
    );
    res.json({ success: true, share: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save share" });
  }
});

// ===== Images by Tag or Folder =====
app.get("/images/:name", async (req, res) => {
  const { name } = req.params;
  try {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return res.status(500).json({ error: "Cloudinary not configured" });
    }

    let resources;

    // אם השם הוא 'shares' → חפש לפי תיקייה
    if (name === "shares") {
      resources = await cloudinary.api.resources({
        type: "upload",
        prefix: `${name}/`,
        max_results: 100
      });
    } else {
      // אחרת חפש לפי תג
      resources = await cloudinary.api.resources_by_tag(name, { max_results: 100 });
    }

    const images = resources.resources.map(r => ({
      public_id: r.public_id,
      secure_url: r.secure_url
    }));

    res.json(images);
  } catch (err) {
    console.error("❌ Failed to fetch images:", err);
    res.status(500).json({ error: "Failed to fetch images from Cloudinary" });
  }
});




app.get("/shares/published", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM shares WHERE published=TRUE ORDER BY id DESC");
    if (result.rows.length === 0)
      return res.json({ message: "לא נמצאו טפסים" });
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// ===== Admin Shares =====
app.get("/admin/shares", authenticateAdmin, async (req, res) => {
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

    if (share.imageUrl) {
      const publicId = share.imageUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ===== Contacts =====
app.post("/contacts", async (req, res) => {
  const { name, phone, region, message } = req.body;
  if (!name || !phone || !region || !message)
    return res.status(400).json({ error: "Missing fields" });

  const result = await db.query(
    "INSERT INTO contacts (name, phone, region, message) VALUES ($1,$2,$3,$4) RETURNING *",
    [name, phone, region, message]
  );
  res.json({ success: true, contact: result.rows[0] });
});

app.get("/admin/contacts", authenticateAdmin, async (req, res) => {
  const result = await db.query("SELECT * FROM contacts ORDER BY created_at DESC");
  res.json(result.rows);
});

app.delete("/admin/contacts/:id", authenticateAdmin, async (req, res) => {
  await db.query("DELETE FROM contacts WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// ===== Serve HTML =====
app.get("*", (req, res) => {
  if (!serverReady) return res.sendFile(path.join(__dirname, "loading.html"));
  res.sendFile(path.join(__dirname, "index.html"));
});

// ===== Start Server =====
Promise.all([initAdmin(), initSharesTable(), initContactsTable()])
  .then(() => {
    serverReady = true;
    app.listen(PORT, () => console.log(`🌸 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("❌ Init error:", err);
    app.listen(PORT, () => console.log(`🌸 Server running on port ${PORT}`));
  });






