document.addEventListener("DOMContentLoaded", () => {
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
});
