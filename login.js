document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const errorMsg = document.getElementById("error-msg");
  const newRegisterBtn = document.getElementById("new-register-btn");
const loginFormDiv = document.querySelector(".login-box");
const registerBoxDiv = document.querySelector(".register-box");

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

  
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.textContent = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    errorMsg.textContent = "אנא מלא שם משתמש וסיסמה";
    return;
  }

  try {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      errorMsg.textContent = data.error || "שגיאה בהתחברות";
      return;
    }

    // bootstrap admin flow (if ENV admin used)
    if (data.bootstrap) {
      // שמירת טוקן זמני כדי להשלים הגדרה ראשונית
      sessionStorage.setItem("bootstrapToken", data.token);
      // הפנה לדף setup שבו ימלא שם וסיסמה חדשים
      window.location.href = "/complete-setup.html";
      return;
    }

    // רגיל: שמירת הטוקן של המשתמש
    sessionStorage.setItem("userToken", data.token);

    // אם המשתמש מנהל/סופר־אדמין יכול לגשת ל־/admin.html
    window.location.href = "/admin.html?ts=" + new Date().getTime();
  } catch (err) {
    console.error("Login error:", err);
    errorMsg.textContent = "שגיאה בשרת, נסה שוב";
  }
});

// register-toggle.js


// בהתחלה נסתר את דיב הרישום
registerBoxDiv.style.display = "none";

// מאזין ללחיצה על הכפתור
newRegisterBtn.addEventListener("click", () => {
  // מסתיר את דיב הלוגין
  loginFormDiv.style.display = "none";

  // מראה את דיב הרישום
  registerBoxDiv.style.display = "block";
});


});



