/* Shared navigation and page discovery. No authentication state is handled here. */
(() => {
  try {
    const savedTheme = localStorage.getItem("psu_theme");
    if (savedTheme === "dark" || savedTheme === "light")
      document.documentElement.dataset.theme = savedTheme;
  } catch {}
  const root = location.pathname.includes("/pages/") ? "../" : "./";
  const page = decodeURIComponent(
    location.pathname.split("/").pop() || "index.html",
  );
  const main = document.querySelector("main");
  if (!main || document.body.classList.contains("liquid-workspace")) return;
  document.body.classList.add("portal-redesign");
  const routes = [
    ["index.html", "หน้าหลัก", "⌂"],
    ["courses.html", "รายวิชา", "▦"],
    ["tasks.html", "งานทั้งหมด", "☑"],
    ["calendar.html", "ปฏิทิน", "▤"],
    ["liquid-glass.html", "พื้นที่โฟกัส", "◷"],
  ];
  const labels = {
    metallurgy: "โลหะวิทยา",
    polymer: "พอลิเมอร์",
    ceramic: "เซรามิก",
    biology: "ชีววิทยา",
    biolab: "ปฏิบัติการชีววิทยา",
    greenlove: "GreenLove",
    cybersecurity: "Cybersecurity",
    other_courses: "วิชาศึกษาทั่วไป",
  };
  const subject = Object.keys(labels).find(
    (key) =>
      page === key + ".html" ||
      page === key + "_tasks.html" ||
      page === key + "_summary.html",
  );
  const mode = page.endsWith("_summary.html")
    ? "สรุปและทบทวน"
    : page.endsWith("_tasks.html")
      ? "งานรายวิชา"
      : "เอกสารประกอบการเรียน";
  if (subject) {
    const h1 = main.querySelector("h1");
    if (h1) h1.textContent = `${mode} · ${labels[subject]}`;
    const subtitle = main.querySelector(".hero-subtitle");
    if (subtitle)
      subtitle.textContent =
        mode === "เอกสารประกอบการเรียน"
          ? "สไลด์ เอกสารคำสอน และไฟล์ประกอบการเรียน — เลือกเปิดอ่านจากรายการด้านล่าง"
          : "อ่านเนื้อหาตามหัวข้อ แล้วทบทวนด้วยแบบฝึกหัดและข้อสอบในหน้านี้";
    const stats = main.querySelector(".hero-stats");
    if (stats) stats.hidden = true;
    const tabs = main.querySelector(".course-3way-switcher-wrapper");
    const hero = main.querySelector(".hero");
    if (tabs && hero) hero.after(tabs);
    main.querySelectorAll(".course-3way-tab").forEach((tab) => {
      const dest = tab.getAttribute("href");
      const active = dest?.split("/").pop() === page;
      tab.classList.toggle("active", active);
      if (active) tab.setAttribute("aria-current", "page");
    });
  }
  const toolbar = main.querySelector(".main-top-bar");
  if (toolbar) {
    const title = document.createElement("div");
    title.className = "shell-title";
    title.textContent = subject
      ? labels[subject]
      : routes.find((r) => r[0] === page)?.[1] || "Materials Portal";
    const controls = document.createElement("div");
    controls.className = "shell-controls";
    const search = document.createElement("button");
    search.type = "button";
    search.className = "shell-search";
    search.textContent = "⌕ ค้นหาหน้า / รายวิชา";
    search.setAttribute("aria-keyshortcuts", "Control+k Meta+k");
    const appearance = document.createElement("button");
    appearance.type = "button";
    appearance.className = "shell-icon";
    appearance.textContent = "◐";
    appearance.setAttribute("aria-label", "สลับธีมสว่างและมืด");
    appearance.onclick = () => {
      const theme =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem("psu_theme", theme);
      } catch {}
    };
    const account = document.createElement("details");
    account.className = "shell-account";
    const summary = document.createElement("summary");
    summary.textContent = "บัญชี";
    account.append(summary);
    const accountContent = document.createElement("div");
    accountContent.className = "shell-account-panel";
    document
      .querySelectorAll(".auth-user-badge,.btn-portal-logout")
      .forEach((el) => accountContent.append(el));
    account.append(accountContent);
    controls.append(search, appearance, account);
    const menu = toolbar.querySelector(".portal-menu-button");
    toolbar.replaceChildren();
    if (menu) toolbar.append(menu);
    toolbar.append(title, controls);
    const dialog = document.createElement("dialog");
    dialog.className = "shell-search-dialog";
    dialog.innerHTML =
      '<form method="dialog"><strong>ไปที่…</strong><button aria-label="ปิดการค้นหา">×</button></form><label for="shell-query">ค้นหาหน้าหรือชื่อวิชา</label><input id="shell-query" type="search" placeholder="เช่น พอลิเมอร์ หรือ ปฏิทิน" autocomplete="off"><div class="shell-results"></div>';
    document.body.append(dialog);
    const query = dialog.querySelector("input"),
      results = dialog.querySelector(".shell-results");
    const all = routes.map(([url, label, icon]) => ({
      url: root + url,
      label,
      icon,
    }));
    Object.entries(labels).forEach(([key, name]) => {
      [
        ["", "เอกสาร"],
        ["_tasks", "งาน"],
        ["_summary", "สรุป"],
      ].forEach(([suffix, kind]) =>
        all.push({
          url: root + "pages/" + key + suffix + ".html",
          label: name + " · " + kind,
          icon: "↗",
        }),
      );
    });
    const render = () => {
      results.replaceChildren();
      const matches = all.filter((r) =>
        r.label.toLowerCase().includes(query.value.trim().toLowerCase()),
      );
      matches.forEach((r) => {
        const a = document.createElement("a");
        a.href = r.url;
        a.textContent = r.icon + "  " + r.label;
        results.append(a);
      });
      if (!matches.length) {
        const p = document.createElement("p");
        p.textContent = "ไม่พบหน้า ลองค้นหาด้วยชื่อวิชา";
        results.append(p);
      }
    };
    const open = () => {
      query.value = "";
      render();
      dialog.showModal();
      query.focus();
    };
    search.onclick = open;
    query.oninput = render;
    query.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        results.querySelector("a")?.focus();
      }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!dialog.open) open();
      }
    });
  }
  const dock = document.createElement("nav");
  dock.className = "shell-bottom-nav";
  dock.setAttribute("aria-label", "เมนูหลัก");
  routes.slice(0, 4).forEach(([url, label, icon]) => {
    const a = document.createElement("a");
    a.href = root + url;
    a.innerHTML = `<span aria-hidden="true">${icon}</span><small>${label}</small>`;
    if (page === url || (url === "courses.html" && subject))
      a.setAttribute("aria-current", "page");
    dock.append(a);
  });
  document.body.append(dock);
  const side = document.querySelector(".sidebar-nav");
  if (side && !side.querySelector("[data-courses-link]")) {
    const a = document.createElement("a");
    a.className = "side-item";
    a.href = root + "courses.html";
    a.textContent = "▦ รายวิชาทั้งหมด";
    a.dataset.coursesLink = "";
    side.prepend(a);
  }
  document.querySelectorAll(".side-item").forEach((a) => {
    if (new URL(a.href).pathname === location.pathname)
      a.setAttribute("aria-current", "page");
  });
})();
