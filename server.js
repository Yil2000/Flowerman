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
const PORT = process.env.PORT;
const SECRET_KEY = process.env.SECRET_KEY || "replace_with_your_secret";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Serve static files
const publicPath = __dirname; // כל הקבצים באותו level
app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Uploads folder
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });


// ===== Database setup =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // חובה ב-Render PostgreSQL
});
pool.connect()
  .then(() => console.log("✅ Connected to Postgres"))
  .catch(err => console.error("❌ DB connection error:", err));


// Wrapper for queries
const db = {
  query: (text, params) => pool.query(text, params)
};

// ===== Cloudinary config =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || ""
});

// ===== Multer setup =====
const storage = multer.memoryStorage();
const upload = multer({ storage });

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

  try {
    const result = await db.query("SELECT * FROM admins WHERE username=$1", [username]);
    const row = result.rows[0];
    if (!row) return res.status(401).json({ error: "User not found" });

    const match = await bcrypt.compare(password, row.password);
    if (!match) return res.status(401).json({ error: "Wrong password" });

    const token = jwt.sign({ username: row.username }, SECRET_KEY, { expiresIn: "1h" });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
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

    // Save locally if Cloudinary not configured
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
    const result = await db.query(
      "INSERT INTO shares (name, message, imageUrl, published) VALUES ($1, $2, $3, FALSE) RETURNING id",
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
    const result = await db.query("SELECT * FROM shares WHERE published=TRUE ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

// ===== Admin Shares Endpoints =====
app.get("/admin/shares", authenticateToken, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM shares ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/admin/shares/publish/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE shares SET published=TRUE WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/admin/shares/unpublish/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE shares SET published=FALSE WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});

app.delete("/admin/shares/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM shares WHERE id=$1", [id]);
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

// ===== Start Server =====
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));



