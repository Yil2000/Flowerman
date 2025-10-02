document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll("#sidebar button");
  const sections = document.querySelectorAll(".section");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;

      // מסתיר את כל החלונות
      sections.forEach(sec => sec.classList.remove("active"));

      // מציג רק את הנבחר
      document.getElementById(target).classList.add("active");
    });
  });

  // דוגמה בסיסית להעלאה
  const uploadBtn = document.getElementById("upload-btn");
  uploadBtn.addEventListener("click", () => {
    const tag = document.getElementById("upload-tag").value;
    const files = document.getElementById("upload-files").files;

    if (!tag || files.length === 0) {
      alert("אנא מלא תג ובחר קבצים");
      return;
    }

    document.getElementById("upload-status").innerText =
      `נבחרו ${files.length} קבצים עם תג "${tag}" (במצב DEV זה לא נשלח)`;
  });
});
