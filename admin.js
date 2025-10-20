// ✅ Admin Dashboard Script
if (!window.hasRunAdminScript) {
  window.hasRunAdminScript = true;

  document.addEventListener("DOMContentLoaded", () => {
    const content = document.getElementById("admin-content");
    const errorDiv = document.getElementById("unauthorized");
    const logoutBtn = document.getElementById("logout-btn");
    const sharesContainer = document.getElementById("comment-cards");
    const contactsContainer = document.getElementById("contacts-list");
    const uploadFiles = document.getElementById("upload-files");
    const uploadBtn = document.getElementById("upload-btn");
    const uploadTag = document.getElementById("upload-tag");
    const uploadStatus = document.getElementById("upload-status");
    const clearFileBtn = document.getElementById("clear-file");

    // ===== העלאת קבצים =====
    if (uploadBtn) {
      uploadBtn.addEventListener("click", async () => {
        const files = uploadFiles.files;
        const tag = uploadTag.value;
        if (!files.length) return alert("בחר קבצים להעלאה");

        const formData = new FormData();
        for (const file of files) formData.append("files", file);
        formData.append("tag", tag);

        const token = sessionStorage.getItem("adminToken");
        try {
          uploadStatus.textContent = "⏳ מעלה קבצים...";
          const res = await fetch("/upload-with-tag", {
            method: "POST",
            headers: { "Authorization": "Bearer " + token },
            body: formData
          });

          const data = await res.json();
          if (data.success) {
            uploadStatus.textContent = `✅ הועלו ${data.files.length} קבצים בהצלחה!`;
            uploadFiles.value = "";
            clearFileBtn.style.display = "none";
          } else {
            uploadStatus.textContent = "❌ שגיאה בהעלאה";
            console.error(data);
          }
        } catch (err) {
          uploadStatus.textContent = "❌ שגיאה בהעלאה";
          console.error(err);
        }
      });

      clearFileBtn.addEventListener("click", () => {
        uploadFiles.value = "";
        uploadStatus.textContent = "";
        clearFileBtn.style.display = "none";
      });

      uploadFiles.addEventListener("change", () => {
        if (uploadFiles.files.length) clearFileBtn.style.display = "inline";
      });
    }

    // ===== בדיקת טוקן =====
    async function checkToken() {
      const token = sessionStorage.getItem("adminToken");
      if (!token) return showError("אין טוקן");

      try {
        const res = await fetch("/admin/verify-token", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
          }
        });

        if (!res.ok) return showError("שגיאה בשרת");
        const data = await res.json();

        if (data.valid) {
          content.style.display = "flex";
          errorDiv.style.display = "none";
          loadShares(token);
          loadContacts(token);
        } else {
          showError("טוקן לא תקין");
        }
      } catch (err) {
        console.error("Token verification error:", err);
        showError("שגיאה ברשת");
      }
    }

    function showError(reason) {
      console.warn("Unauthorized:", reason);
      content.style.display = "none";
      errorDiv.style.display = "block";
    }

    // ===== התנתקות =====
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("adminToken");
        window.location.replace("/index.html");
      });
    }

    // ===== שליפת שיתופים =====
    async function loadShares(token) {
      if (!sharesContainer) return;
      try {
        const res = await fetch("/admin/shares?" + Date.now(), {
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

      if (share.published)
        div.querySelector(".unpublish-btn").addEventListener("click", () => unpublishShare(div));
      else
        div.querySelector(".publish-btn").addEventListener("click", () => publishShare(div));

      div.querySelector(".delete-btn").addEventListener("click", () => deleteShare(div));
    }

    async function publishShare(div) {
      const token = sessionStorage.getItem("adminToken");
      try {
        const res = await fetch(`/admin/shares/publish/${div.dataset.id}`, {
          method: "POST",
          headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) throw new Error("שגיאה בפרסום השיתוף");
        loadShares(token);
        showNotification("✅ השיתוף פורסם!");
      } catch (err) {
        console.error(err);
        alert("אירעה שגיאה בפרסום השיתוף");
      }
    }

    async function unpublishShare(div) {
      const token = sessionStorage.getItem("adminToken");
      try {
        const res = await fetch(`/admin/shares/unpublish/${div.dataset.id}`, {
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
      const token = sessionStorage.getItem("adminToken");
      if (!confirm("למחוק את השיתוף לצמיתות?")) return;
      try {
        const res = await fetch(`/admin/shares/${div.dataset.id}`, {
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

    // ===== פניות =====
async function loadContacts(token) {
  console.log("📥 מתחיל לטעון פניות...");

  const contactsContainer = document.getElementById("contacts-list");
  if (!contactsContainer) {
    console.error("❌ לא נמצא האלמנט contacts-list ב־HTML!");
    return;
  }
  console.log("✅ contactsContainer נמצא:", contactsContainer);

  try {
    const res = await fetch("/admin/contacts", {
      headers: { Authorization: "Bearer " + token },
    });

    console.log("HTTP status:", res.status);
    if (!res.ok) throw new Error("שגיאה בשליפת הפניות מהשרת");

    const contacts = await res.json();
    console.log("Fetched contacts:", contacts);

    contactsContainer.innerHTML = "";

    if (!contacts || contacts.length === 0) {
      console.warn("⚠️ לא נמצאו פניות");
      const emptyMsg = document.createElement("p");
      emptyMsg.textContent = "לא נמצאו פניות";
      emptyMsg.className = "empty-message";
      contactsContainer.appendChild(emptyMsg);
      return;
    }

    contacts.forEach(contact => {
      console.log("Rendering contact:", contact);

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
            const delRes = await fetch(`/admin/contacts/${contact.id}`, {
              method: "DELETE",
              headers: { Authorization: "Bearer " + token },
            });
            if (!delRes.ok) throw new Error("שגיאה במחיקת הפנייה");
            div.remove();
            console.log("🗑️ הפנייה נמחקה בהצלחה:", contact.id);
          } catch (err) {
            console.error("Error deleting contact:", err);
          }
        });
      } else {
        console.warn("❌ לא נמצא כפתור המחיקה לפנייה:", contact.id);
      }
    });
  } catch (err) {
    console.error("Error loading contacts:", err);
    contactsContainer.innerHTML = "<p>❌ שגיאה בשליפת הפניות</p>";
  }
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





