// server.js
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
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import streamifier from "streamifier";
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);



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
app.use(
  cors({
    origin: [
      "https://flowerman.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  })
);
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
const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  }
});

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error("❌ ADMIN_USER or ADMIN_PASS not set in ENV");
  process.exit(1);
}

// יצירת JWT למשתמש
function signUserToken(user) {
  // include id and role
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: "2h" });
}

// middleware לאימות user/token
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid token" });
  }
}

// middleware בדיקת role
function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Not authorized" });
    next();
  };
}


// הוסף בחלק ה־DB / init tables:
async function initUsersTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      fullname TEXT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'pending', -- pending, user, admin, superadmin
      approved_by INTEGER REFERENCES users(id),
      reset_token TEXT,
      reset_expires TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      last_login TIMESTAMP
    )
  `);
  console.log("✅ Users table ready");
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

async function initSharesTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS shares (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      imageUrl TEXT,
      public_id TEXT,
      published BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✅ Shares table ready");
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

// Test initial DB connection safely (without leaking client)
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Connected to PostgreSQL");
  } catch (err) {
    console.error("❌ DB Connection Error:", err.stack);
  }
})();

// Prevent crash on unexpected idle client errors
pool.on("error", (err) => {
  console.error("❌ Unexpected PG Pool Error:", err.stack);
});


// ===== JWT Authentication =====
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Missing token"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      SECRET_KEY
    );

    if (
      decoded.role !== "admin" &&
      decoded.role !== "superadmin"
    ) {
      return res.status(403).json({
        error: "Not authorized"
      });
    }

    req.admin = decoded;
    next();

  } catch (err) {
    console.error(err.stack);

    return res.status(403).json({
      error: "Invalid token"
    });
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

  const token = jwt.sign(
  {
    id: null, // חייב להעביר null אם אין לאדמין הזה ID בדאטה בייס
    username,
    role: "superadmin"
  },
  SECRET_KEY,
  { expiresIn: "30m" }
);
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

// ✅ להוסיף לאחר /admin/verify-token
app.post("/admin/refresh-token", authenticateAdmin, (req, res) => {
  const { id, username, role } = req.admin;
  const newToken = jwt.sign({ id, username, role }, SECRET_KEY, { expiresIn: "30m" });
  res.json({ token: newToken });
});

// ===== Upload Single =====
app.post(
  "/upload",
  authenticateUser,
  requireRole(["user", "admin", "superadmin"]),
  upload.single("file"),
  async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

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
app.post(
  "/upload-with-tag",
  authenticateUser,
  requireRole(["admin", "superadmin"]),
  upload.array("files"),
  async (req, res) => {
  try {
   const tag = req.body.tag;

if (!tag) {
  return res.status(400).json({
    error: "Missing tag"
  });
}

if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
  return res.status(400).json({
    error: "Invalid tag"
  });
}
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files selected" });

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
app.post("/shares", authenticateUser, requireRole(["user", "admin", "superadmin"]), upload.single("file"), async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ error: "Missing fields" });
    }

    let imageUrl = null;
    let public_id = null;

    // ✅ רק אם נשלחה תמונה — נעלה ל־Cloudinary
    if (req.file && req.file.buffer) {
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
const CACHE_DURATION = 60 * 60 * 1000; // 1 שעה

app.get("/images/:name", async (req, res) => {
  const name = req.params.name;

  // ✅ מניעת prototype pollution ומניעת traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res.status(400).json({ error: "Invalid name" });
  }

  const cacheKey = `img_${name}`;
  const cached = imageCache[cacheKey];
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

// ===== Admin Shares =====
app.get("/admin/shares",authenticateAdmin, async (req, res) => {
  const result = await db.query("SELECT * FROM shares ORDER BY id DESC");
  res.json(result.rows);
});

app.post("/admin/shares/publish/:id", authenticateAdmin, async (req, res) => {
  const result = await db.query(
    "UPDATE shares SET published=TRUE WHERE id=$1",
    [req.params.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      error: "Share not found"
    });
  }

  res.json({ success: true });
});

app.post("/admin/shares/unpublish/:id", authenticateAdmin, async (req, res) => {
  const result = await db.query(
  "UPDATE shares SET published=FALSE WHERE id=$1",
  [req.params.id]
);

if (result.rowCount === 0) {
  return res.status(404).json({
    error: "Share not found"
  });
}

res.json({ success: true });
  });

app.delete("/admin/shares/:id", authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM shares WHERE id=$1",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "לא נמצא"
      });
    }

    const share = rows[0];

    await db.query(
      "DELETE FROM shares WHERE id=$1",
      [req.params.id]
    );

    if (share.public_id) {
      try {
        await cloudinary.uploader.destroy(
          share.public_id
        );
      } catch (err) {
        console.error(
          "❌ Failed to delete from Cloudinary:",
          err.stack
        );
      }
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err.stack);
    res.status(500).json({
      error: "Delete failed"
    });
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
  const result = await db.query(
    "DELETE FROM contacts WHERE id=$1",
    [req.params.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      error: "Contact not found"
    });
  }

  res.json({ success: true });
});

// ✅ Public shares route (alias)
// ===== Published Shares =====

app.get("/shares", cacheMiddleware, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM shares WHERE published=TRUE ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "DB error" });
  }
});

// ===== ONE TIME SETUP - DELETE AFTER USE =====
app.get("/create-superadmin", async (req, res) => {
  try {
    const hash = await bcrypt.hash("Yannai100", 10);
    const result = await db.query(
      `INSERT INTO users (fullname, username, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'superadmin')
       RETURNING id, username, role`,
      ["Yannai iluz", "iluz_yan", "yannai.iluz@gmail.com", hash]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ===== END ONE TIME SETUP =====
app.get("/check-user/:username", async (req, res) => {
  const q = await db.query("SELECT id, username, role, password_hash FROM users WHERE username=$1", [req.params.username]);
  if (!q.rows.length) return res.json({ found: false });
  const user = q.rows[0];
  res.json({ found: true, role: user.role, hasHash: !!user.password_hash });
});


// ===== Catch-All =====
app.get("*", cacheMiddleware, (req, res) => {
  // תמיד מאפשר robots.txt גם אם serverReady=false
  if (req.path === "/robots.txt") return res.sendFile(path.join(__dirname, "robots.txt"));

  if (!serverReady) return res.sendFile(path.join(__dirname, "loading.html"));
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "Endpoint not found" });

  res.sendFile(path.join(__dirname, "index.html"));
});

 // ===== Register (user requests account) =====
app.post("/auth/register", async (req, res) => {
  const { fullname, username, password, passwordConfirm, email } = req.body;
  if (
  email &&
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
) {
  return res.status(400).json({
    error: "Invalid email"
  });
}
  if (!fullname || !username || !password || !passwordConfirm) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (password !== passwordConfirm) return res.status(400).json({ error: "Passwords do not match" });
if (username.length < 3 || username.length > 30)
  return res.status(400).json({ error: "Username must be 3–30 characters" });

if (!/^[a-zA-Z0-9_]+$/.test(username))
  return res.status(400).json({ error: "Username may only contain letters, digits, underscores" });

if (password.length < 5 || password.length > 72)
  return res.status(400).json({ error: "Password must be 4–72 characters" });

if (fullname.length > 100)
  return res.status(400).json({ error: "Name too long" });

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await db.query(
      `INSERT INTO users (fullname, username, email, password_hash, role) VALUES ($1,$2,$3,$4,'pending') RETURNING id, username, fullname, role`,
      [fullname, username, email || null, hash]
    );
    res.json({ success: true, user: result.rows[0], message: "ביקשת יצירת משתמש נשלחה – מחכה לאישור מנהל" });
  } catch (err) {
    console.error("Register error:", err.stack);
    if (err.code === "23505") return res.status(400).json({ error: "Username or email already exists" });
    res.status(500).json({ error: "DB error" });
  }
});

// ===== List pending users (admin only) =====
app.get("/admin/users/pending", authenticateUser, requireRole(["admin","superadmin"]), async (req,res) => {
  const result = await db.query("SELECT id, fullname, username, email, created_at FROM users WHERE role='pending' ORDER BY created_at ASC");
  res.json(result.rows);
});

// ===== Approve / Reject user (admin only) =====
app.post("/admin/users/approve/:id", authenticateUser, requireRole(["admin","superadmin"]), async (req,res) => {
  const userId = parseInt(req.params.id,10);
  try {
    const result = await db.query("UPDATE users SET role='user', approved_by=$1 WHERE id=$2 RETURNING id, username, role", [req.user.id, userId]);
    if (!result.rows.length) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Approve error:", err.stack);
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/admin/users/reject/:id", authenticateUser, requireRole(["admin","superadmin"]), async (req,res) => {
  const userId = parseInt(req.params.id,10);
  try {
    await db.query("DELETE FROM users WHERE id=$1 AND role='pending'", [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Reject error:", err.stack);
    res.status(500).json({ error: "DB error" });
  }
});




// ===== Complete bootstrap/setup (when using ADMIN_USER/ADMIN_PASS first-time) =====
app.post("/auth/complete-setup", async (req,res) => {
  // expects bootstrap token (from /auth/login when using env admin) in Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    if (decoded.role !== "bootstrap" || decoded.username !== ADMIN_USER) return res.status(403).json({ error: "Invalid bootstrap token" });

    const { fullname, username, password, passwordConfirm, email } = req.body;
    if (
  email &&
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
) {
  return res.status(400).json({
    error: "Invalid email"
  });
}
    if (!username || !password || password !== passwordConfirm) return res.status(400).json({ error: "Invalid fields" });

    // create superadmin user row
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await db.query(
      `INSERT INTO users (fullname, username, password_hash, role) VALUES ($1,$2,$3,'superadmin') RETURNING id, username, fullname, role`,
      [fullname || 'Admin', username, hash]
    );
    const user = result.rows[0];
    const newToken = signUserToken(user);
    res.json({ success: true, token: newToken, user });
  } catch (err) {
    console.error("Complete setup error:", err.stack);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== Password reset: request (sends email with token) =====
async function createTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

app.post("/auth/request-reset", async (req,res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });
  try {
    const q = await db.query("SELECT id, username, email FROM users WHERE email=$1", [email]);
    if (q.rows.length === 0) return res.json({ success: true }); // don't reveal
    const user = q.rows[0];
    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await db.query("UPDATE users SET reset_token=$1, reset_expires=$2 WHERE id=$3", [token, expires, user.id]);

    const transporter = await createTransporter();
    const resetLink = `${process.env.SITE_URL || ''}/reset-password.html?token=${token}&u=${user.id}`;
    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: "איפוס סיסמה",
        text: `להחלפת סיסמה היכנס: ${resetLink}`,
        html: `<p>להחלפת סיסמה לחץ: <a href="${resetLink}">${resetLink}</a></p>`
      });
    } else {
      console.log("Reset link (no SMTP configured):", resetLink);
      // אם אין SMTP נא להדפיס ללוג — ניתן להחליף לשליחה ידנית
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Request reset error:", err.stack);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== Password reset: perform reset =====
app.post("/auth/reset-password", async (req,res) => {
  const { userId, token, password, passwordConfirm } = req.body;
  if (!userId || !token || !password || password !== passwordConfirm) return res.status(400).json({ error: "Invalid input" });
  try {
    const q = await db.query("SELECT id, reset_token, reset_expires FROM users WHERE id=$1", [userId]);
    if (q.rows.length === 0) return res.status(400).json({ error: "Invalid" });
    const user = q.rows[0];
    if (!user.reset_token || user.reset_token !== token) return res.status(400).json({ error: "Invalid token" });
    if (new Date(user.reset_expires) < new Date()) return res.status(400).json({ error: "Token expired" });

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db.query("UPDATE users SET password_hash=$1, reset_token=NULL, reset_expires=NULL WHERE id=$2", [hash, userId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err.stack);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/auth/login", async (req,res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const q = await db.query("SELECT * FROM users WHERE username=$1", [username]);

    if (q.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username/password" });
    }

    const user = q.rows[0];

    const ok = await bcrypt.compare(password, user.password_hash || "");
    if (!ok) {
      return res.status(401).json({ error: "Invalid username/password" });
    }

    // חסימה אם לא אושר
    if (user.role === "pending") {
      return res.status(403).json({ error: "המשתמש ממתין לאישור מנהל" });
    }

    // עדכון כניסה אחרונה
    await db.query("UPDATE users SET last_login=NOW() WHERE id=$1", [user.id]);

    const token = signUserToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error("Login error:", err.stack);
    res.status(500).json({ error: "Server error" });
  }
});




// ===== Start Server (with Loading Mode) =====
app.listen(PORT, () => console.log(`🌸 Server starting on port ${PORT}...`));

// נתחיל לטעון את ה־DB והטבלאות ברקע
Promise.all([
  initUsersTable(),
  initContactsTable(),
  initSharesTable(),
  ensurePublicIdColumn()

])
  .then(() => {
    serverReady = true;
    console.log("✅ Server fully ready!");
  })
  .catch(err => {
    console.error("❌ Init error:", err.stack);
    serverReady = true; // נמשיך להריץ גם אם קרתה שגיאה
  });
