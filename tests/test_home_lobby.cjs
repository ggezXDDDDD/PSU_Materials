// Run against a local static preview. Set NODE_PATH to an installed Playwright.
// Auth is mocked ONLY here to isolate visual tests; test_auth_security.py tests real auth.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.PSU_TEST_URL || "http://127.0.0.1:8765";

(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: [
      "--enable-webgl",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route("**/assets/js/auth.js*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "/* Visual test auth stub */",
      }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [360, 390, 412, 480, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/index.html");
      await page.locator(".home-lobby[data-ready]").waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow at ${width}`,
      );
      assert.equal(await page.locator(".lobby-destinations a").count(), 3);
      for (const link of await page.locator(".lobby-destinations a").all()) {
        const box = await link.boundingBox();
        assert(box.height >= 44, `small target at ${width}`);
        assert.equal(
          (
            await context.request.get(
              new URL(await link.getAttribute("href"), base).href,
            )
          ).status(),
          200,
        );
      }
      if (width === 390 || width === 1440) {
        // Scroll through existing reveal animations before capturing the full page.
        for (const card of await page
          .locator(".home-action, .home-secondary .card-glass")
          .all()) {
          await card.scrollIntoViewIfNeeded();
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator(".home-lobby[data-ready]").waitFor();
        await page.screenshot({
          path: `/tmp/psu-lobby-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      console.log(
        `PASS viewport ${width}: WebGL, links, overflow, tap targets`,
      );
    }
    await page.locator(".shell-icon").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.screenshot({ path: "/tmp/psu-lobby-dark.png", fullPage: true });
    await page.selectOption("#lobby-quality", "lite");
    assert.equal(await page.locator("#lobby-canvas canvas").count(), 0);
    await page.reload();
    assert.equal(await page.locator("#lobby-quality").inputValue(), "lite");
    assert.equal(await page.locator("#lobby-canvas canvas").count(), 0);
    await page.selectOption("#lobby-quality", "balanced");
    await page.locator(".home-lobby[data-ready]").waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(
      () => document.querySelector(".home-lobby").dataset.quality === "lite",
    );
    assert.equal(await page.locator("#lobby-canvas canvas").count(), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator(".home-lobby[data-ready]").waitFor();
    await page.evaluate(() =>
      document
        .querySelector("#lobby-canvas canvas")
        .dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
    assert.equal(await page.locator("#lobby-canvas canvas").count(), 0);
    assert.match(await page.locator("#lobby-status").textContent(), /2D/);
    await page.locator('[data-lobby-route="calendar"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/calendar.html");
    const month = await page.locator("#current-month-label").textContent();
    await page.locator('[onclick="changeMonth(1)"]').click();
    assert.notEqual(
      await page.locator("#current-month-label").textContent(),
      month,
    );
    await page.locator('[onclick="changeMonth(-1)"]').click();
    assert.equal(
      await page.locator("#current-month-label").textContent(),
      month,
    );
    await page.locator(".cal-cell[onclick]").first().click();
    assert(await page.locator("#day-modal").isVisible());
    await page.locator(".modal-close-btn").click();
    await page.goto(base + "/tasks.html");
    const total = await page.locator(".assignment-card:visible").count();
    assert(total > 0);
    await page.locator("#task-search-input").fill("__no_matching_task__");
    assert.equal(await page.locator(".assignment-card:visible").count(), 0);
    await page.locator("#task-search-input").fill("");
    assert.equal(await page.locator(".assignment-card:visible").count(), total);
    console.log(
      "PASS existing calendar month/day controls and task search/reset",
    );
    console.log(
      "PASS theme, preference persistence, reduced motion, context loss, keyboard navigation",
    );
    // Independent context: no cached module can hide an import failure.
    const fallback = await browser.newContext({ serviceWorkers: "block" });
    await fallback.route("**/assets/js/auth.js*", (route) =>
      route.fulfill({ contentType: "application/javascript", body: "" }),
    );
    await fallback.route("**/vendor/three/**", (route) => route.abort());
    const p = await fallback.newPage();
    await p.goto(base + "/index.html");
    await p.waitForFunction(() =>
      document.getElementById("lobby-status").textContent.includes("ไม่พร้อม"),
    );
    assert.equal(await p.locator(".lobby-destinations a").count(), 3);
    assert.equal(await p.locator("#lobby-canvas canvas").count(), 0);
    console.log("PASS library failure fallback");
    const unsupported = await browser.newContext({ serviceWorkers: "block" });
    await unsupported.route("**/assets/js/auth.js*", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "" }),
    );
    await unsupported.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type.includes("webgl") ? null : get.call(this, type, ...args);
      };
    });
    const noGPU = await unsupported.newPage();
    await noGPU.goto(base + "/index.html");
    await noGPU.waitForFunction(() =>
      document.getElementById("lobby-status").textContent.includes("ไม่พร้อม"),
    );
    assert.equal(await noGPU.locator("#lobby-canvas canvas").count(), 0);
    const noJS = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    const plain = await noJS.newPage();
    await plain.goto(base + "/index.html");
    assert.equal(
      await plain.locator(".lobby-destinations a:visible").count(),
      3,
    );
    console.log(
      "PASS WebGL unavailable and JavaScript-disabled HTML fallback (static preview)",
    );
    assert.deepEqual(errors, [], "browser exceptions");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
