import sqlite3 from "sqlite3";
import pkg from "pg";
const { Client } = pkg;

let db;
let isPostgres = false;

if (process.env.NODE_ENV === "production") {
  // PostgreSQL
  isPostgres = true;
  db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();
  console.log("✅ Connected to PostgreSQL DB");
} else {
  // SQLite
  const sqlite = sqlite3.verbose();
  db = new sqlite.Database("./database.sqlite", (err) => {
    if (err) console.error("SQLite error:", err.message);
    else console.log("✅ Connected to SQLite DB");
  });

  // פונקציות async עבור SQLite
  db.getAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
  };

  db.allAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
  };

  db.runAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };
}

export default db;
export { isPostgres };
