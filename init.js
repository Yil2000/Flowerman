import db, { isPostgres } from "./db.js";
import bcrypt from "bcrypt";

export async function createDefaultAdmin() {
  const defaultAdmin =  process.env.ADMIN_USER;
  const defaultPass = process.env.ADMIN_PASS;

  let row;
  if (isPostgres) {
    const result = await db.query("SELECT * FROM admins WHERE username=$1", [defaultAdmin]);
    row = result.rows[0];
  } else {
    row = await db.getAsync("SELECT * FROM admins WHERE username=?", [defaultAdmin]);
  }

  if (!row) {
    const hash = await bcrypt.hash(defaultPass, 10);
    if (isPostgres) {
      await db.query("INSERT INTO admins (username, password) VALUES ($1, $2)", [defaultAdmin, hash]);
    } else {
      await db.runAsync("INSERT INTO admins (username, password) VALUES (?, ?)", [defaultAdmin, hash]);
    }
    console.log("✅ Default admin created!");
  }
}
