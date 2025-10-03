document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("share-form"); // אם יש לך form קיים
  const wallContainer = document.querySelector(".massages-wall-cards");
  const fileInput = document.getElementById("upload-files");
  const clearBtn = document.getElementById("clear-file");

  const serverUrl = "https://flowerman.onrender.com";

  // ===== הצגת/הסתרת כפתור X =====
  function toggleClearBtn() {
    clearBtn.style.display = fileInput.files.length > 0 ? "inline-block" : "none";
  }
  toggleClearBtn();
  fileInput.addEventListener("change", toggleClearBtn);
  clearBtn.addEventListener("click", () => {
    fileInput.value = "";
    toggleClearBtn();
  });

  // ===== סט לשיתופים שמוצגים =====
  const displayedShares = new Set();

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
      shares.forEach(addShareToWall);
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

  // ===== Upload button =====
  const uploadBtn = document.getElementById("upload-btn");
  const uploadTag = document.getElementById("upload-tag");
  const uploadStatus = document.getElementById("upload-status");

  if (uploadBtn) {
    uploadBtn.addEventListener("click", async () => {
      const files = fileInput.files;
      const tag = uploadTag.value;
      if (!files.length || !tag) {
        alert("בחר קבצים וקטגוריה");
        return;
      }

      uploadStatus.textContent = "מעלה קבצים...";
      for (let file of files) {
        const formData = new FormData();
        formData.append("file", file);

        try {
          const res = await fetch(`${serverUrl}/upload`, { method: "POST", body: formData });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "שגיאה בהעלאה");

          // כאן ניתן לשלוח את הקובץ גם ל־Cloudinary עם tag אם רוצים
          console.log("Uploaded:", data.url);

        } catch (err) {
          console.error(err);
          alert("שגיאה בהעלאת הקובץ: " + err.message);
        }
      }
      uploadStatus.textContent = "✅ העלאה הושלמה";
      fileInput.value = "";
      toggleClearBtn();
    });
  }
});
