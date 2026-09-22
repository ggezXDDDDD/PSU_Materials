// Opt-in prototype interactions. No task data, auth state or persistent preference writes.
(() => {
  const root = document.querySelector(".ag-root");
  if (!root) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const effects = root.querySelector("#ag-effects");
  const theme = root.querySelector("[data-ag-theme]");
  theme.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    theme.setAttribute("aria-label", dark ? "ใช้ธีมสว่าง" : "ใช้ธีมมืด");
  });
  effects.addEventListener("change", () => {
    root.dataset.effects = effects.checked ? "on" : "off";
  });
  const navigation = [...root.querySelectorAll('.ag-nav-item[href^="#"]')];
  const updateNavigation = () => {
    navigation.forEach((link) => {
      if (link.hash === (location.hash || "#overview"))
        link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };
  window.addEventListener("hashchange", updateNavigation);
  updateNavigation();
  const input = root.querySelector("#ag-query");
  const shortcuts = [...root.querySelectorAll("[data-ag-search]")];
  const search = () => {
    const query = input.value.trim().toLocaleLowerCase("th");
    shortcuts.forEach((a) => {
      a.hidden = !a.dataset.agSearch.includes(query);
    });
    const count = shortcuts.filter((a) => !a.hidden).length;
    root.querySelector("#ag-search-status").textContent = count
      ? `${count} ทางลัด · ค้นหาเฉพาะเมนูในต้นแบบ`
      : "ไม่พบทางลัด ลองค้นหาว่า งาน หรือ ปฏิทิน";
  };
  input.addEventListener("input", search);
  input.form.addEventListener("submit", (e) => {
    e.preventDefault();
    search();
  });
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const selectTab = (tab) => {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden =
        !selected;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const target =
        e.key === "Home"
          ? tabs[0]
          : e.key === "End"
            ? tabs.at(-1)
            : tabs[
                (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                  tabs.length
              ];
      selectTab(target);
      target.focus();
    });
  });
  const dialog = root.querySelector("#ag-dialog");
  root
    .querySelector("[data-ag-open-dialog]")
    .addEventListener("click", () => dialog.showModal());
  const toast = root.querySelector(".ag-toast");
  root.querySelector("[data-ag-notify]").addEventListener("click", () => {
    toast.hidden = false;
  });
  root
    .querySelector("[data-ag-demo-complete]")
    .addEventListener("click", () => {
      toast.hidden = false;
    });
  root.querySelector("[data-ag-dismiss]").addEventListener("click", () => {
    toast.hidden = true;
  });
  const dates = [...root.querySelectorAll(".ag-calendar-tile")];
  dates.forEach((button) =>
    button.addEventListener("click", () => {
      dates.forEach((d) => {
        d.setAttribute("aria-pressed", String(d === button));
        d.querySelector("span")?.remove();
      });
      const label = document.createElement("span");
      label.textContent = "เลือกอยู่";
      button.append(label);
    }),
  );
  root.querySelectorAll(".ag-mascot-sheet").forEach((img) => {
    const failed = () => {
      img.hidden = true;
      img.parentElement.dataset.missing = "";
    };
    img.addEventListener("error", failed);
    if (img.complete && !img.naturalWidth) failed();
  });
  root.querySelectorAll("[data-ag-ripple]").forEach((button) =>
    button.addEventListener("pointerdown", (e) => {
      if (reduced.matches || !effects.checked) return;
      const box = button.getBoundingClientRect(),
        ripple = document.createElement("span");
      ripple.className = "ag-ripple";
      ripple.setAttribute("aria-hidden", "true");
      ripple.style.left = `${e.clientX - box.left}px`;
      ripple.style.top = `${e.clientY - box.top}px`;
      button.append(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), {
        once: true,
      });
      setTimeout(() => ripple.remove(), 550);
    }),
  );
  // One card, one queued frame at most. No idle rendering loop or device sensors.
  const card = root.querySelector("[data-ag-tilt]");
  let frame = 0;
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    card.style.removeProperty("--ag-rx");
    card.style.removeProperty("--ag-ry");
  };
  card.addEventListener(
    "pointermove",
    (e) => {
      if (!fine.matches || reduced.matches || !effects.checked || frame) return;
      const box = card.getBoundingClientRect();
      const x = Math.max(
        -1,
        Math.min(1, ((e.clientX - box.left) / box.width) * 2 - 1),
      );
      const y = Math.max(
        -1,
        Math.min(1, ((e.clientY - box.top) / box.height) * 2 - 1),
      );
      frame = requestAnimationFrame(() => {
        frame = 0;
        card.style.setProperty("--ag-rx", `${-y * 3}deg`);
        card.style.setProperty("--ag-ry", `${x * 4}deg`);
      });
    },
    { passive: true },
  );
  card.addEventListener("pointerleave", reset);
  effects.addEventListener("change", reset);
  reduced.addEventListener("change", reset);
  fine.addEventListener("change", reset);
  window.addEventListener("pagehide", reset);
})();
