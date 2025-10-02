// db.js
import pkg from "pg";
const { Client } = pkg;
import dotenv from "dotenv";
dotenv.config();

const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

await db.connect();
console.log("✅ Connected to PostgreSQL DB");

export default db;
