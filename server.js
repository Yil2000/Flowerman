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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
const SECRET_KEY = process.env.SECRET_KEY;

if (!SECRET_KEY) {
  console.error("❌ SECRET_KEY not set in ENV");
  process.exit(1);
}

let serverReady = false;

// ===== Uploads Folder =====
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ===== Database Config =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = { query: (text, params) => pool.query(text, params) };



// ===== Cloudinary Config =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

// ===== Multer Config =====
const storage = multer.memoryStorage();
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  }
});

// ===== Middlewares =====
app.use(
  cors({
    origin: ["https://flowerman.onrender.com"],
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

// ===== Helper Functions & Auth Middlewares =====
function signUserToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: "2h" });
}

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

// מאחד את הלוגיקה - בודק תפקיד מתוך req.user
function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Not authorized" });
    next();
  };
}

// הגנה גורפת על נתיבי הניהול - משתמשת בבסיס האחיד של authenticateUser
app.use("/admin", (req, res, next) => {
  if (req.path === "/login" || req.path === "/verify-token") return next();
  return authenticateUser(req, res, () => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    next();
  });
});

// ===== GET /auth/me — פרטי המשתמש המחובר =====
app.get("/auth/me", authenticateUser, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, fullname, username, email, role, created_at, last_login, password_hash FROM users WHERE id=$1",
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "User not found" });
    const user = result.rows[0];
    user.password_display = user.password_hash; // מציג hash — superadmin יודע מה זה
    delete user.password_hash; // לא שולחים את שם השדה הגולמי
    res.json(user);
  } catch (err) {
    console.error("GET /auth/me error:", err.stack);
    res.status(500).json({ error: "DB error" });
  }
});


// ===== PUT /auth/me — עדכון פרטים אישיים (כל משתמש לעצמו) =====
// כל משתמש מאושר יכול לעדכן את הפרטים שלו בלבד
// אסור לשנות role דרך route זה
app.put("/auth/me", authenticateUser, requireRole(["user","admin","superadmin"]), async (req, res) => {
  const { fullname, username, email, password } = req.body;

  if (!fullname || !username) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: "Username must be 3–30 characters" });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: "Username may only contain letters, digits, underscores" });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email" });
  }

  try {
    let query, params;

    if (password && password.length >= 5) {
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      query  = `UPDATE users SET fullname=$1, username=$2, email=$3, password_hash=$4 WHERE id=$5
                RETURNING id, fullname, username, email, role`;
      params = [fullname, username, email || null, hash, req.user.id];
    } else {
      query  = `UPDATE users SET fullname=$1, username=$2, email=$3 WHERE id=$4
                RETURNING id, fullname, username, email, role`;
      params = [fullname, username, email || null, req.user.id];
    }

    const result = await db.query(query, params);
    if (!result.rows.length) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("PUT /auth/me error:", err.stack);
    if (err.code === "23505") return res.status(400).json({ error: "Username or email already exists" });
    res.status(500).json({ error: "DB error" });
  }
});


// ===== GET /admin/users/all — כל המשתמשים (admin/superadmin בלבד) =====
// עדכן את הנתיב הזה בשרת שלך:
app.get("/admin/users/all", authenticateUser, requireRole(["admin","superadmin"]), async (req, res) => {
  try {
    // שינוי קטן בשאילתה: WHERE id != $1
    const fields = "id, fullname, username, email, role, created_at, last_login";
    const result = await db.query(
      `SELECT ${fields} FROM users WHERE id != $1 ORDER BY created_at DESC`, 
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /admin/users/all:", err.stack);
    res.status(500).json({ error: "DB error" });
  }
});


// ===== PUT /admin/users/:id — עדכון פרטי משתמש (admin/superadmin) =====
// חוקי שינוי role:
//   superadmin → יכול לשנות role של כולם חוץ מעצמו
//   admin      → יכול לשנות user ↔ admin בלבד, לא superadmin, לא עצמו
//   אף אחד לא יכול לשנות role של superadmin
app.put("/admin/users/:id",
  authenticateUser,
  requireRole(["admin","superadmin"]),
  async (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    const { fullname, username, email, role } = req.body;
    const myId   = req.user.id;
    const myRole = req.user.role;

    if (!fullname || !username) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // אסור לערוך את עצמך דרך route זה (לזה יש PUT /auth/me)
    if (targetId === myId) {
      return res.status(403).json({ error: "Use /auth/me to edit your own profile" });
    }

    try {
      // שלוף את היוזר הנערך
      const check = await db.query("SELECT role FROM users WHERE id=$1", [targetId]);
      if (!check.rows.length) return res.status(404).json({ error: "User not found" });
      const targetRole = check.rows[0].role;

      // הגנה: admin לא יכול לערוך superadmin
      if (targetRole === "superadmin" && myRole !== "superadmin") {
        return res.status(403).json({ error: "Cannot edit superadmin" });
      }

      // בדיקת הרשאת role
      let newRole = undefined;
      if (role && role !== targetRole) {
        if (myRole === "superadmin") {
          // superadmin יכול לשנות לכולם
          newRole = role;
        } else if (myRole === "admin") {
          // admin יכול רק user ↔ admin
          if (!["user","admin"].includes(role)) {
            return res.status(403).json({ error: "Admins can only set user or admin role" });
          }
          if (targetRole === "superadmin") {
            return res.status(403).json({ error: "Cannot change superadmin role" });
          }
          newRole = role;
        }
      }

     // בדיקת הרשאת שינוי סיסמה:
      // superadmin — יכול לשנות סיסמה לכולם (חוץ מעצמו, וחוץ מsuperadmin אחר)
      // admin — יכול לשנות סיסמה רק לuser
      const { password: newPassword } = req.body;
      let hashedNewPassword = null;

      if (newPassword && newPassword.length >= 5) {
        const canChangePassword =
          (myRole === "superadmin" && targetRole !== "superadmin") ||
          (myRole === "admin" && targetRole === "user");

        if (!canChangePassword) {
          return res.status(403).json({ error: "Not authorized to change this user's password" });
        }
        hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      }

      let query, params;
      if (newRole && hashedNewPassword) {
        query  = `UPDATE users SET fullname=$1, username=$2, email=$3, role=$4, password_hash=$5
                  WHERE id=$6 RETURNING id, fullname, username, email, role`;
        params = [fullname, username, email || null, newRole, hashedNewPassword, targetId];
      } else if (newRole) {
        query  = `UPDATE users SET fullname=$1, username=$2, email=$3, role=$4
                  WHERE id=$5 RETURNING id, fullname, username, email, role`;
        params = [fullname, username, email || null, newRole, targetId];
      } else if (hashedNewPassword) {
        query  = `UPDATE users SET fullname=$1, username=$2, email=$3, password_hash=$4
                  WHERE id=$5 RETURNING id, fullname, username, email, role`;
        params = [fullname, username, email || null, hashedNewPassword, targetId];
      } else {
        query  = `UPDATE users SET fullname=$1, username=$2, email=$3
                  WHERE id=$4 RETURNING id, fullname, username, email, role`;
        params = [fullname, username, email || null, targetId];
      }

      const result = await db.query(query, params);
      if (!result.rows.length) return res.status(404).json({ error: "User not found" });
      res.json({ success: true, user: result.rows[0] });

    } catch (err) {
      console.error("PUT /admin/users/:id:", err.stack);
      if (err.code === "23505") return res.status(400).json({ error: "Username or email already exists" });
      res.status(500).json({ error: "DB error" });
    }
  }
);


// ===== DELETE /admin/users/:id — מחיקת משתמש (admin/superadmin) =====
// superadmin מוגן לחלוטין ממחיקה
// אף אחד לא יכול למחוק את עצמו
app.delete("/admin/users/:id",
  authenticateUser,
  requireRole(["admin","superadmin"]),
  async (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    const myId     = req.user.id;
    const myRole   = req.user.role;

    if (targetId === myId) {
      return res.status(403).json({ error: "Cannot delete yourself" });
    }

    try {
      // שלוף role של היוזר הנמחק
      const check = await db.query("SELECT role FROM users WHERE id=$1", [targetId]);
      if (!check.rows.length) return res.status(404).json({ error: "User not found" });
      const targetRole = check.rows[0].role;

      // superadmin לא נמחק
      if (targetRole === "superadmin") {
        return res.status(403).json({ error: "Cannot delete superadmin" });
      }

      // admin לא יכול למחוק admin אחר
      if (myRole === "admin" && targetRole === "admin") {
        return res.status(403).json({ error: "Admins cannot delete other admins" });
      }

      const result = await db.query("DELETE FROM users WHERE id=$1 RETURNING id", [targetId]);
      if (!result.rows.length) return res.status(404).json({ error: "User not found" });
      res.json({ success: true });

    } catch (err) {
      console.error("DELETE /admin/users/:id:", err.stack);
      res.status(500).json({ error: "DB error" });
    }
  }
);


// ===== POST /admin/users/approve/:id — אישור pending → user =====
app.post("/admin/users/approve/:id",
  authenticateUser,
  requireRole(["admin","superadmin"]),
  async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    try {
      const result = await db.query(
        "UPDATE users SET role='user', approved_by=$1 WHERE id=$2 AND role='pending' RETURNING id, username, role",
        [req.user.id, userId]
      );
      if (!result.rows.length) return res.status(404).json({ error: "User not found or not pending" });
      res.json({ success: true, user: result.rows[0] });
    } catch (err) {
      console.error("Approve error:", err.stack);
      res.status(500).json({ error: "DB error" });
    }
  }
);


// ===== POST /admin/users/reject/:id — דחיית pending (מחיקה) =====
app.post("/admin/users/reject/:id",
  authenticateUser,
  requireRole(["admin","superadmin"]),
  async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    try {
      const result = await db.query(
        "DELETE FROM users WHERE id=$1 AND role='pending' RETURNING id",
        [userId]
      );
      if (!result.rows.length) return res.status(404).json({ error: "User not found or not pending" });
      res.json({ success: true });
    } catch (err) {
      console.error("Reject error:", err.stack);
      res.status(500).json({ error: "DB error" });
    }
  }
);

pool.on("error", (err) => {
  console.error("❌ Unexpected PG Pool Error:", err.stack);
});


// ===== Static & Public Routes =====
app.get("/robots.txt", (req, res) => {
  res.set("Cache-Control", "public, max-age=86400");
  res.type("text/plain");
  res.sendFile(path.join(__dirname, "robots.txt"));
});

// GET רשימת משתמשים ממתינים
app.get("/admin/users/pending", requireRole(["admin", "superadmin"]), async (req, res) => {
  const result = await db.query("SELECT id, fullname, username, email, created_at FROM users WHERE role='pending' ORDER BY created_at ASC");
  res.json(result.rows);
});

// ===== Token Utilities =====
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

app.post("/admin/refresh-token", requireRole(["admin", "superadmin"]), (req, res) => {
  const { id, username, role } = req.user;
  const newToken = jwt.sign({ id, username, role }, SECRET_KEY, { expiresIn: "30m" });
  res.json({ token: newToken });
});

// ===== Upload Routes =====
app.post("/upload", authenticateUser, requireRole(["user", "admin", "superadmin"]), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const streamUpload = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: "shares" }, (error, result) => (error ? reject(error) : resolve(result)));
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    const result = await streamUpload();
    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.post("/upload-with-tag", authenticateUser, requireRole(["admin", "superadmin"]), upload.array("files"), async (req, res) => {
  try {
    const tag = req.body.tag;
    if (!tag || !/^[a-zA-Z0-9_-]+$/.test(tag)) return res.status(400).json({ error: "Invalid or missing tag" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files selected" });

    const uploadFile = (file) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: tag, tags: [tag] }, (error, result) => (error ? reject(error) : resolve(result)));
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

// ===== Shares System =====
app.post("/shares", authenticateUser, requireRole(["user", "admin", "superadmin"]), upload.single("file"), async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: "Missing fields" });

    let imageUrl = null, public_id = null;
    if (req.file && req.file.buffer) {
      const streamUpload = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: "shares" }, (error, result) => (error ? reject(error) : resolve(result)));
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      const uploadResult = await streamUpload();
      imageUrl = uploadResult.secure_url;
      public_id = uploadResult.public_id;
    }

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

app.get("/shares", cacheMiddleware, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM shares WHERE published=TRUE ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "DB error" });
  }
});

// ===== Image Cache System (Fixed Potential Memory Leak) =====
const imageCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; 

// ניקוי אוטומטי של קאש פג תוקף כל שעה
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of imageCache.entries()) {
    if (value.expires < now) imageCache.delete(key);
  }
}, CACHE_DURATION);

app.get("/images/:name", async (req, res) => {
  const name = req.params.name;
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return res.status(400).json({ error: "Invalid name" });

  const cacheKey = `img_${name}`;
  const cached = imageCache.get(cacheKey);
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

      let result = name === "shares" ? await cloudinary.api.resources(options) : await cloudinary.api.resources_by_tag(name, options);
      allImages.push(...result.resources.map(r => ({ public_id: r.public_id, secure_url: r.secure_url })));
      cursor = result.next_cursor;
    } while (cursor);

    imageCache.set(cacheKey, { images: allImages, expires: Date.now() + CACHE_DURATION });
    res.json(allImages);
  } catch (err) {
    if (err.http_code === 420) return res.status(429).json({ error: "Rate limit exceeded" });
    console.error("❌ Failed to fetch images:", err.stack);
    res.status(500).json({ error: "Server error while fetching images" });
  }
});

// ===== Admin Shares Actions =====
app.get("/admin/shares", authenticateUser, requireRole(["admin","superadmin"]), async (req, res) => {
  const result = await db.query("SELECT * FROM shares ORDER BY id DESC");
  res.json(result.rows);
});

app.post("/admin/shares/publish/:id", authenticateUser, requireRole(["admin","superadmin"]), async (req, res) => {
  const result = await db.query("UPDATE shares SET published=TRUE WHERE id=$1", [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: "Share not found" });
  res.json({ success: true });
});

app.post("/admin/shares/unpublish/:id", authenticateUser, requireRole(["admin","superadmin"]), async (req, res) => {
  const result = await db.query("UPDATE shares SET published=FALSE WHERE id=$1", [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: "Share not found" });
  res.json({ success: true });
});

app.delete("/admin/shares/:id", authenticateUser, requireRole(["admin","superadmin"]), async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM shares WHERE id=$1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const share = rows[0];
    await db.query("DELETE FROM shares WHERE id=$1", [req.params.id]);
    if (share.public_id) {
      try { await cloudinary.uploader.destroy(share.public_id); }
      catch (err) { console.error("❌ Cloudinary delete failed:", err.stack); }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "Delete failed" });
  }
});

// הוסף את זה לקובץ server.js ליד נתיבי ה-admin האחרים
app.get("/admin/contacts", authenticateUser, requireRole(["admin", "superadmin"]), async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM contacts ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("GET /admin/contacts error:", err.stack);
    res.status(500).json({ error: "DB error" });
  }
});

// ===== Contacts =====
app.post("/contacts", async (req, res) => {
  const { contact_name, phone, region, message } = req.body;
  if (!contact_name || !phone || !region || !message) return res.status(400).json({ error: "Missing fields" });
  try {
    const result = await db.query("INSERT INTO contacts (name, phone, region, message) VALUES ($1,$2,$3,$4) RETURNING *", [contact_name, phone, region, message]);
    res.json({ success: true, contact: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ===== Authentication / Registration =====
app.post("/auth/register", async (req, res) => {
  const { fullname, username, password, passwordConfirm, email } = req.body;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email" });
  if (!fullname || !username || !password || !passwordConfirm) return res.status(400).json({ error: "Missing fields" });
  if (password !== passwordConfirm) return res.status(400).json({ error: "Passwords do not match" });
  if (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: "Invalid username structure" });
  if (password.length < 4 || password.length > 72) return res.status(400).json({ error: "Password length invalid" });

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await db.query(
      `INSERT INTO users (fullname, username, email, password_hash, role) VALUES ($1,$2,$3,$4,'pending') RETURNING id, username, fullname, role`,
      [fullname, username, email || null, hash]
    );
    res.json({ success: true, user: result.rows[0], message: "בקשת יצירת משתמש נשלחה" });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Username or email already exists" });
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });

  try {
    const q = await db.query("SELECT * FROM users WHERE username=$1", [username]);
    if (q.rows.length === 0) return res.status(401).json({ error: "Invalid username/password" });

    const user = q.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash || "");
    if (!ok) return res.status(401).json({ error: "Invalid username/password" });
    if (user.role === "pending") return res.status(403).json({ error: "המשתמש ממתין לאישור מנהל" });

    await db.query("UPDATE users SET last_login=NOW() WHERE id=$1", [user.id]);
    res.json({ token: signUserToken(user), user: { id: user.id, username: user.username, fullname: user.fullname, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ===== Password Reset =====
async function createTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

app.post("/auth/request-reset", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });
  try {
    const q = await db.query("SELECT id, username, email FROM users WHERE email=$1", [email]);
    if (q.rows.length === 0) return res.json({ success: true }); 

    const user = q.rows[0];
    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); 
    await db.query("UPDATE users SET reset_token=$1, reset_expires=$2 WHERE id=$3", [token, expires, user.id]);

    const transporter = await createTransporter();
    const resetLink = `${process.env.SITE_URL || ''}/reset-password.html?token=${token}&u=${user.id}`;
    if (transporter) {
      await transporter.sendMail({ from: process.env.EMAIL_FROM, to: user.email, subject: "איפוס סיסמה", html: `<p>לחץ כאן: <a href="${resetLink}">${resetLink}</a></p>` });
    } else {
      console.log("Reset link (No SMTP):", resetLink);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/auth/reset-password", async (req, res) => {
  const { userId, token, password, passwordConfirm } = req.body;
  if (!userId || !token || !password || password !== passwordConfirm) return res.status(400).json({ error: "Invalid input" });
  try {
    const q = await db.query("SELECT id, reset_token, reset_expires FROM users WHERE id=$1", [userId]);
    if (q.rows.length === 0) return res.status(400).json({ error: "Invalid" });
    const user = q.rows[0];
    if (!user.reset_token || user.reset_token !== token || new Date(user.reset_expires) < new Date()) return res.status(400).json({ error: "Invalid or expired token" });

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db.query("UPDATE users SET password_hash=$1, reset_token=NULL, reset_expires=NULL WHERE id=$2", [hash, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ===== Catch-All & Initialization =====
app.get("*", cacheMiddleware, (req, res) => {
  if (req.path === "/robots.txt") return res.sendFile(path.join(__dirname, "robots.txt"));
  if (!serverReady) return res.sendFile(path.join(__dirname, "loading.html"));
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "Endpoint not found" });
  res.sendFile(path.join(__dirname, "index.html"));
});

// פתרון בעיית סדר האתחול: קודם יוצרים טבלאות, ורק אז מאפשרים כניסת קהל
async function initTables() {
  await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, fullname TEXT, username TEXT UNIQUE, email TEXT UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'pending', approved_by INTEGER REFERENCES users(id), reset_token TEXT, reset_expires TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), last_login TIMESTAMP)`);
  await db.query(`CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, region TEXT NOT NULL, message TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS shares (id SERIAL PRIMARY KEY, name TEXT NOT NULL, message TEXT NOT NULL, imageUrl TEXT, public_id TEXT, published BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW())`);
  await db.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS public_id TEXT;`);
  console.log("✅ Database and tables initialized.");
}

initTables()
  .then(() => {
    serverReady = true;
    app.listen(PORT, () => console.log(`🌸 Server running safely on port ${PORT}`));
  })
  .catch(err => {
    console.error("❌ Init error, starting anyway:", err.stack);
    serverReady = true;
    app.listen(PORT, () => console.log(`🌸 Server started in fallback mode on port ${PORT}`));
  });
