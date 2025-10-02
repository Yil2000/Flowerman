document.addEventListener("DOMContentLoaded", () => {
  const accessToggle = document.querySelector(".access-logo");
  const accessPanel = document.querySelector(".access-content");
  const site = document.getElementById("site-content");

  let currentFontSize = 1;
  let isGrayscale = false;
  let isHighContrast = false;
  let isInverted = false;
  let isLightBg = false;
  let linksHighlighted = false;
  let isReadableFont = false;

  accessToggle.onclick = () => {
    accessPanel.style.display =
      accessPanel.style.display === "flex" ? "none" : "flex";
  };

  const updateAccessButtonBackground = (button, active) => {
    button.style.backgroundColor = active ? "#7e90df63" : "";
  };

  const increaseText = (button) => {
    if (currentFontSize < 1.8) {
      currentFontSize += 0.1;
      site.style.fontSize = currentFontSize + "em";
      site.querySelectorAll("a").forEach((a) => {
        a.style.fontSize = currentFontSize + "em";
      });
      updateAccessButtonBackground(button, true);
    }
  };

  const decreaseText = (button) => {
    if (currentFontSize > 0.6) {
      currentFontSize -= 0.1;
      site.style.fontSize = currentFontSize + "em";
      site.querySelectorAll("a").forEach((a) => {
        a.style.fontSize = currentFontSize + "em";
      });
      updateAccessButtonBackground(button, true);
    }
  };

  const toggleGrayscale = (button) => {
    isGrayscale = !isGrayscale;
    updateFilters();
    updateAccessButtonBackground(button, isGrayscale);
  };

  const toggleHighContrast = (button) => {
    isHighContrast = !isHighContrast;
    site.classList.toggle("high-contrast", isHighContrast);

    // התמונות גם משתנות בניגודיות גבוהה
    site.querySelectorAll("img").forEach((img) => {
      img.style.filter = isHighContrast ? "contrast(2) brightness(1.2)" : "";
    });

    updateAccessButtonBackground(button, isHighContrast);
  };

  const toggleInverted = (button) => {
    isInverted = !isInverted;
    updateFilters();
    updateAccessButtonBackground(button, isInverted);
  };

  const toggleLightBackground = (button) => {
    isLightBg = !isLightBg;
    site.querySelectorAll("*").forEach((el) => {
      el.style.backgroundColor = isLightBg ? "#fff" : "";
      el.style.color = isLightBg ? "#000" : "";
    });
    site.style.backgroundColor = isLightBg ? "#fff" : "";
    site.style.color = isLightBg ? "#000" : "";
    updateAccessButtonBackground(button, isLightBg);
  };

  const toggleHighlightLinks = (button) => {
    linksHighlighted = !linksHighlighted;
    site.querySelectorAll("a").forEach((link) => {
      link.style.outline = linksHighlighted ? "3px solid orange" : "";
      link.style.backgroundColor = linksHighlighted ? "yellow" : "";
    });
    updateAccessButtonBackground(button, linksHighlighted);
  };

  const toggleReadableFont = (button) => {
    isReadableFont = !isReadableFont;
    const font = isReadableFont ? "Arial, sans-serif" : "";
    site.style.fontFamily = font;
    site.querySelectorAll("*").forEach((el) => {
      el.style.fontFamily = font;
    });
    updateAccessButtonBackground(button, isReadableFont);
  };

  const resetAccessibility = (button) => {
    currentFontSize = 1;
    site.style.fontSize = "1em";
    isGrayscale = false;
    isHighContrast = false;
    isInverted = false;
    isLightBg = false;
    linksHighlighted = false;
    isReadableFont = false;

    site.style.filter = "none";
    site.classList.remove("high-contrast");
    site.style.backgroundColor = "";
    site.style.color = "";
    site.style.fontFamily = "";

    site.querySelectorAll("img").forEach((img) => {
      img.style.filter = "";
    });

    site.querySelectorAll("*").forEach((el) => {
      el.style.backgroundColor = "";
      el.style.color = "";
    });

    site.querySelectorAll("a").forEach((link) => {
      link.style.outline = "";
      link.style.backgroundColor = "";
      link.style.fontSize = "";
    });

    buttons.forEach((btn) => updateAccessButtonBackground(btn, false));
  };

  const updateFilters = () => {
    let filterValue = "";
    if (isGrayscale) filterValue += "grayscale(1) ";
    if (isInverted) filterValue += "invert(1) hue-rotate(180deg) ";
    site.style.filter = filterValue.trim() || "none";

    if (!isInverted) {
      site.querySelectorAll("img").forEach((img) => {
        img.style.filter = isHighContrast ? "contrast(2) brightness(1.2)" : "";
      });
    }
  };

  const buttons = document.querySelectorAll(".access-content button");

  if (buttons.length >= 9) {
    buttons[0].addEventListener("click", () => increaseText(buttons[0]));
    buttons[1].addEventListener("click", () => decreaseText(buttons[1]));
    buttons[2].addEventListener("click", () => toggleGrayscale(buttons[2]));
    buttons[3].addEventListener("click", () => toggleHighContrast(buttons[3]));
    buttons[4].addEventListener("click", () => toggleInverted(buttons[4]));
    buttons[5].addEventListener("click", () => toggleLightBackground(buttons[5]));
    buttons[6].addEventListener("click", () => toggleHighlightLinks(buttons[6]));
    buttons[7].addEventListener("click", () => toggleReadableFont(buttons[7]));
    buttons[8].addEventListener("click", () => resetAccessibility(buttons[8]));
  } else {
    console.warn("לא נמצאו מספיק כפתורים בתפריט הנגישות");
  }
});
