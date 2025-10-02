document.addEventListener("DOMContentLoaded", () => {

  // ===== Clean old JWT =====
  // רק בדף login.html
  localStorage.removeItem("token");

  // ===== Admin Login Button =====
  const adminLoginBtn = document.querySelector(".nav-login-btn");
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener("click", () => {
      // מפנה לדף login.html
      window.location.href = "login.html";
    });
  }

  // ===== Dropdown שפה =====
  const langSelect = document.querySelector('.lang-select');
  const selected = langSelect ? langSelect.querySelector('.selected') : null;
  const optionsContainer = langSelect ? langSelect.querySelector('.options') : null;

  if (selected && optionsContainer) {
    selected.addEventListener('click', () => {
      langSelect.classList.toggle('open');
    });

    optionsContainer.querySelectorAll('li').forEach(option => {
      option.addEventListener('click', () => {
        selected.innerHTML = option.innerHTML;
        const lang = option.dataset.value;
        langSelect.classList.remove('open');
        setLanguage(lang); // כאן מתבצע שינוי מיידי
      });
    });

    document.addEventListener('click', (e) => {
      if (!langSelect.contains(e.target)) {
        langSelect.classList.remove('open');
      }
    });
  }

  // ===== Translations =====
  let translations = {};
  let currentLang = localStorage.getItem("lang") || "";

  function applyTranslations() {
    document.querySelectorAll("[data-translation]").forEach(el => {
      const key = el.getAttribute("data-translation");
      if (translations[currentLang] && translations[currentLang][key]) {
        el.innerHTML = translations[currentLang][key].replace(/\n/g, "<br />");
      }
    });
  }

  function updateDirectionAndAlign() {
    if (currentLang === "eng") {
      document.body.setAttribute("dir", "ltr");
      document.querySelectorAll("*").forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.textAlign === "right") {
          el.style.textAlign = "left";
        }
      });
    } else {
      document.body.setAttribute("dir", "rtl");
      document.querySelectorAll("*").forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.textAlign === "left") {
          el.style.textAlign = "right";
        }
      });
    }
  }

  function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem("lang", lang);

    if (langSelect && selected) {
      const activeOption = langSelect.querySelector(`.options li[data-value="${currentLang}"]`);
      if (activeOption) {
        selected.innerHTML = activeOption.innerHTML;
      }
    }

    applyTranslations();
    updateDirectionAndAlign(); // מפעיל מיידית את השינוי
  }

  fetch("translate.json")
    .then(response => response.json())
    .then(data => {
      translations = data;

      if (!currentLang) {
        const browserLang = navigator.language || "he";
        currentLang = browserLang.startsWith("en") ? "eng" : "he";
        localStorage.setItem("lang", currentLang);
      }

      if (langSelect && selected) {
        const activeOption = langSelect.querySelector(`.options li[data-value="${currentLang}"]`);
        if (activeOption) {
          selected.innerHTML = activeOption.innerHTML;
        }
      }

      applyTranslations();
      updateDirectionAndAlign();
    })
    .catch(err => console.error("Error loading translations:", err));


  // ===== Scrollable Cards Animation =====
  /*
    כאן נשאר הקוד הקיים שלך ל-scrollable cards
  */

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

  // ===== Slider Setup =====
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
        const prev = slides[currentIndex];
        currentIndex = (currentIndex + 1) % slides.length;
        const next = slides[currentIndex];

        prev.style.opacity = 0;
        next.style.opacity = 1;
      }

      function startSliding() {
        slideInterval = setInterval(showNext, interval);
      }

      function stopSliding() {
        clearInterval(slideInterval);
      }

      const buttons = container.querySelectorAll(".sliding-img-overlay a");
      buttons.forEach(btn => {
        btn.addEventListener("mouseenter", stopSliding);
        btn.addEventListener("mouseleave", startSliding);
      });

      startSliding();
    });
  }

  // הפעלה על שני הסליידרים
  setupSliding(".weekly-activity-content-sliding-imgs");
  setupSliding(".special-activity-content-sliding-img");

});
