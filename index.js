// index.js
document.addEventListener("DOMContentLoaded", () => {
  const serverUrl = "https://flowerman.onrender.com";

  // ===== Clean old JWT =====
  localStorage.removeItem("token");
  console.log("Contact form JS loaded!");
  console.log(document.querySelector(".contact-form"));



  // ===== Admin Login Button =====
  const adminLoginBtn = document.querySelector(".nav-login-btn");
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener("click", () => {
      window.location.href = "login.html";
    });
  }

  // ===== Language Dropdown =====
  const langSelect = document.querySelector(".lang-select");
  const selected = langSelect?.querySelector(".selected");
  const optionsContainer = langSelect?.querySelector(".options");
  let translations = {};
  let currentLang = localStorage.getItem("lang") || "";

  function applyTranslations() {
   document.querySelectorAll("[data-translation]").forEach(el => {
  const key = el.getAttribute("data-translation");
  const text = translations[currentLang]?.[key];
  if (!text) return;

  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    el.placeholder = text;
  } else {
    el.innerHTML = text.replace(/\n/g, "<br />");
  }
});

  }

  function updateDirectionAndAlign() {
    document.body.setAttribute("dir", currentLang === "eng" ? "ltr" : "rtl");
    document.querySelectorAll("*").forEach(el => {
      const style = window.getComputedStyle(el);
      if (currentLang === "eng" && style.textAlign === "right") el.style.textAlign = "left";
      if (currentLang !== "eng" && style.textAlign === "left") el.style.textAlign = "right";
    });
  }

  function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem("lang", lang);
    if (langSelect && selected) {
      const activeOption = langSelect.querySelector(`.options li[data-value="${lang}"]`);
      if (activeOption) selected.innerHTML = activeOption.innerHTML;
    }
    applyTranslations();
    updateDirectionAndAlign();
  }

  if (selected && optionsContainer) {
    selected.addEventListener("click", () => langSelect.classList.toggle("open"));
    optionsContainer.querySelectorAll("li").forEach(option => {
      option.addEventListener("click", () => setLanguage(option.dataset.value));
    });
    document.addEventListener("click", e => {
      if (!langSelect.contains(e.target)) langSelect.classList.remove("open");
    });
  }

  fetch("translate.json")
    .then(res => res.json())
    .then(data => {
      translations = data;
      if (!currentLang) {
        const browserLang = navigator.language || "he";
        currentLang = browserLang.startsWith("en") ? "eng" : "he";
        localStorage.setItem("lang", currentLang);
      }
      setLanguage(currentLang);
    })
    .catch(err => console.error("Error loading translations:", err));

  // ===== Gallery Buttons =====
  const buttons = document.querySelectorAll(".gallery-page-head-btns button");
  const images = document.querySelectorAll(".gallery-page-main-content img");
  const activeButtons = new Set();
  const transitionTime = 400;

  images.forEach(img => {
    img.style.opacity = 1;
    img.style.transition = `opacity ${transitionTime}ms ease`;
    img.style.position = "relative";
  });

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const targetClass = button.id;
      if (activeButtons.has(targetClass)) {
        activeButtons.delete(targetClass);
        button.classList.remove("active");
      } else {
        activeButtons.add(targetClass);
        button.classList.add("active");
      }

      images.forEach(img => img.style.opacity = 0);
      setTimeout(() => {
        images.forEach(img => {
          const matches = Array.from(activeButtons).some(cls => img.classList.contains(cls));
          if (matches || activeButtons.size === 0) {
            img.style.position = "relative";
            img.style.pointerEvents = "auto";
            img.style.opacity = 1;
          } else {
            img.style.position = "absolute";
            img.style.pointerEvents = "none";
            img.style.opacity = 0;
          }
        });
      }, transitionTime);
    });
  });

  // ===== Sliders Setup =====
  function setupSliding(containerSelector, interval = 4000, fadeTime = 800) {
    const containers = document.querySelectorAll(containerSelector);
    if (!containers.length) return;

    containers.forEach(container => {
      const slides = Array.from(container.children);
      let currentIndex = 0;
      let slideInterval;

      slides.forEach((slide, index) => {
        slide.style.position = "absolute";
        slide.style.top = 0;
        slide.style.left = 0;
        slide.style.width = "100%";
        slide.style.height = "100%";
        slide.style.transition = `opacity ${fadeTime}ms ease`;
        slide.style.opacity = index === 0 ? 1 : 0;
      });

      function showNext() {
        slides[currentIndex].style.opacity = 0;
        currentIndex = (currentIndex + 1) % slides.length;
        slides[currentIndex].style.opacity = 1;
      }

      function startSliding() { slideInterval = setInterval(showNext, interval); }
      function stopSliding() { clearInterval(slideInterval); }

      container.querySelectorAll(".sliding-img-overlay a").forEach(btn => {
        btn.addEventListener("mouseenter", stopSliding);
        btn.addEventListener("mouseleave", startSliding);
      });

      startSliding();
    });
  }

  setupSliding(".weekly-activity-content-sliding-imgs");
  setupSliding(".special-activity-content-sliding-img");

 // ===== Contact Form =====
document.addEventListener("DOMContentLoaded", () => {
  const contactForm = document.querySelector(".contact-form");
  const contactMessage = document.querySelector(".contact-message");

  if (!contactForm) return;

  contactForm.addEventListener("submit", async e => {
    e.preventDefault();
    e.stopPropagation(); // חשוב!

    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData.entries());

    if (!data.contact_name || !data.phone || !data.region || data.region === "choose" || !data.message) {
      showContactMessage("נא למלא את כל השדות", "error");
      return;
    }

    try {
      const res = await fetch("/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.contact_name,
          phone: data.phone,
          region: data.region,
          message: data.message
        })
      });

      if (!res.ok) throw new Error("שגיאה בשליחת הפנייה");

      showContactMessage("הפנייה נשלחה בהצלחה!", "success");
      contactForm.reset();
    } catch (err) {
      console.error(err);
      showContactMessage(err.message, "error");
    }
  });

  function showContactMessage(msg, type="info") {
    if (!contactMessage) return;
    contactMessage.innerText = msg;
    contactMessage.className = `contact-message ${type}`;
    setTimeout(() => {
      contactMessage.innerText = "";
      contactMessage.className = "contact-message";
    }, 5000);
  }
});



  // ===== Share Form =====
  const shareForm = document.querySelector("#share-form");
  const messageBox = document.querySelector("#share-message");

  function alert(msg, type = "info") {
    if (!messageBox) return;
    messageBox.innerText = msg;
    messageBox.className = `share-message ${type}`;
    setTimeout(() => {
      messageBox.innerText = "";
      messageBox.className = "share-message";
    }, 5000);
  }

  function renderSharesOnWall(shares) {
    const wallContainer = document.querySelector(".messages-wall-cards");
    if (!wallContainer) return;

    wallContainer.innerHTML = "";
    shares.forEach(share => {
      const imgSrc = share.imageurl && share.imageurl.trim() !== "" ? share.imageurl : "flowerman-logo.PNG";
      const div = document.createElement("div");
      div.classList.add("messages-wall-card");
      div.innerHTML = `
        <div class="messages-wall-card-content">
          <div class="messages-wall-card-content-text">
            <h5>${share.name}</h5>
            <p>${share.message}</p>
          </div>
          <div class="messages-wall-card-img">
            <img src="${imgSrc}" alt="" />
          </div>
        </div>
      `;
      wallContainer.prepend(div);
    });
  }

  async function loadPublishedShares() {
    try {
      const res = await fetch(`${serverUrl}/shares/published?${Date.now()}`);
      if (!res.ok) throw new Error("שגיאה בשליפת השיתופים");
      const data = await res.json();
      renderSharesOnWall(data);
    } catch (err) {
      console.error(err);
      alert(err.message, "error");
    }
  }

  if (shareForm) {
    shareForm.addEventListener("submit", async e => {
      e.preventDefault();
      const formData = new FormData(shareForm);
      const name = formData.get("name")?.trim();
      const message = formData.get("message")?.trim();
      const file = formData.get("file");

      if (!name || !message) {
        alert("נא למלא שם והודעה", "error");
        return;
      }

      try {
        const uploadData = new FormData();
        uploadData.append("name", name);
        uploadData.append("message", message);
        if (file && file.size > 0) uploadData.append("file", file);

        const res = await fetch(`${serverUrl}/shares`, { method: "POST", body: uploadData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "שגיאה בשליחת השיתוף");

        window.alert("השיתוף נשלח לבדיקת מנהל בהצלחה!", "success");
        shareForm.reset();

        // הצגת השיתוף מיד בצד לקוח לפי הנתונים שהשרת החזיר
        if (data && data.share) {
          renderSharesOnWall([data.share]);
        }

        loadPublishedShares(); // טען שיתופים מהשרת
      } catch (err) {
        console.error(err);
        alert(err.message || "שגיאה בשרת", "error");
      }
    });
  }

 // ===== קרוסלת שיתופים =====
const carousel = document.querySelector(".messages-wall-cards");
if (carousel) {
  const speed = 0.5; // מהירות גלילה אוטומטית
  let autoScroll = true;
  let isDragging = false;
  let startX;
  let scrollLeftStart;

  // עיצוב בסיסי כדי לשמור על הפריסה
  carousel.style.display = "flex";
  carousel.style.overflowX = "auto";
  carousel.style.scrollBehavior = "smooth";
  carousel.style.gap = "1rem"; // רווח בין הקוביות
  carousel.style.scrollSnapType = "x mandatory";
  carousel.style.scrollbarWidth = "none";

  // גלילה אינסופית רכה
  function autoScrollLoop() {
    if (autoScroll && carousel.scrollWidth > carousel.clientWidth) {
      carousel.scrollLeft += speed;
      if (carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth) {
        carousel.scrollLeft = 0; // חזרה להתחלה
      }
    }
    requestAnimationFrame(autoScrollLoop);
  }
  autoScrollLoop();

  // גרירה בעכבר
  carousel.addEventListener("mousedown", e => {
    isDragging = true;
    startX = e.pageX - carousel.offsetLeft;
    scrollLeftStart = carousel.scrollLeft;
    autoScroll = false;
  }, { passive: true });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      autoScroll = true;
    }
  });

  carousel.addEventListener("mousemove", e => {
    if (!isDragging) return;
    const x = e.pageX - carousel.offsetLeft;
    const walk = (x - startX) * 1.5;
    carousel.scrollLeft = scrollLeftStart - walk;
  }, { passive: true });

  // גרירה במגע (נייד)
  carousel.addEventListener("touchstart", e => {
    isDragging = true;
    startX = e.touches[0].pageX - carousel.offsetLeft;
    scrollLeftStart = carousel.scrollLeft;
    autoScroll = false;
  }, { passive: true });

  carousel.addEventListener("touchend", () => {
    isDragging = false;
    autoScroll = true;
  }, { passive: true });

  carousel.addEventListener("touchmove", e => {
    if (!isDragging) return;
    const x = e.touches[0].pageX - carousel.offsetLeft;
    const walk = (x - startX) * 1.5;
    carousel.scrollLeft = scrollLeftStart - walk;
  }, { passive: true });
}



  // ===== Load initial shares =====
  loadPublishedShares();
});


















