// createSuperAdmin.js
import bcrypt from "bcrypt";
import { Client } from "pg"; // אם אתה משתמש ב-PostgreSQL

// === הגדרות מסד ===
const client = new Client({
  user: "your_db_user",
  host: "localhost",        // או host של השרת
  database: "your_db_name",
  password: "your_db_password",
  port: 5432,
});

async function main() {
  await client.connect();

  const username = "superadmin";     // שם המשתמש שתרצה
  const password = "123456";         // הסיסמה הגולמית
  const email = "superadmin@example.com";
  const fullname = "Super Admin";

  // hash לסיסמה
  const hashedPassword = await bcrypt.hash(password, 10);

  // הכנס למסד
  try {
    const res = await client.query(
      `INSERT INTO users (username, fullname, email, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, role`,
      [username, fullname, email, hashedPassword, "superadmin"]
    );
    console.log("Superadmin נוצר בהצלחה:", res.rows[0]);
  } catch (err) {
    console.error("שגיאה ביצירת סופר אדמין:", err.message);
  } finally {
    await client.end();
  }
}

main();
