document.addEventListener("DOMContentLoaded", () => {
  const content = document.getElementById("admin-content");
  const errorDiv = document.getElementById("unauthorized");
  const logoutBtn = document.getElementById("logout-btn");
  const sharesContainer = document.getElementById("comment-cards");

  // ===== בדיקת טוקן =====
  async function checkToken() {
    const token = sessionStorage.getItem("adminToken");
    if (!token) return showError();

    try {
      const res = await fetch("/admin/verify-token", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      if (data.valid) {
        content.style.display = "flex";
        errorDiv.style.display = "none";
        loadShares();
      } else showError();
    } catch (err) {
      console.error("Token verification error:", err);
      showError();
    }
  }

  function showError() {
    errorDiv.style.display = "block";
    content.style.display = "none";
    setTimeout(() => {
      window.location.href = "/login.html";
    }, 2000);
  }

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("adminToken");
    window.location.href = "/login.html";
  });

  // ===== טעינת שיתופים =====
  async function loadShares() {
    const token = sessionStorage.getItem("adminToken");
    try {
      const res = await fetch("/admin/shares", {
        headers: { "Authorization": "Bearer " + token }
      });
      if (!res.ok) throw new Error("שגיאה בשליפת שיתופים");
      const shares = await res.json();
      renderShares(shares);
    } catch (err) {
      console.error("Error loading shares:", err);
    }
  }

  // ===== יצירת דיבים לכל שיתוף =====
  function renderShares(shares) {
    sharesContainer.innerHTML = "";

    shares.forEach(share => {
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

      // מאזינים לכפתורים
      if (share.published) {
        div.querySelector(".unpublish-btn").addEventListener("click", () => unpublishShare(div));
      } else {
        div.querySelector(".publish-btn").addEventListener("click", () => publishShare(div));
      }

      // מאזין למחיקה
      div.querySelector(".delete-btn").addEventListener("click", () => deleteShare(div));
    });
  }

  // ===== פרסום שיתוף =====
  async function publishShare(adminDiv) {
    const token = sessionStorage.getItem("adminToken");
    const id = adminDiv.dataset.id;
    try {
      const res = await fetch(`/admin/shares/publish/${id}`, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token }
      });
      if (!res.ok) throw new Error("שגיאה בפרסום השיתוף");

      addShareToWall({
        name: adminDiv.dataset.name,
        message: adminDiv.dataset.message,
        imageUrl: adminDiv.dataset.imageUrl
      });

      adminDiv.remove();
      showNotification("✅ השיתוף פורסם!");
    } catch (err) {
      console.error(err);
      alert("אירעה שגיאה בפרסום השיתוף");
    }
  }

  // ===== החזרת שיתוף ל"לא מפורסם" =====
  async function unpublishShare(adminDiv) {
    const token = sessionStorage.getItem("adminToken");
    const id = adminDiv.dataset.id;
    try {
      const res = await fetch(`/admin/shares/unpublish/${id}`, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token }
      });
      if (!res.ok) throw new Error("שגיאה בהחזרת השיתוף ללא מפורסם");

      loadShares();
      showNotification("⚠️ השיתוף חזר למצב לא מפורסם");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  // ===== מחיקת שיתוף =====
  async function deleteShare(adminDiv) {
    const token = sessionStorage.getItem("adminToken");
    const id = adminDiv.dataset.id;

    if (!confirm(" פעולה זו תמחק את השיתוף לצמיתות, האם את/ה בטוח בפעולה זו?")) return;

    try {
      const res = await fetch(`/admin/shares/${id}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
      });
      if (!res.ok) throw new Error("שגיאה במחיקת השיתוף");

      adminDiv.remove();
      showNotification("🗑️ השיתוף נמחק בהצלחה!");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  // ===== פונקציה להוספת שיתוף ל-massages-wall בצד לקוח =====
  function addShareToWall(share) {
    const wallContainer = document.querySelector(".massages-wall-cards");
    if (!wallContainer) return;

    const div = document.createElement("div");
    div.classList.add("massages-wall-card");
    div.innerHTML = `
      <div class="massages-wall-card-content">
        <div class="massages-wall-card-content-text">
          <h5>${share.name}</h5>
          <p>${share.message}</p>
        </div>
        <div class="massages-wall-card-img">
          <img src="${share.imageUrl || 'media/flowerman-logo.PNG'}" alt="" />
        </div>
      </div>
    `;
    wallContainer.prepend(div);
  }

  // ===== הפונקציה להצגת הודעת פופאפ למנהל =====
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

  checkToken();
});
