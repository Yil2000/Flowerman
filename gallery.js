// gallery.js
const serverUrl = "https://flowerman.onrender.com/";
const useServer = true;

const homepageGallery = document.querySelector("#homepage-gallery .gallery-img-boxs");
const mainGallery = document.getElementById("gallery");
const buttons = document.querySelectorAll(".gallery-page-head-btns button");
const transitionTime = 400;
const allTags = ["jerusalem", "heifa", "beerSheva", "savidor", "kisufim", "julis","bhd1","shatz"];

// פונקציה לשליפת תמונות לפי tag
async function fetchImagesByTag(tag) {
  try {
    const res = await fetch(`${serverUrl}/images/${tag}`);
    if (!res.ok) throw new Error(`שגיאה בשרת: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("בעיה בשליפה:", err);
    return [];
  }
}

// ===== פונקציה להצגת תמונות עם hover ו-lightbox =====
function renderImages(container, images) {
  if (!container) return;
  container.innerHTML = "";
  images.forEach(imgData => {
    const box = document.createElement("div");
    box.className = container.id === "gallery" ? "gallery-page-img-box" : "gallery-img-box";
    box.style.position = "relative";

    const img = document.createElement("img");
    img.src = useServer ? imgData.secure_url : `https://res.cloudinary.com/dkrckjqfn/image/upload/${imgData.public_id}.jpg`;
    img.alt = imgData.public_id || "";
    img.style.opacity = 0;
    img.style.transition = `opacity ${transitionTime}ms ease, transform 0.3s ease`;
    img.style.cursor = "pointer";

    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0,0,0,0.3)";
    overlay.style.opacity = 0;
    overlay.style.transition = "opacity 0.3s ease";
    overlay.style.pointerEvents = "none";

    box.appendChild(img);
    box.appendChild(overlay);
    container.appendChild(box);

    setTimeout(() => img.style.opacity = 1, 50);

    // hover effect
    box.addEventListener("mouseenter", () => {
      overlay.style.opacity = 1;
      img.style.transform = "scale(1.05)";
    });
    box.addEventListener("mouseleave", () => {
      overlay.style.opacity = 0;
      img.style.transform = "scale(1)";
    });

    // קליק לפתיחת lightbox
    img.addEventListener("click", () => openLightbox(img.src, img.alt));
  });
}

// ===== Lightbox =====
function openLightbox(src, alt) {
  let lightbox = document.getElementById("custom-lightbox");
  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.id = "custom-lightbox";
    lightbox.style.position = "fixed";
    lightbox.style.top = 0;
    lightbox.style.left = 0;
    lightbox.style.width = "100%";
    lightbox.style.height = "100%";
    lightbox.style.backgroundColor = "rgba(0,0,0,0.8)";
    lightbox.style.display = "flex";
    lightbox.style.justifyContent = "center";
    lightbox.style.alignItems = "center";
    lightbox.style.zIndex = 10000;

    const img = document.createElement("img");
    img.id = "lightbox-img";
    img.style.maxWidth = "90%";
    img.style.maxHeight = "90%";
    img.style.borderRadius = "8px";

    // קליק על התמונה סוגר
    img.addEventListener("click", closeLightbox);

    lightbox.appendChild(img);

    const closeBtn = document.createElement("div");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "20px";
    closeBtn.style.left = "20px";
    closeBtn.style.fontSize = "40px";
    closeBtn.style.color = "white";
    closeBtn.style.cursor = "pointer";
    closeBtn.addEventListener("click", closeLightbox);

    lightbox.appendChild(closeBtn);

    document.body.appendChild(lightbox);
  }

  const lbImg = document.getElementById("lightbox-img");
  lbImg.src = src;
  lbImg.alt = alt;
  lightbox.style.display = "flex";
}

function closeLightbox() {
  const lightbox = document.getElementById("custom-lightbox");
  if (lightbox) lightbox.style.display = "none";
}

// ====== גלריה homepage ======
async function renderHomepageGallery() {
  if (!homepageGallery) return;
  const images = await fetchImagesByTag("homepage");
  if (images.length === 0) return;
  renderImages(homepageGallery, images);
}

// ====== גלריה עיקרית עם פילטרים ======
async function renderMainGallery(tags = null) {
  let resources = [];

  if (!tags || tags.length === 0) {
    const allResults = await Promise.all(allTags.map(fetchImagesByTag));
    resources = allResults.flat();
  } else {
    const results = await Promise.all(tags.map(fetchImagesByTag));
    resources = results.flat();
  }

  renderImages(mainGallery, resources);
}

// מאזינים לכפתורים בגלריה הראשית
buttons.forEach(button => {
  button.addEventListener("click", async () => {
    if (button.id === "all") {
      buttons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      await renderMainGallery();
      return;
    }

    button.classList.toggle("active");
    document.getElementById("all")?.classList.remove("active");

    const activeTags = Array.from(buttons)
      .filter(btn => btn.classList.contains("active") && btn.id !== "all")
      .map(btn => btn.id);

    await renderMainGallery(activeTags);
  });
});

// ====== הרצת ברירת מחדל ======
renderHomepageGallery();
renderMainGallery();


