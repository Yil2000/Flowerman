// db.js
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
dotenv.config();

// Pool לניהול חיבורים אוטומטי
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Wrapper ל־queries
const db = {
  query: (text, params) => pool.query(text, params)
};

// Test connection on startup
pool.connect()
  .then(client => {
    console.log("✅ Connected to PostgreSQL DB");
    client.release(); // שחרור החיבור מיד
  })
  .catch(err => console.error("❌ DB connection error:", err));

export default db;
