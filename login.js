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

  //רישום משתמש
  const regForm = document.getElementById("register-form");
  const regMsg = document.getElementById("register-msg");
  const regErr = document.getElementById("register-err");

  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      regMsg.textContent = "";
      regErr.textContent = "";

      const fullname = document.getElementById("reg-fullname").value.trim();
      const username = document.getElementById("reg-username").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const password = document.getElementById("reg-password").value;
      const passwordConfirm = document.getElementById("reg-password-confirm").value;

      try {
        const res = await fetch("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullname, username, email, password, passwordConfirm })
        });
        const data = await res.json();
        if (!res.ok) {
          regErr.textContent = data.error || "שגיאה ברישום";
          return;
        }
        regMsg.textContent = data.message || "בקשה נשלחה";
        regForm.reset();
      } catch (err) {
        console.error("Register err:", err);
        regErr.textContent = "שגיאת שרת";
      }
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



