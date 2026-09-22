// Run against a local static preview. Authentication is mocked for UI coverage only.
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
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [360, 390, 412, 480, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/calendar.html`);
      await page.locator("#calendar-grid .cal-cell").first().waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `horizontal overflow at ${width}`,
      );
      assert.equal(await page.locator(".cal-day-header").count(), 7);
      assert(
        await page
          .locator(".cal-grid-wrapper")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
        `calendar grid scrolls sideways at ${width}`,
      );
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
      await page.locator('.filter-chip[data-filter="metal"]').click();
      assert(
        await page.locator('.filter-chip[data-filter="metal"].active').count(),
      );
      await page.locator(".cal-cell[onclick]").first().click();
      assert(await page.locator("#day-modal").isVisible());
      await page.locator(".modal-close-btn").click();
      if (width === 390 || width === 1440) {
        await page.screenshot({
          path: `/tmp/psu-calendar-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      console.log(
        `PASS Calendar ${width}px: responsive grid, month, filter, modal`,
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
