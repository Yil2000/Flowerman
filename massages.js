document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("share-form");
  const nameInput = document.getElementById("share-name");
  const messageInput = document.getElementById("share-massege");
  const fileInput = document.getElementById("file");
  const clearFileBtn = document.getElementById("clear-file");

  // ניקוי קובץ בלחיצה על X
  clearFileBtn.addEventListener("click", (e) => {
    e.preventDefault();
    fileInput.value = "";
  });

  // טיפול בשליחת הטופס
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", nameInput.value.trim());
    formData.append("message", messageInput.value.trim());

    if (fileInput.files.length > 0) {
      formData.append("file", fileInput.files[0]);
    }

    try {
      const response = await fetch("/shares", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Server error:", data);
        alert(data.error || "שגיאה בשליחה. נסו שוב מאוחר יותר.");
        return;
      }

      // הצלחה 🎉
      alert("🎉 תודה! השיתוף שלך נשלח בהצלחה וימתין לאישור מנהל.");
      form.reset();

    } catch (err) {
      console.error("Client error:", err);
      alert("שגיאה בשליחה. ייתכן שאין חיבור לשרת.");
    }
  });
});
