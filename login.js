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
    
    // רגיל: שמירת הטוקן של המשתמש
    sessionStorage.setItem("userToken", data.token);

    // אם המשתמש מנהל/סופר־אדמין יכול לגשת ל־/admin.html
    if (data.user.role === "admin" || data.user.role === "superadmin" || data.user.role === "user") {
      window.location.href = "/admin.html?ts=" + new Date().getTime();
    } else {
      window.location.href = "/index.html";
    }
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

  // ===== Register =====
const registerForm = document.getElementById("register-form");
const registerMsg = document.getElementById("register-msg");
const registerErr = document.getElementById("register-err");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    registerMsg.textContent = "";
    registerErr.textContent = "";

    const fullname = document.getElementById("reg-fullname").value.trim();
    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value.trim();

    if (!fullname || !username || !password) {
      registerErr.textContent = "אנא מלא את כל השדות החובה";
      return;
    }

    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullname,
          username,
          email,
          password,
          passwordConfirm: password // כי אין לך שדה confirm בטופס
        })
      });

      const data = await res.json();

      if (!res.ok) {
        registerErr.textContent = data.error || "שגיאה בהרשמה";
        return;
      }

      registerMsg.textContent = data.message;

      // איפוס טופס
      registerForm.reset();

      // אחרי 2 שניות חוזר ללוגין
      setTimeout(() => {
        registerBoxDiv.style.display = "none";
        loginFormDiv.style.display = "block";
      }, 2000);

    } catch (err) {
      console.error("Register error:", err);
      registerErr.textContent = "שגיאה בשרת, נסה שוב";
    }
  });
}


});



