document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("share-form");
  const wallContainer = document.querySelector(".massages-wall-cards");
  const fileInput = document.getElementById("file");
  const clearBtn = document.getElementById("clear-file");

  const serverUrl = "https://flowerman.onrender.com"; // כתובת השרת

  // ===== הפעלת כפתור X לניקוי הקובץ =====
  function toggleClearBtn() {
    clearBtn.style.display = fileInput.files.length > 0 ? "inline-block" : "none";
  }
  toggleClearBtn();
  fileInput.addEventListener("change", toggleClearBtn);
  clearBtn.addEventListener("click", () => {
    fileInput.value = "";
    toggleClearBtn();
  });

  // ===== סט שיתופים מוצגים כדי למנוע שכפולים =====
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

        const uploadRes = await fetch(`${serverUrl}/upload`, {
          method: "POST",
          body: formData
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) {
          throw new Error(uploadData.error || "שגיאה בהעלאת התמונה");
        }
        imageUrl = uploadData.url;
      }

      const shareRes = await fetch(`${serverUrl}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, imageUrl })
      });

      if (!shareRes.ok) {
        const errData = await shareRes.json();
        throw new Error(errData.error || "שגיאה בשליחת השיתוף");
      }

      showNotification("✅ השיתוף נשלח לבדיקת מנהל!");
      form.reset();
      toggleClearBtn();

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });

  // ===== פונקציה להוספת שיתוף ל-wall =====
  function addShareToWall(share) {
    const id = share.id || share._id;
    if (!wallContainer || displayedShares.has(id)) return;

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
    displayedShares.add(id);
  }

  // ===== Polling לשיתופים שפורסמו =====
  async function fetchPublishedShares() {
    try {
      const res = await fetch(`${serverUrl}/shares/published`);
      if (!res.ok) throw new Error("שגיאה בשליפת שיתופים");

      const shares = await res.json();
      shares.forEach(share => addShareToWall(share));

    } catch (err) {
      console.error(err);
    }
  }

  // ===== הצגת הודעה זמנית =====
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
    setTimeout(() => notif.remove(), 3000);
  }

  fetchPublishedShares();
  setInterval(fetchPublishedShares, 5000);
});
