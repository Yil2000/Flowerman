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
const SECRET_KEY = process.env.SECRET_KEY || "replace_with_your_secret";
let serverReady = false;

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // כל קבצים זמינים מה-root

// ===== Uploads folder =====
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ===== Database setup =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
pool.connect()
  .then(() => console.log("✅ Connected to Postgres"))
  .catch((err) => console.error("❌ DB connection error:", err));
const db = { query: (text, params) => pool.query(text, params) };

// ===== Initialize admin table =====
async function initAdmin() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `);
    const username = process.env.ADMIN_USER;
    const password = process.env.ADMIN_PASS;
    const res = await db.query("SELECT * FROM admins WHERE username=$1", [username]);
    if (res.rows.length === 0) {
      const hash = await bcrypt.hash(password, 10);
      await db.query("INSERT INTO admins (username, password) VALUES ($1, $2)", [username, hash]);
      console.log("✅ Admin user created from ENV");
    } else console.log("ℹ️ Admin user already exists");
  } catch (err) {
    console.error("❌ Error initializing admin:", err);
  }
}

// ===== Initialize shares table =====
async function initSharesTable() {
  try {
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
  } catch (err) {
    console.error("❌ Error initializing shares table:", err);
  }
}

async function initContactsTable() {
  try {
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
  } catch (err) {
    console.error("❌ Error initializing contacts table:", err);
  }
}


// ===== Cloudinary config =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || ""
});

// ===== Multer setup =====
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ===== JWT middleware =====
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// ===== Admin login =====
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing username or password" });

  try {
    const result = await db.query("SELECT * FROM admins WHERE username=$1", [username]);
    const row = result.rows[0];
    if (!row) return res.status(401).json({ error: "User not found" });
    const match = await bcrypt.compare(password, row.password);
    if (!match) return res.status(401).json({ error: "Wrong password" });
    const token = jwt.sign({ username: row.username }, SECRET_KEY, { expiresIn: "30m" });
    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/admin/verify-token", authenticateToken, (req, res) => {
  res.json({ valid: true });
});

// ===== Upload endpoint =====
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const streamifier = (await import("streamifier")).default;
      const streamUpload = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "shares" },
            (error, result) => result ? resolve(result) : reject(error)
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      const result = await streamUpload();
      return res.json({ url: result.secure_url });
    }

    const fileName = Date.now() + "-" + req.file.originalname.replace(/\s+/g, "_");
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, req.file.buffer);
    res.json({ url: `/uploads/${fileName}` });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ===== Share submission (Cloudinary only) =====
app.post("/shares", upload.single("file"), async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: "Missing name or message" });

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ error: "Cloudinary is not configured" });
    }

    let imageUrl = null;
    if (req.file) {
      const streamifier = (await import("streamifier")).default;
      const streamUpload = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "shares" },
            (error, result) => result ? resolve(result) : reject(error)
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      try {
        const result = await streamUpload();
        imageUrl = result.secure_url;
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        return res.status(500).json({ error: "Failed to upload image to Cloudinary" });
      }
    }

    const result = await db.query(
      "INSERT INTO shares (name, message, imageUrl, published) VALUES ($1, $2, $3, FALSE) RETURNING *",
      [name, message, imageUrl]
    );

    res.json({ success: true, share: result.rows[0] });
  } catch (err) {
    console.error("Error submitting share:", err);
    res.status(500).json({ error: "Server error submitting share" });
  }
});

// ===== Public & Admin Shares endpoints =====
app.get("/shares/published", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM shares WHERE published=TRUE ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

app.get("/admin/shares", authenticateToken, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM shares ORDER BY id DESC");
    // מיפוי המפתחות: תמיד מחזיר imageUrl עם U גדולה
    const shares = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      message: r.message,
      imageUrl: r.imageurl || r.imageUrl || null,
      published: r.published
    }));
    res.json(shares);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/contacts", async (req, res) => {
  try {
    const { name, phone, region, message } = req.body;
    if (!name || !phone || !region || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await db.query(
      "INSERT INTO contacts (name, phone, region, message) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, phone, region, message]
    );

    res.json({ success: true, contact: result.rows[0] });
  } catch (err) {
    console.error("Error submitting contact:", err);
    res.status(500).json({ error: "Server error submitting contact" });
  }
});

app.get("/admin/contacts", authenticateToken, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM contacts ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

app.delete("/admin/contacts/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM contacts WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});


app.post("/admin/shares/publish/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE shares SET published=TRUE WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/admin/shares/unpublish/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE shares SET published=FALSE WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

app.delete("/admin/shares/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM shares WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

// ===== Gallery Endpoint (Cloudinary tags) =====
app.get("/images/:tag", async (req, res) => {
  const { tag } = req.params;
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ error: "Cloudinary not configured" });
    }
    const resources = await cloudinary.api.resources_by_tag(tag, { max_results: 100 });
    const images = resources.resources.map(r => ({ public_id: r.public_id, secure_url: r.secure_url }));
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch images from Cloudinary" });
  }
});

// ===== Serve index.html for SPA + SEO =====
app.get("*", (req, res) => {
  const userAgent = req.get("User-Agent") || "";
  if (!serverReady && !userAgent.includes("Googlebot")) {
    return res.sendFile(path.join(__dirname, "loading.html"));
  }
  res.sendFile(path.join(__dirname, "index.html"));
});

// ===== Start server after tables initialized =====
Promise.all([initAdmin(), initSharesTable(), initContactsTable()])
  .then(() => {
    serverReady = true;
    console.log("✅ Server is fully ready!");
  })
  .catch(err => {
    console.error("❌ Error initializing server:", err);
    serverReady = true;
  })
  .finally(() => {
    app.listen(PORT, () => console.log(`🌸 Listening on port ${PORT}`));
  });



