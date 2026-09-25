/* Shared spatial styling and the existing mascot extracted from the แมว reference. */
(() => {
  "use strict";
  const asset = new URL(
    "../images/mascot/mascot-welcome.webp",
    document.currentScript.src,
  ).href;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia(
    "(hover: hover) and (pointer: fine) and (min-width: 701px)",
  );
  const selector = ".home-action, .directory-card, .stat-box, [data-tilt-3d]";
  const active = new WeakSet();
  const resets = new Set();

  function companion(caption, small = false) {
    const figure = document.createElement("figure");
    figure.className = small
      ? "spatial-companion spatial-companion--small"
      : "spatial-companion";
    const img = document.createElement("img");
    img.src = asset;
    img.alt = small ? "" : "แมวสีขาวสวมแว่นฟ้าและกระเป๋า PSU";
    img.width = 1254;
    img.height = 1254;
    img.decoding = "async";
    if (small) img.loading = "lazy";
    img.addEventListener("error", () => {
      figure.hidden = true;
    });
    figure.append(img);
    if (caption) {
      const label = document.createElement("figcaption");
      label.textContent = caption;
      figure.append(label);
    } else figure.setAttribute("aria-hidden", "true");
    return figure;
  }

  function initCard(card) {
    if (active.has(card) || card.closest('[data-tilt="none"]')) return;
    active.add(card);
    card.classList.add("tilt-card");
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      card.classList.remove("is-tilting");
      card.style.removeProperty("transform");
      card.style.removeProperty("--glare-x");
      card.style.removeProperty("--glare-y");
      resets.delete(reset);
    };
    card.addEventListener(
      "pointermove",
      (event) => {
        if (reduced.matches || !fine.matches || event.pointerType === "touch")
          return;
        const box = card.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const x = Math.max(
          -1,
          Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1),
        );
        const y = Math.max(
          -1,
          Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1),
        );
        cancelAnimationFrame(frame);
        resets.add(reset);
        frame = requestAnimationFrame(() => {
          card.classList.add("is-tilting");
          card.style.transform = `perspective(1000px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg) translateY(-4px)`;
          card.style.setProperty("--glare-x", `${(x + 1) * 50}%`);
          card.style.setProperty("--glare-y", `${(y + 1) * 50}%`);
        });
      },
      { passive: true },
    );
    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointercancel", reset);
    card.addEventListener("focusout", reset);
  }
  function scanAndInit(root = document) {
    if (root.matches?.(selector)) initCard(root);
    root.querySelectorAll(selector).forEach(initCard);
  }
  function boot() {
    document.body.classList.add("spatial-portal");
    const main = document.querySelector("main");
    const hero =
      main?.querySelector(
        ".home-intro, .task-hero, .calendar-hero, .workspace-hero, header.hero",
      ) || main?.querySelector("h1")?.parentElement;
    const page = location.pathname.split("/").pop();
    const captions = {
      "courses.html": "เลือกวิชาที่อยากเรียน แล้วไปด้วยกัน",
      "tasks.html": "ค่อย ๆ ทำไป ทีละงานก็เก่งแล้ว",
      "calendar.html": "วางแผนอีกนิด แล้วมีเวลาพักด้วยนะ",
      "liquid-glass.html": "หายใจลึก ๆ แล้วมาโฟกัสกัน",
    };
    if (hero && !hero.querySelector(".home-companion, .spatial-companion")) {
      hero.classList.add("spatial-hero");
      hero.setAttribute("data-tilt", "none");
      hero.append(
        companion(
          captions[page] ||
            (page.endsWith("_tasks.html")
              ? "ทำทีละข้อ เราอยู่เป็นเพื่อน"
              : "พร้อมเรียนรู้ไปด้วยกัน"),
        ),
      );
    }
    document
      .querySelectorAll(".home-action:first-child, .home-action:last-child")
      .forEach((card) => {
        card.classList.add("has-companion");
        card.append(companion("", true));
      });
    scanAndInit();
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) scanAndInit(node);
        }
    }).observe(document.body, { childList: true, subtree: true });
  }
  const resetAll = () => resets.forEach((reset) => reset());
  reduced.addEventListener("change", resetAll);
  fine.addEventListener("change", resetAll);
  window.addEventListener("blur", resetAll);
  window.PSU_Tilt3D = { initCard, scanAndInit };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
