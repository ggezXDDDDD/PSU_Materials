// Read-only Home previews. Task mutation, filtering and completion stay on Tasks.
(() => {
  const month = document.getElementById("home-month");
  const label = document.getElementById("home-month-label");
  let midnightTimer;
  function renderMonth() {
    clearTimeout(midnightTimer);
    const now = new Date(),
      year = now.getFullYear(),
      index = now.getMonth();
    label.textContent = new Intl.DateTimeFormat("th-TH", {
      month: "long",
      year: "numeric",
    }).format(now);
    month.replaceChildren();
    for (const text of ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."]) {
      const cell = document.createElement("span");
      cell.textContent = text;
      month.append(cell);
    }
    midnightTimer = setTimeout(
      renderMonth,
      new Date(year, index, now.getDate() + 1) - now + 50,
    );
    const offset = (new Date(year, index, 1).getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) {
      const spacer = document.createElement("i");
      spacer.setAttribute("aria-hidden", "true");
      month.append(spacer);
    }
    const days = new Date(year, index + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const cell = document.createElement("time");
      cell.dateTime = `${year}-${String(index + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cell.textContent = String(day);
      if (day === now.getDate()) {
        cell.setAttribute("aria-current", "date");
        cell.setAttribute("aria-label", `วันนี้ ${day} ${label.textContent}`);
      }
      month.append(cell);
    }
  }
  renderMonth();
  window.addEventListener("focus", renderMonth);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderMonth();
  });
  const mascot = document.getElementById("home-mascot");
  const missing = () => {
    mascot.hidden = true;
    mascot.parentElement.dataset.missing = "";
  };
  mascot.addEventListener("error", missing);
  if (mascot.complete && !mascot.naturalWidth) missing();
  const list = document.getElementById("home-snapshot-list"),
    status = document.getElementById("home-snapshot-status");
  async function loadSnapshot() {
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 8000);
    status.textContent = "กำลังอ่านรายการจากไฟล์ซิงค์…";
    try {
      const response = await fetch(
        new URL("data/tasks_live.json", document.baseURI),
        { signal: controller.signal, cache: "no-store" },
      );
      if (!response.ok) throw Error("Snapshot unavailable");
      const tasks = await response.json();
      if (
        !Array.isArray(tasks) ||
        !tasks.every(
          (t) =>
            t && typeof t.title === "string" && typeof t.status === "string",
        )
      )
        throw Error("Invalid snapshot");
      // due_date is display text, not a normalized timestamp. Do not guess urgency or sort by date.
      const selected = tasks
        .filter((t) => t.status === "pending" || t.status === "quiz")
        .slice(0, 3);
      const fragment = document.createDocumentFragment();
      for (const task of selected) {
        const li = document.createElement("li"),
          title = document.createElement("strong"),
          detail = document.createElement("span");
        title.textContent = task.title;
        detail.textContent = [task.course_name, task.due_date, task.status_text]
          .filter((v) => typeof v === "string" && v.trim())
          .join(" · ");
        li.append(title, detail);
        fragment.append(li);
      }
      list.replaceChildren(fragment);
      status.textContent = selected.length
        ? "ตัวอย่างจากไฟล์ซิงค์ · ไม่ใช่รายการทั้งหมดหรือสถานะสดจาก LMS"
        : "ไม่มีงานรอส่งในไฟล์ซิงค์ · ตรวจรายการทั้งหมดใน Tasks อีกครั้ง";
    } catch {
      status.textContent =
        "ยังอ่านไฟล์ซิงค์ไม่ได้ · เปิดหน้า Tasks เพื่อดูรายการงาน";
    } finally {
      clearTimeout(timeout);
    }
  }
  loadSnapshot();
})();
