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

// ===== User Management =====
let allUsersCache = [];

function getCurrentToken() {
  return sessionStorage.getItem("userToken");
}

function getCurrentRole() {
  const t = getCurrentToken();
  if (!t) return null;
  try {
    return JSON.parse(atob(t.split(".")[1])).role;
  } catch { return null; }
}

// הצגת/הסתרת כפתור ניהול לפי role
function setupManageUsersVisibility() {
  const role = getCurrentRole();
  const btn = document.getElementById("manage-users-btn");
  if (btn && (role === "admin" || role === "superadmin")) {
    btn.style.display = "block";
  }
}

// מילוי ה-dropdown
function populateUserSelect(users) {
  const select = document.getElementById("um-user-select");
  if (!select) return;
  select.innerHTML = '<option value="">-- בחר משתמש --</option>';
  users.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.fullname || u.username;
    select.appendChild(opt);
  });
}

// צבע avatar
function avatarColor(name) {
  const colors = ["#9B59B6","#e91e8c","#1abc9c","#3498db","#e67e22","#FF6B6B"];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
}

// badge לפי role
function roleBadgeClass(role) {
  return { pending:"badge-pending", user:"badge-user", admin:"badge-admin", superadmin:"badge-superadmin" }[role] || "badge-user";
}
function roleBadgeLabel(role) {
  return { pending:"ממתין", user:"משתמש", admin:"מנהל", superadmin:"Superadmin" }[role] || role;
}

// הצגת כרטיס משתמש
function showUserCard(user) {
  const card     = document.getElementById("um-user-card");
  const avatar   = document.getElementById("um-avatar");
  const fullname = document.getElementById("um-fullname");
  const uname    = document.getElementById("um-username-display");
  const badge    = document.getElementById("um-role-badge");
  const fFullname  = document.getElementById("um-edit-fullname");
  const fUsername  = document.getElementById("um-edit-username");
  const fEmail     = document.getElementById("um-edit-email");
  const fRole      = document.getElementById("um-edit-role");
  const feedback   = document.getElementById("um-feedback");
  const roleField  = document.getElementById("um-role-field");

  if (!card) return;

  const initial = (user.fullname || user.username || "?")[0];
  avatar.textContent = initial;
  avatar.style.background = avatarColor(user.fullname || user.username);
  fullname.textContent = user.fullname || "—";
  uname.textContent = "@" + user.username;
  badge.textContent = roleBadgeLabel(user.role);
  badge.className = "um-badge " + roleBadgeClass(user.role);

  fFullname.value = user.fullname || "";
  fUsername.value = user.username || "";
  fEmail.value    = user.email    || "";
  if (fRole) fRole.value = user.role || "user";
  if (feedback) { feedback.textContent = ""; feedback.className = "um-feedback"; }

  // superadmin לא יכול לשנות role של superadmin אחר
  const currentRole = getCurrentRole();
  if (roleField) {
    roleField.style.display = (currentRole === "superadmin") ? "flex" : "none";
  }

  // הסתרת אפשרות superadmin מ-admin רגיל
  if (fRole) {
    const superOpt = fRole.querySelector('option[value="superadmin"]');
    if (superOpt) superOpt.style.display = currentRole === "superadmin" ? "" : "none";
  }

  card.style.display = "flex";
  card.dataset.userId = user.id;
}

// טעינת כל המשתמשים
async function loadAllUsers() {
  try {
    const token = getCurrentToken();
    const res = await fetch(`${serverUrl}/admin/users/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      console.error("loadAllUsers failed:", res.status);
      return;
    }
    allUsersCache = await res.json();
    populateUserSelect(allUsersCache);

    // אם כרטיס כבר פתוח — רענן אותו
    const card = document.getElementById("um-user-card");
    if (card && card.style.display !== "none" && card.dataset.userId) {
      const u = allUsersCache.find(x => String(x.id) === card.dataset.userId);
      if (u) showUserCard(u);
    }
  } catch (err) {
    console.error("loadAllUsers error:", err);
  }
}

// שמירת שינויים
async function saveUserChanges() {
  const card = document.getElementById("um-user-card");
  const feedback = document.getElementById("um-feedback");
  if (!card || !card.dataset.userId) return;

  const id       = card.dataset.userId;
  const fullname = document.getElementById("um-edit-fullname")?.value.trim();
  const username = document.getElementById("um-edit-username")?.value.trim();
  const email    = document.getElementById("um-edit-email")?.value.trim();
  const role     = document.getElementById("um-edit-role")?.value;

  if (!fullname || !username) {
    feedback.textContent = "שם מלא ושם משתמש הם שדות חובה";
    feedback.className = "um-feedback error";
    return;
  }

  try {
    const token = getCurrentToken();
    const body = { fullname, username, email };
    if (getCurrentRole() === "superadmin" && role) body.role = role;

    const res = await fetch(`${serverUrl}/admin/users/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok) {
      feedback.textContent = "✅ הפרטים עודכנו בהצלחה";
      feedback.className = "um-feedback success";
      await loadAllUsers();
    } else {
      feedback.textContent = "❌ " + (data.error || "שגיאה בעדכון");
      feedback.className = "um-feedback error";
    }
  } catch (err) {
    console.error("saveUserChanges:", err);
    feedback.textContent = "❌ שגיאת רשת";
    feedback.className = "um-feedback error";
  }
}

// מחיקת משתמש
async function deleteUser() {
  const card = document.getElementById("um-user-card");
  if (!card || !card.dataset.userId) return;
  const id = card.dataset.userId;
  if (!confirm("למחוק את המשתמש לצמיתות?")) return;

  try {
    const token = getCurrentToken();
    const res = await fetch(`${serverUrl}/admin/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      card.style.display = "none";
      document.getElementById("um-user-select").value = "";
      showNotification("🗑️ המשתמש נמחק");
      await loadAllUsers();
    } else {
      const data = await res.json();
      alert(data.error || "שגיאה במחיקה");
    }
  } catch (err) {
    console.error("deleteUser:", err);
  }
}

// Event Listeners של ניהול משתמשים
const umSelect = document.getElementById("um-user-select");
if (umSelect) {
  umSelect.addEventListener("change", () => {
    const id = umSelect.value;
    if (!id) {
      const card = document.getElementById("um-user-card");
      if (card) card.style.display = "none";
      return;
    }
    const user = allUsersCache.find(u => String(u.id) === id);
    if (user) showUserCard(user);
  });
}

const umRefresh = document.getElementById("um-refresh-btn");
if (umRefresh) umRefresh.addEventListener("click", loadAllUsers);

const umSave = document.getElementById("um-save-btn");
if (umSave) umSave.addEventListener("click", saveUserChanges);

const umDelete = document.getElementById("um-delete-btn");
if (umDelete) umDelete.addEventListener("click", deleteUser);

// טעינה בלחיצה על סיידבר
document.querySelectorAll("#sidebar button").forEach(btn => {
  if (btn.dataset.target === "manage-users") {
    btn.addEventListener("click", loadAllUsers);
  }
});

    // ===== Start =====
    setupManageUsersVisibility();
    checkToken();
  });
}
