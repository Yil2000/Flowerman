document.addEventListener("DOMContentLoaded", () => {
  const content = document.getElementById("admin-content");
  const errorDiv = document.getElementById("unauthorized");
  const logoutBtn = document.getElementById("logout-btn");
  const sharesContainer = document.getElementById("comment-cards");
  const contactsContainer = document.getElementById("contacts-container");

  if (!sharesContainer) console.error("sharesContainer לא נמצא! בדוק את האלמנט HTML עם id='comment-cards'");
  if (!contactsContainer) console.error("contactsContainer לא נמצא! בדוק את האלמנט HTML עם id='contacts-container'");

  // ===== בדיקת טוקן =====
  async function checkToken() {
    const token = sessionStorage.getItem("adminToken");
    if (!token) return showError("אין טוקן");

    try {
      const res = await fetch("/admin/verify-token", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" }
      });
      if (!res.ok) return showError("שגיאה בשרת");

      const data = await res.json();
      if (data.valid) {
        content.style.display = "flex";
        errorDiv.style.display = "none";
        loadShares();
        loadContacts();
      } else {
        showError("טוקן לא תקין");
      }
    } catch (err) {
      console.error("Token verification error:", err);
      showError("שגיאה ברשת");
    }
  }

  // ===== הצגת הודעת שגיאה =====
  function showError(reason) {
    console.warn("Unauthorized:", reason);
    content.style.display = "none";
    errorDiv.style.display = "block";
  }

  // ===== התנתקות =====
  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("adminToken");
    window.location.href = "/index.html";
  });

  // ===== טעינת שיתופים =====
  async function loadShares() {
    const token = sessionStorage.getItem("adminToken");
    if (!sharesContainer) return;

    try {
      const res = await fetch("/admin/shares?" + Date.now(), { headers: { "Authorization": "Bearer " + token } });
      if (!res.ok) throw new Error("שגיאה בשליפת שיתופים");

      const shares = await res.json();
      sharesContainer.innerHTML = "";

      if (!shares || shares.length === 0) {
        sharesContainer.innerHTML = "<p>לא נמצאו שיתופים</p>";
        return;
      }

      shares.forEach(renderShare);
    } catch (err) {
      console.error("Error loading shares:", err);
      sharesContainer.innerHTML = "<p>שגיאה בשליפת שיתופים</p>";
    }
  }

  // ===== יצירת דיב לשיתוף =====
  function renderShare(share) {
    const div = document.createElement("div");
    div.classList.add("comment-card");
    div.dataset.id = share.id;
    div.dataset.name = share.name;
    div.dataset.message = share.message;
    div.dataset.imageUrl = share.imageUrl || "";

    div.innerHTML = `
      <h3 class="share-name">${share.name}</h3>
      <p class="share-message">${share.message}</p>
      ${share.imageUrl ? `<img class="share-image" src="${share.imageUrl}" alt="תמונה">` : ""}
      <div class="share-actions">
        ${share.published
          ? `<button class="unpublish-btn">בטל פרסום</button>`
          : `<button class="publish-btn">פרסם</button>`}
        <button class="delete-btn" title="מחק שיתוף">🗑️</button>
      </div>
    `;

    sharesContainer.appendChild(div);

    if (share.published) div.querySelector(".unpublish-btn").addEventListener("click", () => unpublishShare(div));
    else div.querySelector(".publish-btn").addEventListener("click", () => publishShare(div));

    div.querySelector(".delete-btn").addEventListener("click", () => deleteShare(div));
  }

  // ===== פרסום שיתוף =====
  async function publishShare(div) {
    const token = sessionStorage.getItem("adminToken");
    try {
      const res = await fetch(`/admin/shares/publish/${div.dataset.id}`, { method: "POST", headers: { "Authorization": "Bearer " + token } });
      if (!res.ok) throw new Error("שגיאה בפרסום השיתוף");

      // הסר מה-admin בלבד
      div.remove();
      showNotification("✅ השיתוף פורסם!");
    } catch (err) {
      console.error(err);
      alert("אירעה שגיאה בפרסום השיתוף");
    }
  }

  // ===== ביטול פרסום =====
  async function unpublishShare(div) {
    const token = sessionStorage.getItem("adminToken");
    try {
      const res = await fetch(`/admin/shares/unpublish/${div.dataset.id}`, { method: "POST", headers: { "Authorization": "Bearer " + token } });
      if (!res.ok) throw new Error("שגיאה בביטול פרסום");

      loadShares();
      showNotification("⚠️ השיתוף חזר למצב לא מפורסם");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  // ===== מחיקת שיתוף =====
  async function deleteShare(div) {
    const token = sessionStorage.getItem("adminToken");
    if (!confirm("פעולה זו תמחק את השיתוף לצמיתות, האם את/ה בטוח/ה?")) return;

    try {
      const res = await fetch(`/admin/shares/${div.dataset.id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
      if (!res.ok) throw new Error("שגיאה במחיקת השיתוף");

      div.remove();
      showNotification("🗑️ השיתוף נמחק בהצלחה!");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  // ===== טעינת פניות =====
  async function loadContacts() {
    const token = sessionStorage.getItem("adminToken");
    if (!contactsContainer) return;

    try {
      const res = await fetch("/admin/contacts?" + Date.now(), { headers: { "Authorization": "Bearer " + token } });
      if (!res.ok) throw new Error("שגיאה בשליפת הפניות");

      const contacts = await res.json();
      contactsContainer.innerHTML = "";

      if (!contacts || contacts.length === 0) {
        contactsContainer.innerHTML = "<p>אין טפסים זמינים להצגה</p>";
        return;
      }

      contacts.forEach(contact => {
        const div = document.createElement("div");
        div.classList.add("contact-card");
        div.dataset.id = contact.id;
        div.innerHTML = `
          <p><strong>שם:</strong> ${contact.name}</p>
          <p><strong>טלפון:</strong> ${contact.phone}</p>
          <p><strong>אזור:</strong> ${contact.region}</p>
          <p><strong>הודעה:</strong> ${contact.message}</p>
          <button class="delete-contact-btn">סמן כטופל ומחק</button>
        `;
        contactsContainer.appendChild(div);
        div.querySelector(".delete-contact-btn").addEventListener("click", () => deleteContact(div));
      });
    } catch (err) {
      console.error(err);
      contactsContainer.innerHTML = "<p>שגיאה בטעינת הפניות</p>";
    }
  }

  // ===== מחיקת פנייה =====
  async function deleteContact(div) {
    const token = sessionStorage.getItem("adminToken");
    if (!confirm("פעולה זו תמחק את הפנייה לצמיתות, האם את/ה בטוח/ה?")) return;

    try {
      const res = await fetch(`/admin/contacts/${div.dataset.id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
      if (!res.ok) throw new Error("שגיאה במחיקת הפנייה");

      div.remove();
      showNotification("🗑️ הפנייה נמחקה בהצלחה!");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  // ===== הצגת Notification =====
  function showNotification(text) {
    const notif = document.createElement("div");
    notif.textContent = text;
    notif.style.position = "fixed";
    notif.style.top = "20px";
    notif.style.right = "20px";
    notif.style.background = "#4caf50";
    notif.style.color = "white";
    notif.style.padding = "10px 20px";
    notif.style.borderRadius = "5px";
    notif.style.zIndex = "9999";
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 2000);
  }

  // ===== הפעלת הכל =====
  checkToken();
});
