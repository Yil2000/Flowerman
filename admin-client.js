//admin-client.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("share-form");
  const wallContainer = document.querySelector(".massages-wall-cards");
  const fileInput = document.getElementById("upload-files");
  const clearBtn = document.getElementById("clear-file");
  const serverUrl = "https://flowerman.onrender.com";

  // בדוק אם האלמנטים קיימים לפני שמשתמשים בהם
  if (fileInput && clearBtn) {
    function toggleClearBtn() {
      clearBtn.style.display = fileInput.files.length > 0 ? "inline-block" : "none";
    }
    toggleClearBtn();
    fileInput.addEventListener("change", toggleClearBtn);
    clearBtn.addEventListener("click", () => {
      fileInput.value = "";
      toggleClearBtn();
    });
  }

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
          <img src="${share.imageUrl || 'flowerman-logo.PNG'}" alt="" />
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

  fetchPublishedShares();
  setInterval(fetchPublishedShares, 5000);
});

