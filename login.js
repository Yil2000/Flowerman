document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const errorMsg = document.getElementById("error-msg");

  // ===== Show / Hide Password =====
  const passwordInput = document.getElementById("password");
  const showPassBtn = document.getElementById("show-pass-btn");

  if (showPassBtn && passwordInput) {
    showPassBtn.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";

      // שינוי סוג השדה
      passwordInput.type = isHidden ? "text" : "password";

      // שינוי האייקון
      showPassBtn.classList.toggle("fa-eye", isHidden);
      showPassBtn.classList.toggle("fa-eye-slash", !isHidden);
    });
  }

  // ===== Login Form =====
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
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = data.error || "שגיאה בהתחברות";
        return;
      }

      // שמירת הטוקן
      sessionStorage.setItem("adminToken", data.token);

      // הפניה ישירה לעמוד האדמין
      window.location.href = "/admin.html?ts=" + new Date().getTime();

    } catch (err) {
      console.error("Login error:", err);
      errorMsg.textContent = "שגיאה בשרת, נסה שוב";
    }
  });
});
