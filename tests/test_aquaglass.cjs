// Design-only regression against a local static preview; auth is mocked only in this browser.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.PSU_TEST_URL || "http://127.0.0.1:8765";
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route("**/assets/js/auth.js*", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "" }),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const responses = [];
    page.on("response", (r) => {
      if (r.url().startsWith(base))
        responses.push({ url: r.url(), status: r.status() });
    });
    await page.goto(base + "/pages/aquaglass-prototype.html");
    await page
      .locator(".ag-mascot-sheet")
      .first()
      .evaluate((img) => img.decode());
    for (const width of [360, 390, 412, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        assert.equal(
          await page
            .locator(".ag-hero .ag-button--primary")
            .evaluate((e) => getComputedStyle(e).color),
          "rgb(17, 62, 86)",
          "Primary label stays dark on the pale aqua surface in both themes",
        );
        for (const motion of ["no-preference", "reduce"]) {
          await page.emulateMedia({ reducedMotion: motion });
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${width}/${theme}/${motion} overflow`,
          );
          const small = await page
            .locator(
              "button:visible,.ag-button:visible,.ag-nav-item:visible,.ag-switch:visible",
            )
            .evaluateAll(
              (elements) =>
                elements.filter((e) => e.getBoundingClientRect().height < 44)
                  .length,
            );
          assert.equal(small, 0, "touch targets must be 44px");
          if (motion === "reduce")
            assert.equal(
              await page
                .locator(".ag-tilt")
                .evaluate((e) => getComputedStyle(e).transform),
              "none",
            );
        }
        if (width === 390 || width === 1440)
          await page.screenshot({
            path: `/tmp/psu-aquaglass-${width}-${theme}.png`,
            fullPage: true,
            animations: "disabled",
          });
        console.log(
          `PASS AquaGlass ${width}/${theme}: overflow, touch targets, reduced motion`,
        );
      }
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#ag-query").fill("ไม่มีทางลัดนี้");
    assert.equal(await page.locator("[data-ag-search]:visible").count(), 0);
    assert.match(
      await page.locator("#ag-search-status").textContent(),
      /ไม่พบ/,
    );
    await page.locator("#ag-query").fill("งาน");
    assert.equal(await page.locator("[data-ag-search]:visible").count(), 1);
    await page.locator("#ag-query").fill("");
    assert.equal(await page.locator("[data-ag-search]:visible").count(), 3);
    await page.locator("#ag-tab-upcoming").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.locator("#ag-tab-done").getAttribute("aria-selected"),
      "true",
    );
    assert(await page.locator("#ag-panel-done").isVisible());
    await page.keyboard.press("Home");
    assert(await page.locator("#ag-panel-upcoming").isVisible());
    await page.locator("[data-ag-open-dialog]").click();
    assert(
      await page
        .locator("#ag-dialog")
        .evaluate((d) => d.open && d.contains(document.activeElement)),
    );
    await page.keyboard.press("Escape");
    assert(!(await page.locator("#ag-dialog").evaluate((d) => d.open)));
    assert(
      await page
        .locator("[data-ag-open-dialog]")
        .evaluate((b) => b === document.activeElement),
    );
    await page.locator("[data-ag-notify]").click();
    assert(await page.locator(".ag-toast").isVisible());
    await page.locator("[data-ag-dismiss]").click();
    assert(!(await page.locator(".ag-toast").isVisible()));
    await page.locator("#ag-effects").uncheck();
    assert.equal(
      await page.locator("body").getAttribute("data-effects"),
      "off",
    );
    await page.locator(".ag-calendar-tile").first().click();
    assert.equal(
      await page.locator('.ag-calendar-tile[aria-pressed="true"]').count(),
      1,
    );
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    await page.locator("[data-ag-theme]").click();
    assert.equal(
      await page.evaluate(() => JSON.stringify(localStorage)),
      stored,
      "Prototype does not write persistent preferences",
    );
    assert.deepEqual(errors, []);
    assert(
      responses.every((r) => r.status < 400),
      "All local assets resolve",
    );
    console.log(
      "PASS search, keyboard tabs, modal focus/Escape, toggle, toast, selection, no storage writes",
    );
    // Simulate an absent source sheet without altering the supplied images.
    await page.route("**/%E0%B9%81%E0%B8%A1%E0%B8%A7/**", (r) => r.abort());
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector(".ag-mascot").hasAttribute("data-missing"),
    );
    assert(await page.locator(".ag-mascot-fallback").first().isVisible());
    assert(await page.locator(".ag-hero .ag-button--primary").isVisible());
    console.log("PASS missing-mascot fallback");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
