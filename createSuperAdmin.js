// createSuperAdmin.js
import dotenv from "dotenv";
import { Pool } from "pg";
import bcrypt from "bcrypt";

dotenv.config();

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const db = { query: (text, params) => pool.query(text, params) };

async function createSuperAdmin() {
  try {
    const fullname = "Admin";       // תוכל לשנות
    const username = "yannai";  // תוכל לשנות
    const password = "123456";      // תוכל לשנות
    const email = "yannai.iluz@gmail.com"; // אופציונלי

    // בודק אם כבר קיים משתמש עם username הזה
    const exists = await db.query("SELECT id FROM users WHERE username=$1", [username]);
    if (exists.rows.length > 0) {
      console.log("❌ משתמש עם username זה כבר קיים!");
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await db.query(
      `INSERT INTO users (fullname, username, email, password_hash, role) 
       VALUES ($1,$2,$3,$4,'superadmin') RETURNING id, username, role`,
      [fullname, username, email, hash]
    );

    console.log("✅ סופר אדמין נוצר בהצלחה:", result.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error("❌ שגיאה ביצירת סופר אדמין:", err.stack);
    process.exit(1);
  }
}

createSuperAdmin();
