// init.js
import db from "./db.js";
import bcrypt from "bcrypt";

async function init() {
  try {
    // ===== Create Tables =====
    await db.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id SERIAL PRIMARY KEY,
        name TEXT,
        message TEXT,
        imageUrl TEXT,
        published BOOLEAN DEFAULT FALSE
      );
    `);

    console.log("✅ Tables ensured");

    // ===== Create default admin =====
    const defaultAdmin = process.env.ADMIN_USER || "admin";
    const defaultPass = process.env.ADMIN_PASS || "123456789";

    const result = await db.query("SELECT * FROM admins WHERE username=$1", [defaultAdmin]);
    if (result.rows.length === 0) {
      const hash = await bcrypt.hash(defaultPass, 10);
      await db.query("INSERT INTO admins (username, password) VALUES ($1, $2)", [defaultAdmin, hash]);
      console.log("✅ Default admin created!");
    } else {
      console.log("ℹ️ Admin already exists");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Init error:", err);
    process.exit(1);
  }
}

init();
