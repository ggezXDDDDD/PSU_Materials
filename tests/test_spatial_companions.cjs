// Local visual regression: auth is stubbed only to inspect the portal UI.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.PSU_TEST_URL || "http://127.0.0.1:8765";
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route("**/assets/js/auth.js*", (route) =>
      route.fulfill({ contentType: "application/javascript", body: "" }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const file of [
        "index.html",
        "courses.html",
        "tasks.html",
        "calendar.html",
        "liquid-glass.html",
        "pages/polymer.html",
        "pages/polymer_tasks.html",
        "pages/polymer_summary.html",
      ]) {
        await page.goto(`${base}/${file}`);
        await page.locator(".spatial-companion img").first().waitFor();
        await page
          .locator(".spatial-companion img")
          .evaluateAll((images) =>
            images.forEach((img) => (img.loading = "eager")),
          );
        await page.waitForFunction(() =>
          [...document.querySelectorAll(".spatial-companion img")].every(
            (img) => img.complete && img.naturalWidth > 0,
          ),
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${file} overflow at ${width}`,
        );
        const overlap = await page.evaluate(() => {
          const hero = document.querySelector(".spatial-hero");
          if (!hero) return false;
          const a = hero.querySelector("h1").getBoundingClientRect();
          const b = hero
            .querySelector(".spatial-companion")
            .getBoundingClientRect();
          return (
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top
          );
        });
        assert(!overlap, `${file} heading overlaps mascot at ${width}`);
        assert.equal(
          await page.locator(".glass-window.tilt-card").count(),
          0,
          "Draggable windows must keep their positioning transform",
        );
        if (
          [
            "index.html",
            "courses.html",
            "tasks.html",
            "liquid-glass.html",
          ].includes(file)
        )
          await page.screenshot({
            path: `/tmp/psu-spatial-${file}-${width}.png`,
            animations: "disabled",
          });
        console.log(
          `PASS ${file} at ${width}: mascot loaded, no overflow or heading overlap`,
        );
      }
    }
    await page.goto(`${base}/courses.html`);
    const card = page.locator(".directory-card").first();
    await card.hover({ position: { x: 20, y: 20 } });
    await page.waitForFunction(() =>
      document
        .querySelector(".directory-card")
        .classList.contains("is-tilting"),
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await card.evaluate((el) => el.style.transform), "");
    assert.equal(
      await page
        .locator(".spatial-companion img")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "dark"),
    );
    await page.screenshot({
      path: "/tmp/psu-spatial-dark.png",
      animations: "disabled",
    });
    await page.route("**/mascot-welcome.webp", (route) => route.abort());
    await page.reload();
    await page.waitForFunction(
      () => document.querySelector(".spatial-companion").hidden,
    );
    assert(await page.locator("h1").isVisible());
    assert.deepEqual(errors, []);
    console.log(
      "PASS tilt, reduced motion, dark theme and missing image fallback; no JS errors",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
