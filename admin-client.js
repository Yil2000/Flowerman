// ✅ Client-side Admin Helper (Front-end)
if (!window.hasRunAdminClient) {
  window.hasRunAdminClient = true;

  document.addEventListener("DOMContentLoaded", () => {
    const serverUrl = "https://flowerman.onrender.com";
    const sharesContainer = document.getElementById("comment-cards");
    const logoutBtn = document.getElementById("logout-btn");
    const content = document.getElementById("admin-content");
    const errorDiv = document.getElementById("unauthorized");
    const wallContainer = document.querySelector(".messages-wall-cards"); // קיר ההודעות של המשתמשים

    async function checkToken() {
      const token = sessionStorage.getItem("adminToken");
      if (!token) return showError("אין טוקן");

      try {
        const res = await fetch(`${serverUrl}/admin/verify-token`, {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
          }
        });

        if (!res.ok) return showError("טוקן לא תקין");

        const data = await res.json();
        if (data.valid) {
          if (content) content.style.display = "flex";
          if (errorDiv) errorDiv.style.display = "none";
          if (sharesContainer) loadShares();
        } else showError("טוקן לא תקין");
      } catch (err) {
        console.error(err);
        showError("שגיאה ברשת");
      }
    }

    function showError(reason) {
      console.warn("Unauthorized:", reason);
      if (content) content.style.display = "none";
      if (errorDiv) errorDiv.style.display = "block";
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("adminToken");
        window.location.href = "/login.html";
      });
    }

    async function loadShares() {
      const token = sessionStorage.getItem("adminToken");
      if (!sharesContainer) return;

      try {
        const res = await fetch(`${serverUrl}/admin/shares?` + Date.now(), {
          headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) throw new Error("שגיאה בשליפת שיתופים");

        const shares = await res.json();
        renderShares(shares);
      } catch (err) {
        console.error("Error loading shares:", err);
        sharesContainer.innerHTML = "<p>שגיאה בשליפת שיתופים</p>";
      }
    }

    function renderShares(shares) {
      sharesContainer.innerHTML = "";
      shares.forEach(share => {
        const div = document.createElement("div");
        div.classList.add("comment-card");
        div.dataset.id = share.id;
        div.dataset.name = share.name;
        div.dataset.message = share.message;
        div.dataset.imageUrl = share.imageurl || "";

        div.innerHTML = `
          <h3 class="share-name">${share.name}</h3>
          <p class="share-message">${share.message}</p>
          ${share.imageurl ? `<img class="share-image" src="${share.imageurl}" alt="תמונה">` : ""}
          <div class="share-actions">
            ${share.published
              ? `<button class="unpublish-btn">בטל פרסום</button>`
              : `<button class="publish-btn">פרסם</button>`}
            <button class="delete-btn" title="מחק שיתוף">🗑️</button>
          </div>
        `;

        sharesContainer.appendChild(div);

        const publishBtn = div.querySelector(".publish-btn");
        const unpublishBtn = div.querySelector(".unpublish-btn");
        const deleteBtn = div.querySelector(".delete-btn");

        if (publishBtn) publishBtn.addEventListener("click", () => publishShare(div));
        if (unpublishBtn) unpublishBtn.addEventListener("click", () => unpublishShare(div));
        if (deleteBtn) deleteBtn.addEventListener("click", () => deleteShare(div));
      });
    }

    // ===== פרסום שיתוף עם עדכון מידי למשתמשים =====
    async function publishShare(div) {
      const token = sessionStorage.getItem("adminToken");
      const id = div.dataset.id;
      try {
        const res = await fetch(`${serverUrl}/admin/shares/publish/${id}`, {
          method: "POST",
          headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) throw new Error("שגיאה בפרסום השיתוף");

        // ✅ עדכון מידי בקיר המשתמשים
        addShareToWall({
          name: div.dataset.name,
          message: div.dataset.message,
          imageUrl: div.dataset.imageUrl
        });

        div.remove();
        showNotification("✅ השיתוף פורסם!");
      } catch (err) {
        console.error(err);
        alert(err.message);
      }
    }

    async function unpublishShare(div) {
      const token = sessionStorage.getItem("adminToken");
      const id = div.dataset.id;
      try {
        const res = await fetch(`${serverUrl}/admin/shares/unpublish/${id}`, {
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

    async function deleteShare(div) {
      const token = sessionStorage.getItem("adminToken");
      const id = div.dataset.id;
      if (!confirm("למחוק את השיתוף לצמיתות?")) return;
      try {
        const res = await fetch(`${serverUrl}/admin/shares/${id}`, {
          method: "DELETE",
          headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) throw new Error("שגיאה במחיקת השיתוף");
        div.remove();
        showNotification("🗑️ השיתוף נמחק בהצלחה!");
      } catch (err) {
        console.error(err);
        alert(err.message);
      }
    }

    // ===== פונקציה להוספת שיתוף ל-wall של המשתמשים =====
    function addShareToWall(share) {
      if (!wallContainer) return;

      const div = document.createElement("div");
      div.classList.add("messages-wall-card");
      div.innerHTML = `
        <div class="messages-wall-card-content">
          <div class="messages-wall-card-content-text">
            <h5>${share.name}</h5>
            <p>${share.message}</p>
          </div>
          <div class="messages-wall-card-img">
            <img src="${share.imageUrl || 'media/flowerman-logo.PNG'}" alt="תמונה">
          </div>
        </div>
      `;
      wallContainer.prepend(div);
    }

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
}
