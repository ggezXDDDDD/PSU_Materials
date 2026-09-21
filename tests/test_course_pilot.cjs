// Compare the rendered pilot before/after CSS extraction with auth isolated.
const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const baseline = process.env.PSU_PILOT_BASELINE;
if (!baseline)
  throw new Error("Set PSU_PILOT_BASELINE to a temporary JSON snapshot path");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  try {
    const context = await browser.newContext({
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.route("**/assets/js/auth.js*", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "" }),
    );
    // Keep optional external math/font resources deterministic for both captures.
    await context.route(/^https:\/\//, (r) => r.abort());
    if (process.env.PSU_RECORD_BASELINE) {
      const original = execFileSync(
        "git",
        ["show", "HEAD:pages/metallurgy.html"],
        { encoding: "utf8" },
      );
      await context.route("**/pages/metallurgy.html", (r) =>
        r.fulfill({ contentType: "text/html", body: original }),
      );
    }
    const page = await context.newPage();
    const snapshots = [];
    for (const width of [360, 390, 412, 480, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(
        (process.env.PSU_TEST_URL || "http://127.0.0.1:8765") +
          "/pages/metallurgy.html",
      );
      await page.locator("body.portal-redesign").waitFor();
      await page.addStyleTag({
        content:
          "html body.portal-redesign.portal-redesign.portal-redesign, html body.portal-redesign.portal-redesign.portal-redesign *, html body.portal-redesign.portal-redesign.portal-redesign *::before, html body.portal-redesign.portal-redesign.portal-redesign *::after { animation: none !important; transition: none !important; }",
      });
      await page.evaluate(() => document.fonts.ready);
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        await page.locator("h1").waitFor();
        const snapshot = await page.evaluate(() => ({
          width: innerWidth,
          theme: document.documentElement.dataset.theme,
          overflow: document.documentElement.scrollWidth > innerWidth,
          links: [...document.querySelectorAll("main a")].map((a) => [
            a.getAttribute("href"),
            a.textContent.trim(),
          ]),
          elements: [
            ...document.querySelectorAll(
              "main h1, main h2, .hero, .course-3way-tab, .file-card, .main-top-bar",
            ),
          ].map((el) => {
            const s = getComputedStyle(el),
              r = el.getBoundingClientRect();
            return [
              el.className,
              ...[
                "width",
                "height",
                "fontSize",
                "color",
                "backgroundColor",
                "display",
                "padding",
                "borderRadius",
              ].map((k) => s[k]),
              Math.round(r.x),
              Math.round(r.y),
            ];
          }),
        }));
        snapshots.push(snapshot);
        if (width === 390 && theme === "light")
          await page.screenshot({
            path:
              baseline +
              (process.env.PSU_RECORD_BASELINE ? ".before.png" : ".after.png"),
            animations: "disabled",
          });
      }
    }
    if (process.env.PSU_RECORD_BASELINE) {
      fs.writeFileSync(baseline, JSON.stringify(snapshots));
      console.log("Recorded 12 course layout/theme baselines");
    } else {
      assert.deepEqual(
        snapshots,
        JSON.parse(fs.readFileSync(baseline, "utf8")),
      );
      console.log(
        "PASS: identical course layout, styles, text and links at 6 widths / 2 themes",
      );
    }
    console.log(
      "Overflow cases:",
      snapshots.filter((s) => s.overflow).map((s) => `${s.width}/${s.theme}`),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
