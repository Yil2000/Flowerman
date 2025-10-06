document.addEventListener("DOMContentLoaded", () => {
  // ===== Sidebar navigation =====
  const buttons = document.querySelectorAll("#sidebar button");
  const sections = document.querySelectorAll(".section");

  if (buttons && sections) {
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        if (!target) return;

        // מסתיר את כל החלונות
        sections.forEach(sec => sec.classList.remove("active"));

        // מציג רק את הנבחר
        const targetSection = document.getElementById(target);
        if (targetSection) targetSection.classList.add("active");
      });
    });
  }

  // ===== Upload files =====
  const uploadBtn = document.getElementById("upload-btn");
  if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
      const tagInput = document.getElementById("upload-tag");
      const filesInput = document.getElementById("upload-files");
      const status = document.getElementById("upload-status");

      if (!tagInput || !filesInput || !status) return;

      const tag = tagInput.value.trim();
      const files = filesInput.files;

      if (!tag || files.length === 0) {
        alert("אנא מלא תג ובחר קבצים");
        return;
      }

      status.innerText = `נבחרו ${files.length} קבצים עם תג "${tag}" (במצב DEV זה לא נשלח)`;

      // כאן ניתן להוסיף את קריאת ה-fetch לשליחת הקבצים לשרת
    });
  }

  // ===== Admin logout =====
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      window.location.reload();
    });
  }

  // ===== Shares management =====
  const publishButtons = document.querySelectorAll(".publish-btn");
  if (publishButtons) {
    publishButtons.forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!id) return;

        try {
          const res = await fetch(`/admin/shares/publish/${id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
          });
          if (res.ok) window.location.reload();
        } catch (err) { console.error(err); }
      });
    });
  }

  const unpublishButtons = document.querySelectorAll(".unpublish-btn");
  if (unpublishButtons) {
    unpublishButtons.forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!id) return;

        try {
          const res = await fetch(`/admin/shares/unpublish/${id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
          });
          if (res.ok) window.location.reload();
        } catch (err) { console.error(err); }
      });
    });
  }

  const deleteButtons = document.querySelectorAll(".delete-btn");
  if (deleteButtons) {
    deleteButtons.forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!id) return;

        try {
          const res = await fetch(`/admin/shares/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
          });
          if (res.ok) window.location.reload();
        } catch (err) { console.error(err); }
      });
    });
  }

  // ===== Contacts management =====
  const deleteContactButtons = document.querySelectorAll(".delete-contact-btn");
  if (deleteContactButtons) {
    deleteContactButtons.forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!id) return;

        try {
          const res = await fetch(`/admin/contacts/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
          });
          if (res.ok) window.location.reload();
        } catch (err) { console.error(err); }
      });
    });
  }
});
