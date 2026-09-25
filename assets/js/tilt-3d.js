/**
 * PSU Materials Portal - Universal 3D Spatial Tilt & Parallax Controller
 * Zero-dependency, lightweight, touch & gyro friendly 3D interaction.
 */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced.matches) return;

  const CARD_SELECTOR = [
    ".tilt-card",
    "[data-tilt-3d]",
    ".home-action",
    ".directory-card",
    ".glass-window",
    ".cal-card",
    ".agenda-card",
    ".stat-box",
    ".card-glass:not(.portal-layout):not(.sidebar):not(.main-top-bar)",
  ].join(", ");

  const activeCards = new WeakSet();

  function initCard(card) {
    if (!card || activeCards.has(card)) return;
    if (
      card.matches('[data-tilt="none"]') ||
      card.closest('[data-tilt="none"]')
    )
      return;

    activeCards.add(card);
    card.classList.add("tilt-card");

    // Ensure glare element exists if enabled
    const enableGlare = card.getAttribute("data-tilt-glare") !== "false";
    let glare = null;
    if (enableGlare) {
      glare = card.querySelector(".tilt-glare");
      if (!glare) {
        glare = document.createElement("span");
        glare.className = "tilt-glare";
        glare.setAttribute("aria-hidden", "true");
        card.appendChild(glare);
      }
    }

    const maxRotation = parseFloat(card.getAttribute("data-tilt-max") || "8");
    const scale = parseFloat(card.getAttribute("data-tilt-scale") || "1.02");
    let rafId = 0;

    function onPointerMove(e) {
      if (reduced.matches) return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      if (clientX === undefined || clientY === undefined) return;

      const px = Math.max(
        -1,
        Math.min(1, ((clientX - rect.left) / rect.width) * 2 - 1),
      );
      const py = Math.max(
        -1,
        Math.min(1, ((clientY - rect.top) / rect.height) * 2 - 1),
      );

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        card.classList.add("is-tilting");
        const rotX = -py * maxRotation;
        const rotY = px * maxRotation;

        card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`;

        if (glare) {
          const glareX = ((px + 1) / 2) * 100;
          const glareY = ((py + 1) / 2) * 100;
          const distance = Math.hypot(px, py);
          const opacity = Math.min(0.65, 0.2 + distance * 0.45);

          card.style.setProperty("--glare-x", `${glareX.toFixed(1)}%`);
          card.style.setProperty("--glare-y", `${glareY.toFixed(1)}%`);
          card.style.setProperty("--glare-opacity", opacity.toFixed(2));
        }
      });
    }

    function onPointerLeave() {
      if (rafId) cancelAnimationFrame(rafId);
      card.classList.remove("is-tilting");
      card.style.transform = "";
      card.style.removeProperty("--glare-x");
      card.style.removeProperty("--glare-y");
      card.style.removeProperty("--glare-opacity");
    }

    card.addEventListener("pointermove", onPointerMove, { passive: true });
    card.addEventListener("pointerleave", onPointerLeave);
    card.addEventListener("pointercancel", onPointerLeave);
  }

  function scanAndInit(root = document) {
    if (reduced.matches) return;
    const cards = root.querySelectorAll(CARD_SELECTOR);
    for (let i = 0; i < cards.length; i++) {
      initCard(cards[i]);
    }
  }

  // Mobile Device Orientation Parallax (subtle motion on phone tilt)
  let gyroBound = false;
  function initGyroscope() {
    if (gyroBound || reduced.matches || !window.DeviceOrientationEvent) return;
    gyroBound = true;

    let gyroFrame = 0;
    window.addEventListener(
      "deviceorientation",
      (e) => {
        if (!e.gamma || !e.beta) return;
        if (gyroFrame) return;

        gyroFrame = requestAnimationFrame(() => {
          gyroFrame = 0;
          const tiltX = Math.max(-10, Math.min(10, e.gamma / 3.5)); // roll (-10 to 10)
          const tiltY = Math.max(-10, Math.min(10, (e.beta - 40) / 4)); // pitch
          document.documentElement.style.setProperty(
            "--gyro-tilt-x",
            `${tiltX.toFixed(2)}deg`,
          );
          document.documentElement.style.setProperty(
            "--gyro-tilt-y",
            `${tiltY.toFixed(2)}deg`,
          );
        });
      },
      { passive: true },
    );
  }

  // Bootstrapping
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      scanAndInit();
      initGyroscope();
    });
  } else {
    scanAndInit();
    initGyroscope();
  }

  // Observe dynamically added cards
  if ("MutationObserver" in window) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length) {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              if (node.matches && node.matches(CARD_SELECTOR)) {
                initCard(node);
              }
              scanAndInit(node);
            }
          });
        }
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Listen for reduced motion changes
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      document.querySelectorAll(".tilt-card").forEach((card) => {
        card.style.transform = "";
      });
    }
  });

  window.PSU_Tilt3D = {
    initCard,
    scanAndInit,
  };
})();
