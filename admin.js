// ✅ Admin Unified Script
if (!window.hasRunAdminUnified) {
  window.hasRunAdminUnified = true;

  document.addEventListener("DOMContentLoaded", () => {
    const serverUrl = "https://flowerman.onrender.com";
    const content   = document.getElementById("admin-content");
    const errorDiv  = document.getElementById("unauthorized");

    const sharesContainer   = document.getElementById("comment-cards");
    const contactsContainer = document.getElementById("contacts-list");
    const wallContainer     = document.querySelector(".messages-wall-cards");

    // Upload
    const uploadFiles  = document.getElementById("upload-files");
    const uploadBtn    = document.getElementById("upload-btn");
    const uploadTag    = document.getElementById("upload-tag");
    const uploadStatus = document.getElementById("upload-status");
    const clearFileBtn = document.getElementById("clear-file");

    // Sidebar
    const sidebarButtons = document.querySelectorAll("#sidebar button");
    const sections       = document.querySelectorAll(".section");

    // =========================================================
    // helpers
    // =========================================================
    function getToken()      { return sessionStorage.getItem("userToken"); }
    function authHeader()    { return { Authorization: "Bearer " + getToken() }; }
    function jsonHeaders()   { return { ...authHeader(), "Content-Type": "application/json" }; }

    function getCurrentPayload() {
      const t = getToken();
      if (!t) return null;
      try { return JSON.parse(atob(t.split(".")[1])); } catch { return null; }
    }
    function getCurrentRole() { return getCurrentPayload()?.role || null; }
    function getCurrentId()   { return getCurrentPayload()?.id   || null; }

    function avatarColor(name) {
      const colors = ["#9B59B6","#e91e8c","#1abc9c","#3498db","#e67e22","#FF6B6B"];
      return colors[(name?.charCodeAt(0) || 0) % colors.length];
    }

    function roleBadgeClass(role) {
      return { pending:"badge-pending", user:"badge-user", admin:"badge-admin", superadmin:"badge-superadmin" }[role] || "badge-user";
    }
    function roleBadgeLabel(role) {
      return { pending:"ממתין", user:"משתמש", admin:"מנהל", superadmin:"Superadmin" }[role] || role;
    }

    function fmtDate(d) {
      if (!d) return "";
      return new Date(d).toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric" });
    }

    function showNotification(text, isError = false) {
      const notif = document.createElement("div");
      notif.textContent = text;
      notif.style.cssText = `
        position:fixed; top:20px; right:20px;
        background:${isError ? "#e74c3c" : "#4caf50"}; color:white;
        padding:10px 20px; border-radius:8px; z-index:9999;
        font-family:Arial,sans-serif; font-size:14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 2500);
    }

    function showError(reason) {
      console.warn("Unauthorized:", reason);
      if (content)  content.style.display  = "none";
      if (errorDiv) errorDiv.style.display = "block";
    }

    // =========================================================
    // Token check + init
    // =========================================================
    async function checkToken() {
      const token = getToken();
      if (!token) return showError("אין טוקן");

      try {
        const res  = await fetch(`${serverUrl}/admin/verify-token`, {
          method: "POST",
          headers: { ...authHeader(), "Content-Type": "application/json" }
        });
        if (!res.ok) return showError("שגיאה בשרת");
        const data = await res.json();

        if (!data.valid) return showError("טוקן לא תקין");

        const payload = getCurrentPayload();
        if (!payload || !["admin","superadmin"].includes(payload.role)) {
          return showError("אין הרשאות");
        }

        if (content)  content.style.display  = "flex";
        if (errorDiv) errorDiv.style.display = "none";

        // הצג כפתור ניהול משתמשים
        const manageBtn = document.getElementById("manage-users-btn");
        if (manageBtn) manageBtn.style.display = "block";

        loadShares(token);
        loadContacts(token);
        loadMyProfile();

      } catch (err) {
        console.error("Token verification error:", err);
        showError("שגיאה ברשת");
      }
    }

    // =========================================================
    // Logout
    // =========================================================
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("userToken");
        window.location.replace("/index.html");
      });
    }

    // =========================================================
    // Sidebar Navigation
    // =========================================================
    sidebarButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        if (!target) return;
        sections.forEach(sec => sec.classList.remove("active"));
        const targetSection = document.getElementById(target);
        if (targetSection) targetSection.classList.add("active");
        // טעינה בלחיצה
        if (target === "manage-users") loadManageUsers();
      });
    });

    // =========================================================
    // Shares
    // =========================================================
    async function loadShares(token) {
      if (!sharesContainer) return;
      try {
        const res = await fetch(`${serverUrl}/admin/shares?${Date.now()}`, {
          headers: authHeader()
        });
        if (!res.ok) throw new Error("שגיאה בשליפת שיתופים");
        const shares = await res.json();
        sharesContainer.innerHTML = "";
        if (!shares || shares.length === 0) {
          sharesContainer.innerHTML = "<p class='um-empty'>לא נמצאו שיתופים</p>";
          return;
        }
        shares.forEach(renderShare);
      } catch (err) {
        console.error(err);
        sharesContainer.innerHTML = "<p>שגיאה בשליפת שיתופים</p>";
      }
    }

    function renderShare(share) {
      const div = document.createElement("div");
      div.classList.add("comment-card");
      div.dataset.id       = share.id;
      div.dataset.name     = share.name;
      div.dataset.message  = share.message;
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
      const publishBtn   = div.querySelector(".publish-btn");
      const unpublishBtn = div.querySelector(".unpublish-btn");
      const deleteBtn    = div.querySelector(".delete-btn");
      if (publishBtn)   publishBtn.addEventListener("click",   () => publishShare(div));
      if (unpublishBtn) unpublishBtn.addEventListener("click", () => unpublishShare(div));
      if (deleteBtn)    deleteBtn.addEventListener("click",    () => deleteShare(div));
    }

    async function publishShare(div) {
      try {
        const res = await fetch(`${serverUrl}/admin/shares/publish/${div.dataset.id}`, {
          method: "POST", headers: authHeader()
        });
        if (!res.ok) throw new Error("שגיאה בפרסום השיתוף");
        addShareToWall({ name: div.dataset.name, message: div.dataset.message, imageUrl: div.dataset.imageUrl });
        div.remove();
        showNotification("✅ השיתוף פורסם!");
      } catch (err) { console.error(err); alert(err.message); }
    }

    async function unpublishShare(div) {
      try {
        const res = await fetch(`${serverUrl}/admin/shares/unpublish/${div.dataset.id}`, {
          method: "POST", headers: authHeader()
        });
        if (!res.ok) throw new Error("שגיאה בביטול פרסום");
        loadShares(getToken());
        showNotification("⚠️ השיתוף חזר למצב לא מפורסם");
      } catch (err) { console.error(err); alert(err.message); }
    }

    async function deleteShare(div) {
      if (!confirm("למחוק את השיתוף לצמיתות?")) return;
      try {
        const res = await fetch(`${serverUrl}/admin/shares/${div.dataset.id}`, {
          method: "DELETE", headers: authHeader()
        });
        if (!res.ok) throw new Error("שגיאה במחיקת השיתוף");
        div.remove();
        showNotification("🗑️ השיתוף נמחק!");
      } catch (err) { console.error(err); alert(err.message); }
    }

    function addShareToWall(share) {
      if (!wallContainer) return;
      const div = document.createElement("div");
      div.classList.add("messages-wall-card");
      div.innerHTML = `
        <div class="messages-wall-card-content">
          <div class="messages-wall-card-content-text">
            <h5>${share.name}</h5><p>${share.message}</p>
          </div>
          <div class="messages-wall-card-img">
            <img src="${share.imageUrl || "media/flowerman-logo.PNG"}" alt="תמונה">
          </div>
        </div>`;
      wallContainer.prepend(div);
    }

    // =========================================================
    // Contacts
    // =========================================================
    async function loadContacts(token) {
      if (!contactsContainer) return;
      try {
        const res = await fetch(`${serverUrl}/admin/contacts`, { headers: authHeader() });
        if (!res.ok) throw new Error("שגיאה בשליפת הפניות");
        const contacts = await res.json();
        contactsContainer.innerHTML = "";
        if (!contacts || contacts.length === 0) {
          contactsContainer.innerHTML = "<p class='um-empty'>לא נמצאו פניות</p>";
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
          div.querySelector(".delete-contact-btn").addEventListener("click", async () => {
            if (!confirm("להסיר את הפנייה?")) return;
            try {
              const delRes = await fetch(`${serverUrl}/admin/contacts/${contact.id}`, {
                method: "DELETE", headers: authHeader()
              });
              if (!delRes.ok) throw new Error("שגיאה במחיקה");
              div.remove();
              showNotification("🗑️ הפנייה נמחקה!");
            } catch (err) { console.error(err); }
          });
        });
      } catch (err) {
        console.error(err);
        contactsContainer.innerHTML = "<p>❌ שגיאה בשליפת הפניות</p>";
      }
    }

    // =========================================================
    // Upload
    // =========================================================
    if (uploadBtn && uploadFiles && uploadTag && uploadStatus) {
      uploadBtn.addEventListener("click", async () => {
        const files = uploadFiles.files;
        const tag   = uploadTag.value.trim();
        if (!files.length || !tag) return alert("אנא מלא תג ובחר קבצים");
        const formData = new FormData();
        for (const f of files) formData.append("files", f);
        formData.append("tag", tag);
        try {
          uploadStatus.textContent = "⏳ מעלה קבצים...";
          const res  = await fetch(`${serverUrl}/upload-with-tag`, {
            method: "POST",
            headers: authHeader(),
            body: formData
          });
          const data = await res.json();
          if (data.success) {
            uploadStatus.textContent = `✅ הועלו ${data.files.length} קבצים בהצלחה!`;
            uploadFiles.value = "";
            if (clearFileBtn) clearFileBtn.style.display = "none";
          } else {
            uploadStatus.textContent = "❌ שגיאה בהעלאה";
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

    // =========================================================
    // My Profile — חלונית אישית
    // =========================================================
    let myProfileData = null;

    async function loadMyProfile() {
      try {
        const res  = await fetch(`${serverUrl}/auth/me`, { headers: authHeader() });
        if (!res.ok) return;
        myProfileData = await res.json();
        renderMyProfile(myProfileData);
      } catch (err) { console.error("loadMyProfile:", err); }
    }

    function renderMyProfile(u) {
      const initial = (u.fullname || u.username || "?")[0];
      const el = id => document.getElementById(id);

      el("my-avatar").textContent       = initial;
      el("my-avatar").style.background  = avatarColor(u.fullname || u.username);
      el("my-display-name").textContent = u.fullname || "—";
      el("my-display-username").textContent = "@" + u.username;

      const badge = el("my-role-badge");
      badge.textContent  = roleBadgeLabel(u.role);
      badge.className    = "um-badge " + roleBadgeClass(u.role);

      el("my-fullname").value  = u.fullname  || "";
      el("my-username").value  = u.username  || "";
      el("my-email").value     = u.email     || "";
      el("my-password").value = u.password_display || "";
    }

    // פתיחה/סגירה של חלונית פרופיל
    const userBtn         = document.getElementById("user-btn");
    const profileOverlay  = document.getElementById("my-profile-overlay");
    const closeProfileBtn = document.getElementById("close-profile-btn");

    if (userBtn) {
      userBtn.addEventListener("click", () => {
        profileOverlay.style.display = "flex";
        setProfileEditMode(false);
        const fb = document.getElementById("my-feedback");
        if (fb) { fb.textContent = ""; fb.className = "um-feedback"; }
      });
    }
    if (closeProfileBtn) {
      closeProfileBtn.addEventListener("click", () => {
        profileOverlay.style.display = "none";
      });
    }
    // סגירה בלחיצה על רקע
    if (profileOverlay) {
      profileOverlay.addEventListener("click", e => {
        if (e.target === profileOverlay) profileOverlay.style.display = "none";
      });
    }

    function setProfileEditMode(editing) {
      const fields   = ["my-fullname","my-username","my-email","my-password"];
      const editBtn  = document.getElementById("my-edit-btn");
      const saveBtn  = document.getElementById("my-save-btn");
      const cancelBtn= document.getElementById("my-cancel-btn");

      fields.forEach(f => {
        const el = document.getElementById(f);
        if (el) el.disabled = !editing;
      });

      if (editBtn)   editBtn.style.display   = editing ? "none"  : "inline-block";
      if (saveBtn)   saveBtn.style.display   = editing ? "inline-block" : "none";
      if (cancelBtn) cancelBtn.style.display = editing ? "inline-block" : "none";
    }

    const myEditBtn   = document.getElementById("my-edit-btn");
    const mySaveBtn   = document.getElementById("my-save-btn");
    const myCancelBtn = document.getElementById("my-cancel-btn");

    if (myEditBtn)   myEditBtn.addEventListener("click",   () => setProfileEditMode(true));
    if (myCancelBtn) myCancelBtn.addEventListener("click", () => {
      const myLogoutBtn = document.getElementById("my-logout-btn");
if (myLogoutBtn) {
  myLogoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("userToken");
    window.location.replace("/index.html");
  });
}
      if (myProfileData) renderMyProfile(myProfileData);
      setProfileEditMode(false);
    });

    if (mySaveBtn) {
      mySaveBtn.addEventListener("click", async () => {
        const fb       = document.getElementById("my-feedback");
        const fullname = document.getElementById("my-fullname")?.value.trim();
        const username = document.getElementById("my-username")?.value.trim();
        const email    = document.getElementById("my-email")?.value.trim();
        const password = document.getElementById("my-password")?.value;

        if (!fullname || !username) {
          fb.textContent = "שם מלא ושם משתמש הם שדות חובה";
          fb.className   = "um-feedback error";
          return;
        }

        const body = { fullname, username, email };
        if (password) body.password = password;

        try {
          const res  = await fetch(`${serverUrl}/auth/me`, {
            method: "PUT",
            headers: jsonHeaders(),
            body: JSON.stringify(body)
          });
          const data = await res.json();
          if (res.ok) {
            myProfileData = { ...myProfileData, ...data.user };
            renderMyProfile(myProfileData);
            setProfileEditMode(false);
            fb.textContent = "✅ הפרטים עודכנו בהצלחה";
            fb.className   = "um-feedback success";
          } else {
            fb.textContent = "❌ " + (data.error || "שגיאה בעדכון");
            fb.className   = "um-feedback error";
          }
        } catch (err) {
          console.error(err);
          fb.textContent = "❌ שגיאת רשת";
          fb.className   = "um-feedback error";
        }
      });
    }

    // =========================================================
    // Manage Users — ניהול משתמשים (admin/superadmin בלבד)
    // =========================================================
    let allUsersCache = [];

    async function loadManageUsers() {
      await Promise.all([loadPendingUsers(), loadAllUsers()]);
    }

    // --- ממתינים לאישור ---
    async function loadPendingUsers() {
      const container = document.getElementById("pending-users-list");
      const countEl   = document.getElementById("pending-count");
      if (!container) return;

      try {
        const res  = await fetch(`${serverUrl}/admin/users/pending`, { headers: authHeader() });
        const data = await res.json();
        container.innerHTML = "";

        if (!res.ok) { container.innerHTML = `<p class="um-empty">${data.error || "שגיאה"}</p>`; return; }
        if (!data.length) {
          container.innerHTML = "<p class='um-empty'>אין משתמשים ממתינים לאישור</p>";
          if (countEl) countEl.style.display = "none";
          return;
        }

        if (countEl) { countEl.textContent = data.length; countEl.style.display = "inline"; }

        data.forEach(u => {
          const card = document.createElement("div");
          card.className = "um-pending-card";
          card.innerHTML = `
            <div class="um-pcard-name">${u.fullname || "—"}</div>
            <div class="um-pcard-username">@${u.username}</div>
            ${u.email ? `<div class="um-pcard-email">${u.email}</div>` : ""}
            <div class="um-pcard-date">נרשם: ${fmtDate(u.created_at)}</div>
            <div class="um-pcard-actions">
              <button class="um-btn-approve" data-id="${u.id}">✓ אשר</button>
              <button class="um-btn-reject"  data-id="${u.id}">✗ מחק</button>
            </div>
          `;
          container.appendChild(card);

          card.querySelector(".um-btn-approve").addEventListener("click", async () => {
            try {
              const r = await fetch(`${serverUrl}/admin/users/approve/${u.id}`, {
                method: "POST", headers: authHeader()
              });
              if (r.ok) {
                showNotification("✅ המשתמש אושר והפך ל-user");
                loadManageUsers();
              } else {
                const d = await r.json();
                showNotification("❌ " + (d.error || "שגיאה"), true);
              }
            } catch (err) { console.error(err); }
          });

          card.querySelector(".um-btn-reject").addEventListener("click", async () => {
            if (!confirm(`למחוק את ${u.fullname || u.username} לצמיתות?`)) return;
            try {
              const r = await fetch(`${serverUrl}/admin/users/reject/${u.id}`, {
                method: "POST", headers: authHeader()
              });
              if (r.ok) {
                showNotification("🗑️ הבקשה נדחתה והמשתמש נמחק");
                loadManageUsers();
              } else {
                const d = await r.json();
                showNotification("❌ " + (d.error || "שגיאה"), true);
              }
            } catch (err) { console.error(err); }
          });
        });

      } catch (err) {
        console.error(err);
        container.innerHTML = "<p class='um-empty'>שגיאה בטעינת הממתינים</p>";
      }
    }

    // --- כל המשתמשים (dropdown) ---
    async function loadAllUsers() {
      try {
        const res = await fetch(`${serverUrl}/admin/users/all`, { headers: authHeader() });
        if (!res.ok) return;
        allUsersCache = await res.json();
        populateUserSelect(allUsersCache);

        // רענן כרטיס פתוח
        const card = document.getElementById("um-user-card");
        if (card && card.style.display !== "none" && card.dataset.userId) {
          const u = allUsersCache.find(x => String(x.id) === card.dataset.userId);
          if (u) showUserCard(u);
        }
      } catch (err) { console.error("loadAllUsers:", err); }
    }

    function populateUserSelect(users) {
      const select = document.getElementById("um-user-select");
      if (!select) return;
      const current = select.value;
      select.innerHTML = '<option value="">-- בחר משתמש לצפייה/עריכה --</option>';
      // מסנן החוצה pending (כבר בסקציה הנפרדת)
        const myId = getCurrentId();
        users.filter(u => u.role !== "pending" && String(u.id) !== String(myId)).forEach(u => {
        const opt = document.createElement("option");
        opt.value       = u.id;
        opt.textContent = (u.fullname || u.username) + ` (${roleBadgeLabel(u.role)})`;
        select.appendChild(opt);
      });
      if (current) select.value = current;
    }

    function showUserCard(user) {
      const myId       = getCurrentId();
      const myRole     = getCurrentRole();
      const card       = document.getElementById("um-user-card");
      const feedback   = document.getElementById("um-feedback");

      if (!card) return;

      // avatar
      const initial = (user.fullname || user.username || "?")[0];
      document.getElementById("um-avatar").textContent      = initial;
      document.getElementById("um-avatar").style.background = avatarColor(user.fullname || user.username);
      document.getElementById("um-fullname").textContent         = user.fullname || "—";
      document.getElementById("um-username-display").textContent = "@" + user.username;

      const badge = document.getElementById("um-role-badge");
      badge.textContent = roleBadgeLabel(user.role);
      badge.className   = "um-badge " + roleBadgeClass(user.role);

      // שדות
      document.getElementById("um-edit-fullname").value = user.fullname || "";
      document.getElementById("um-edit-username").value = user.username || "";
      document.getElementById("um-edit-email").value    = user.email    || "";

    const passField = document.getElementById("um-password-field");
    if (passField) {
      if (myRole === "superadmin" && user.password_hash) {
        passField.style.display = "flex";
        document.getElementById("um-view-password").value = user.password_hash;
      } else {
        passField.style.display = "none";
        document.getElementById("um-view-password").value = "";
      }
    }

      // role selector — superadmin לכולם, admin רק לuser ולמטה, אף אחד לא לעצמו
      const roleField  = document.getElementById("um-role-field");
      const roleSelect = document.getElementById("um-edit-role");

      const isSelf = String(user.id) === String(myId);

      if (roleField && roleSelect) {
        let showRole = false;

        if (!isSelf) {
          if (myRole === "superadmin") {
            // superadmin — יכול לשנות לכולם
            showRole = true;
            roleSelect.innerHTML = `
              <option value="user">משתמש (user)</option>
              <option value="admin">מנהל (admin)</option>
              <option value="superadmin">סופר מנהל (superadmin)</option>
            `;
          } else if (myRole === "admin" && (user.role === "user" || user.role === "admin")) {
            // admin — יכול לשנות user → admin ואחורה, לא superadmin
            showRole = true;
            roleSelect.innerHTML = `
              <option value="user">משתמש (user)</option>
              <option value="admin">מנהל (admin)</option>
            `;
          }
        }

        roleField.style.display = showRole ? "flex" : "none";
        if (showRole) roleSelect.value = user.role;
      }

      if (feedback) { feedback.textContent = ""; feedback.className = "um-feedback"; }

      card.style.display  = "flex";
      card.dataset.userId = user.id;
    }

    // Dropdown change
    const umSelect = document.getElementById("um-user-select");
    if (umSelect) {
      umSelect.addEventListener("change", () => {
        const id = umSelect.value;
        if (!id) {
          const c = document.getElementById("um-user-card");
          if (c) c.style.display = "none";
          return;
        }
        const user = allUsersCache.find(u => String(u.id) === id);
        if (user) showUserCard(user);
      });
    }

    // Refresh
    const umRefresh = document.getElementById("um-refresh-btn");
    if (umRefresh) umRefresh.addEventListener("click", loadManageUsers);

    // שמירת שינויים
    const umSave = document.getElementById("um-save-btn");
    if (umSave) {
      umSave.addEventListener("click", async () => {
        const card     = document.getElementById("um-user-card");
        const feedback = document.getElementById("um-feedback");
        if (!card || !card.dataset.userId) return;

        const myRole   = getCurrentRole();
        const myId     = getCurrentId();
        const userId   = card.dataset.userId;
        const isSelf   = String(userId) === String(myId);

        const fullname = document.getElementById("um-edit-fullname")?.value.trim();
        const username = document.getElementById("um-edit-username")?.value.trim();
        const email    = document.getElementById("um-edit-email")?.value.trim();
        const role     = document.getElementById("um-edit-role")?.value;

        if (!fullname || !username) {
          feedback.textContent = "שם מלא ושם משתמש הם שדות חובה";
          feedback.className   = "um-feedback error";
          return;
        }

        const body = { fullname, username, email };
        // role — רק אם מותר ולא עצמו
        if (!isSelf && role) {
          if (myRole === "superadmin") body.role = role;
          else if (myRole === "admin" && ["user","admin"].includes(role)) body.role = role;
        }

        try {
          const res  = await fetch(`${serverUrl}/admin/users/${userId}`, {
            method: "PUT",
            headers: jsonHeaders(),
            body: JSON.stringify(body)
          });
          const data = await res.json();
          if (res.ok) {
            feedback.textContent = "✅ הפרטים עודכנו בהצלחה";
            feedback.className   = "um-feedback success";
            showNotification("✅ המשתמש עודכן");
            await loadManageUsers();
          } else {
            feedback.textContent = "❌ " + (data.error || "שגיאה בעדכון");
            feedback.className   = "um-feedback error";
          }
        } catch (err) {
          console.error(err);
          feedback.textContent = "❌ שגיאת רשת";
          feedback.className   = "um-feedback error";
        }
      });
    }

    // מחיקת משתמש
    const umDelete = document.getElementById("um-delete-btn");
    if (umDelete) {
      umDelete.addEventListener("click", async () => {
        const card = document.getElementById("um-user-card");
        if (!card || !card.dataset.userId) return;

        const myId   = getCurrentId();
        const userId = card.dataset.userId;
        if (String(userId) === String(myId)) {
          alert("לא ניתן למחוק את עצמך");
          return;
        }
        if (!confirm("למחוק את המשתמש לצמיתות?")) return;

        try {
          const res = await fetch(`${serverUrl}/admin/users/${userId}`, {
            method: "DELETE", headers: authHeader()
          });
          if (res.ok) {
            card.style.display = "none";
            document.getElementById("um-user-select").value = "";
            showNotification("🗑️ המשתמש נמחק");
            await loadManageUsers();
          } else {
            const data = await res.json();
            alert(data.error || "שגיאה במחיקה");
          }
        } catch (err) { console.error(err); }
      });
    }

    // =========================================================
    // Start
    // =========================================================
    checkToken();
  });
}
