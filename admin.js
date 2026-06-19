// ✅ Admin Unified Script
if (!window.hasRunAdminUnified) {
  window.hasRunAdminUnified = true;

  document.addEventListener("DOMContentLoaded", () => {
    const serverUrl = "https://flowerman.onrender.com";
    const content = document.getElementById("admin-content");
    const errorDiv = document.getElementById("unauthorized");
    const logoutBtn = document.getElementById("logout-btn");
    const sharesContainer = document.getElementById("comment-cards");
    const contactsContainer = document.getElementById("contacts-list");
    const wallContainer = document.querySelector(".messages-wall-cards");

    // Upload Elements
    const uploadFiles = document.getElementById("upload-files");
    const uploadBtn = document.getElementById("upload-btn");
    const uploadTag = document.getElementById("upload-tag");
    const uploadStatus = document.getElementById("upload-status");
    const clearFileBtn = document.getElementById("clear-file");

    // Sidebar
    const buttons = document.querySelectorAll("#sidebar button");
    const sections = document.querySelectorAll(".section");

    // ===== Functions =====
    function showNotification(text) {
      const notif = document.createElement("div");
      notif.textContent = text;
      notif.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: #4caf50; color: white;
        padding: 10px 20px; border-radius: 5px;
        z-index: 9999;
      `;
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 2000);
    }

    function showError(reason) {
      console.warn("Unauthorized:", reason);
      if (content) content.style.display = "none";
      if (errorDiv) errorDiv.style.display = "block";
    }

   async function checkToken() {
      const token = sessionStorage.getItem("userToken");
      if (!token) return showError("אין טוקן");

      try {
        const res = await fetch(`${serverUrl}/admin/verify-token`, {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
          }
        });
        if (!res.ok) return showError("שגיאה בשרת");
        const data = await res.json();
       if (data.valid) {
        const payload = JSON.parse(atob(token.split(".")[1]));
      
        if (!["admin", "superadmin"].includes(payload.role)) {
          return showError("אין הרשאות");
        }
      
        if (content) content.style.display = "flex";
        if (errorDiv) errorDiv.style.display = "none";
      
        loadShares(token);
        loadContacts(token);
        loadPendingUsers();
        } else showError("טוקן לא תקין");
      } catch (err) {
        console.error("Token verification error:", err);
        showError("שגיאה ברשת");
      }
    }

    // ===== Logout =====
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("userToken");
        window.location.replace("/index.html");
      });
    }

    // ===== Sidebar Navigation =====
    if (buttons && sections) {
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          const target = btn.dataset.target;
          if (!target) return;
          sections.forEach(sec => sec.classList.remove("active"));
          const targetSection = document.getElementById(target);
          if (targetSection) targetSection.classList.add("active");
        });
      });
    }

    // ===== Shares =====
    async function loadShares(token) {
      if (!sharesContainer) return;
      try {
        const res = await fetch(`${serverUrl}/admin/shares?${Date.now()}`, {
          headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) throw new Error("שגיאה בשליפת שיתופים");
        const shares = await res.json();
        sharesContainer.innerHTML = "";
        if (!shares || shares.length === 0) {
          const emptyMsg = document.createElement("p");
          emptyMsg.textContent = "לא נמצאו שיתופים";
          emptyMsg.className = "empty-message";
          sharesContainer.appendChild(emptyMsg);
          return;
        }
        shares.forEach(renderShare);
      } catch (err) {
        console.error("Error loading shares:", err);
        sharesContainer.innerHTML = "<p>שגיאה בשליפת שיתופים</p>";
      }
    }

    function renderShare(share) {
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
    }

    async function publishShare(div) {
      const token = sessionStorage.getItem("userToken");
      try {
        const res = await fetch(`${serverUrl}/admin/shares/publish/${div.dataset.id}`, {
          method: "POST",
          headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) throw new Error("שגיאה בפרסום השיתוף");
        addShareToWall({
          name: div.dataset.name,
          message: div.dataset.message,
          imageUrl: div.dataset.imageUrl
        });
        div.remove();
        showNotification("✅ השיתוף פורסם!");
      } catch (err) {
        console.error(err);
        alert(err.message || "שגיאה בפרסום");
      }
    }

    async function unpublishShare(div) {
      const token = sessionStorage.getItem("userToken");
      try {
        const res = await fetch(`${serverUrl}/admin/shares/unpublish/${div.dataset.id}`, {
          method: "POST",
          headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) throw new Error("שגיאה בביטול פרסום");
        loadShares(token);
        showNotification("⚠️ השיתוף חזר למצב לא מפורסם");
      } catch (err) {
        console.error(err);
        alert(err.message);
      }
    }

    async function deleteShare(div) {
      const token = sessionStorage.getItem("userToken");
      if (!confirm("למחוק את השיתוף לצמיתות?")) return;
      try {
        const res = await fetch(`${serverUrl}/admin/shares/${div.dataset.id}`, {
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

    // ===== Contacts =====
    async function loadContacts(token) {
      if (!contactsContainer) return;
      try {
        const res = await fetch(`${serverUrl}/admin/contacts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("שגיאה בשליפת הפניות");
        const contacts = await res.json();
        contactsContainer.innerHTML = "";
        if (!contacts || contacts.length === 0) {
          const emptyMsg = document.createElement("p");
          emptyMsg.textContent = "לא נמצאו פניות";
          emptyMsg.className = "empty-message";
          contactsContainer.appendChild(emptyMsg);
          return;
        }
        contacts.forEach(contact => {
          const div = document.createElement("div");
          div.className = "contact-card";
          div.innerHTML = `
            <p><strong>שם:</strong> ${contact.name}</p>
            <p><strong>טלפון:</strong> ${contact.phone}</p>
            <p><strong>אזור:</strong> ${contact.region}</p>
            <p><strong>הודעה:</strong> ${contact.message}</p>
            <button class="delete-contact-btn">סמן כטופל ומחק</button>
          `;
          contactsContainer.appendChild(div);
          const deleteBtn = div.querySelector(".delete-contact-btn");
          if (deleteBtn) {
            deleteBtn.addEventListener("click", async () => {
              if (!confirm("להסיר את הפנייה?")) return;
              try {
                const delRes = await fetch(`${serverUrl}/admin/contacts/${contact.id}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (!delRes.ok) throw new Error("שגיאה במחיקה");
                div.remove();
                showNotification("🗑️ הפנייה נמחקה בהצלחה!");
              } catch (err) { console.error(err); }
            });
          }
        });
      } catch (err) {
        console.error(err);
        contactsContainer.innerHTML = "<p>❌ שגיאה בשליפת הפניות</p>";
      }
    }

    // ===== Pending Users =====
    async function loadPendingUsers() {
      try {
        const token = sessionStorage.getItem("userToken");
        const res = await fetch(`${serverUrl}/admin/users/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const container = document.getElementById("pending-users-list");
        if (!container) return;
        container.innerHTML = "";
        if (!res.ok) { container.textContent = data.error || "שגיאה"; return; }
        if (data.length === 0) { container.textContent = "אין בקשות"; return; }

        for (const u of data) {
          const el = document.createElement("div");
          el.className = "pending-user";
          el.innerHTML = `
            <strong>${u.fullname}</strong> (${u.username}) ${u.email ? '- ' + u.email : ''}
            <button data-id="${u.id}" class="approve-btn">אשר</button>
            <button data-id="${u.id}" class="reject-btn">דחה</button>
          `;
          container.appendChild(el);
        }

        container.querySelectorAll(".approve-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            await actionApprove(btn.dataset.id);
            loadPendingUsers();
          });
        });
        container.querySelectorAll(".reject-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            await actionReject(btn.dataset.id);
            loadPendingUsers();
          });
        });

      } catch (err) { console.error(err); }
    }

    async function actionApprove(id) {
      const token = sessionStorage.getItem("userToken");
      const res = await fetch(`${serverUrl}/admin/users/approve/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "שגיאה באישור");
      } else alert("המשתמש אושר");
    }

    async function actionReject(id) {
      const token = sessionStorage.getItem("userToken");
      const res = await fetch(`${serverUrl}/admin/users/reject/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "שגיאה");
      } else alert("בקשה נדחתה");
    }

    // ===== Upload =====
    if (uploadBtn && uploadFiles && uploadTag && uploadStatus) {
      uploadBtn.addEventListener("click", async () => {
        const files = uploadFiles.files;
        const tag = uploadTag.value.trim();
        if (!files.length || !tag) return alert("אנא מלא תג ובחר קבצים");
        const token = sessionStorage.getItem("userToken");
        const formData = new FormData();
        for (const f of files) formData.append("files", f);
        formData.append("tag", tag);

        try {
          uploadStatus.textContent = "⏳ מעלה קבצים...";
          const res = await fetch(`${serverUrl}/upload-with-tag`, {
            method: "POST",
            headers: { "Authorization": "Bearer " + token },
            body: formData
          });
          const data = await res.json();
          if (data.success) {
            uploadStatus.textContent = `✅ הועלו ${data.files.length} קבצים בהצלחה!`;
            uploadFiles.value = "";
            if (clearFileBtn) clearFileBtn.style.display = "none";
          } else {
            uploadStatus.textContent = "❌ שגיאה בהעלאה";
            console.error(data);
          }
        } catch (err) {
          uploadStatus.textContent = "❌ שגיאה בהעלאה";
          console.error(err);
        }
      });

      if (clearFileBtn) {
        clearFileBtn.addEventListener("click", () => {
          uploadFiles.value = "";
          uploadStatus.textContent = "";
          clearFileBtn.style.display = "none";
        });
      }

      uploadFiles.addEventListener("change", () => {
        if (uploadFiles.files.length && clearFileBtn) clearFileBtn.style.display = "inline";
      });
    }

    // ===== Start =====
    checkToken();
  });
}
