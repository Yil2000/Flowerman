document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("share-form");
  const wallContainer = document.querySelector(".massages-wall-cards");
  const fileInput = document.getElementById("file");
  const clearBtn = document.getElementById("clear-file");

  // הפוך את הכפתור X לגלוי רק אם יש קובץ
  function toggleClearBtn() {
    clearBtn.style.display = fileInput.files.length > 0 ? "inline-block" : "none";
  }

  // התחלה - מסתיר את הכפתור
  toggleClearBtn();

  // מאזין לשינויים באינפוט
  fileInput.addEventListener("change", toggleClearBtn);

  // כפתור מחיקה מנקה את הבחירה ומסתיר את הכפתור
  clearBtn.addEventListener("click", () => {
    fileInput.value = "";
    toggleClearBtn();
  });

  // שמירת מזהי השיתופים שכבר מוצגים
  const displayedShares = new Set();

  // ===== שליחת שיתוף =====
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("share-name").value.trim();
    const message = document.getElementById("share-massege").value.trim();
    const file = fileInput.files[0];

    if (!name || !message) {
      alert("נא למלא שם והודעה");
      return;
    }

    try {
      let imageUrl = "";

      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("https://flowerman.onrender.com/", {
          method: "POST",
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) {
          throw new Error(uploadData.error || "שגיאה בהעלאת התמונה");
        }
        imageUrl = uploadData.url;
      }

      const shareRes = await fetch("http://localhost:4000/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, imageUrl })
      });

      if (!shareRes.ok) {
        const errData = await shareRes.json();
        throw new Error(errData.error || "שגיאה בשליחת השיתוף");
      }

      const notif = document.createElement("div");
      notif.textContent = "✅ השיתוף נשלח לבדיקת מנהל!";
      notif.style.position = "fixed";
      notif.style.top = "20px";
      notif.style.right = "20px";
      notif.style.background = "#4caf50";
      notif.style.color = "white";
      notif.style.padding = "10px 20px";
      notif.style.borderRadius = "5px";
      notif.style.zIndex = "9999";
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 3000);

      form.reset();
      toggleClearBtn(); // עדכון הכפתור לאחר איפוס

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });

  // ===== פונקציה להוספת שיתוף ל-wall =====
  function addShareToWall(share) {
    if (!wallContainer || displayedShares.has(share.id)) return;

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
    displayedShares.add(share.id);
  }

  // ===== Polling לקבלת שיתופים שפורסמו =====
  async function fetchPublishedShares() {
    try {
      const res = await fetch("http://localhost:4000/shares/published");
      if (!res.ok) throw new Error("שגיאה בשליפת שיתופים");

      const shares = await res.json();
      shares.forEach(share => addShareToWall(share));

    } catch (err) {
      console.error(err);
    }
  }

  fetchPublishedShares();
  setInterval(fetchPublishedShares, 5000);
});

