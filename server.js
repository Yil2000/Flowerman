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
import pg from "pg";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT; // שימוש ב-PORT מריילווי בלבד
const SECRET_KEY = process.env.SECRET_KEY;

// ===== PostgreSQL setup =====
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // חובה ב-Railway
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
const frontendPath = path.join(__dirname, "vent");
app.use(express.static(frontendPath));
app.get("/", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Ensure uploads folder exists
const uploadsDir = path.join(frontendPath, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ===== Helper: Create default admin if not exists =====
async function ensureAdmin() {
  const defaultAdmin = "admin";
  const defaultPass = "123456789";

  const res = await pool.query("SELECT * FROM admins WHERE username=$1", [defaultAdmin]);
  if (res.rowCount === 0) {
    const hash = await bcrypt.hash(defaultPass, 10);
    await pool.query("INSERT INTO admins (username, password) VALUES ($1, $2)", [defaultAdmin, hash]);
    console.log("✅ Default admin created!");
  }
}

// ===== JWT Middleware =====
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ===== Admin Login =====
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing username or password" });

  const result = await pool.query("SELECT * FROM admins WHERE username=$1", [username]);
  if (result.rowCount === 0) return res.status(401).json({ error: "User not found" });

  const match = await bcrypt.compare(password, result.rows[0].password);
  if (!match) return res.status(401).json({ error: "Wrong password" });

  const token = jwt.sign({ username: result.rows[0].username }, SECRET_KEY, { expiresIn: "1h" });
  res.json({ token });
});

// ===== Verify Token =====
app.post("/admin/verify-token", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.json({ valid: false });

  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, SECRET_KEY);
    res.json({ valid: true });
  } catch {
    res.json({ valid: false });
  }
});

// ===== Upload Endpoint =====
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const streamifier = (await import("streamifier")).default;
      const streamUpload = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: "shares" }, (error, result) => {
            if (result) resolve(result); else reject(error);
          });
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      const result = await streamUpload();
      return res.json({ url: result.secure_url });
    }

    // Save locally
    const fileName = Date.now() + "-" + req.file.originalname.replace(/\s+/g, "_");
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, req.file.buffer);
    res.json({ url: `/uploads/${fileName}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ===== Shares Endpoints =====
app.post("/shares", async (req, res) => {
  const { name, message, imageUrl } = req.body;
  if (!name || !message) return res.status(400).json({ error: "Missing fields" });

  try {
    const result = await pool.query(
      "INSERT INTO shares (name, message, imageUrl, published) VALUES ($1, $2, $3, 0) RETURNING id",
      [name, message, imageUrl || ""]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

app.get("/shares/published", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM shares WHERE published=1 ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

// ===== Admin Shares Endpoints =====
app.get("/admin/shares", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM shares ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/admin/shares/publish/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE shares SET published=1 WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/admin/shares/unpublish/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE shares SET published=0 WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

app.delete("/admin/shares/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM shares WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

// ===== Cloudinary Images API =====
app.get("/images/:tag", async (req, res) => {
  const { tag } = req.params;
  try {
    const result = await cloudinary.search
      .expression(`tags=${tag}`)
      .max_results(30)
      .execute();
    res.json(result.resources);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cloudinary error" });
  }
});

// ===== Start server =====
(async () => {
  try {
    // יצירת טבלאות אם לא קיימות
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        imageUrl TEXT,
        published BOOLEAN DEFAULT FALSE
      );
    `);

    // יצירת admin דיפולט
    await ensureAdmin();

    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Failed to start server:", err);
  }
})();
