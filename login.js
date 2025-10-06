document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const errorMsg = document.getElementById("error-msg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      errorMsg.textContent = "אנא מלא שם משתמש וסיסמה";
      return;
    }

    try {
      const res = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = data.error || "שגיאה בהתחברות";
        return;
      }

      // שמירת הטוקן ב-sessionStorage
      sessionStorage.setItem("adminToken", data.token);

      // טעינת הדף המוגן עם fetch
      const htmlRes = await fetch("/admin.html", {
        headers: { "Authorization": "Bearer " + data.token }
      });

      if (!htmlRes.ok) {
        errorMsg.textContent = "אין גישה לעמוד Admin";
        return;
      }

      const html = await htmlRes.text();
      document.open();
      document.write(html);
      document.close();

    } catch (err) {
      console.error("Login error:", err);
      errorMsg.textContent = "שגיאה בשרת, נסה שוב";
    }
  });
});
