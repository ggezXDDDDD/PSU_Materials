// Home-only regression: synthetic snapshot data, no real LMS content in captures.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const handlers = {};
const worker = fs.readFileSync("sw.js", "utf8");
vm.runInNewContext(worker, {
  self: { addEventListener: (name, fn) => (handlers[name] = fn) },
  URL,
});
handlers.fetch({
  request: {
    url: "https://example.test/PSU_Materials/data/tasks_live.json",
    method: "GET",
    cache: "no-store",
  },
  respondWith: () => assert.fail("fresh snapshot intercepted"),
});
for (const [, path] of worker.matchAll(/'\.\/([^']+)'/g))
  assert(fs.existsSync(path.split("?")[0]), path);
console.log("PASS service worker fresh snapshot bypass and precache paths");
const base = process.env.PSU_TEST_URL || "http://127.0.0.1:8765";
(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({
      serviceWorkers: "block",
      timezoneId: "Asia/Bangkok",
    });
    await context.route("**/assets/js/auth.js*", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "" }),
    );
    let fixture = [
      {
        title: "<b>รายการทดสอบ</b>",
        status: "pending",
        course_name: "วิชาทดสอบ",
      },
      { title: "ส่งแล้ว", status: "submitted" },
      { title: "แบบทดสอบ", status: "quiz" },
    ];
    await context.route("**/data/tasks_live.json", (r) =>
      r.fulfill({ json: fixture }),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const width of [360, 390, 412, 480, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.goto(base + "/index.html");
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        await page.locator("#home-snapshot-list li").first().waitFor();
        assert.equal(await page.locator("#home-snapshot-list li").count(), 2);
        assert.equal(await page.locator("#home-snapshot-list b").count(), 0);
        assert.equal(
          await page
            .locator("#home-month [aria-current=date]")
            .getAttribute("datetime"),
          await page.evaluate(() => {
            const n = new Date();
            return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
          }),
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${width}/${theme} overflow`,
        );
        await page.locator(".portal-menu-button").click();
        await page.waitForFunction(() =>
          document.querySelector(".sidebar").contains(document.activeElement),
        );
        assert(await page.locator(".sidebar").isVisible());
        assert(
          await page.locator(".sidebar").evaluate((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.x >= 0 &&
              r.right <= innerWidth &&
              el.contains(document.activeElement)
            );
          }),
        );
        await page.keyboard.press("Escape");
        assert.equal(
          await page
            .locator(".portal-menu-button")
            .getAttribute("aria-expanded"),
          "false",
        );
        await page.locator(".shell-search").click();
        assert(await page.locator(".shell-search-dialog").isVisible());
        await page.locator("#shell-query").fill("ปฏิทิน");
        assert((await page.locator(".shell-results a").count()) > 0);
        await page.keyboard.press("Escape");
        // Native search fields may consume Escape to clear their text first.
        if (
          await page.locator(".shell-search-dialog").evaluate((el) => el.open)
        )
          await page.keyboard.press("Escape");
        await page.locator(".shell-search-dialog").waitFor({ state: "hidden" });
        for (const el of await page
          .locator(
            ".main-top-bar button:visible,.main-top-bar summary:visible,.home-actions a:visible",
          )
          .all()) {
          const r = await el.boundingBox();
          if (r)
            assert(
              r.height >= 44 && r.width >= 44,
              `touch target ${await el.getAttribute("class")}: ${JSON.stringify(r)}`,
            );
        }
        assert(
          (await page.locator(".main-top-bar").boundingBox()).height < 100,
          "compact toolbar",
        );
        await page.locator("h1").click();
        if (width === 390 || width === 1440)
          await page.screenshot({
            path: `/tmp/psu-home-${width}-${theme}.png`,
            animations: "disabled",
          });
        console.log(
          `PASS Home ${width}/${theme}: overflow, menu, search, date, snapshot, targets`,
        );
      }
    }
    await page.clock.install({ time: new Date("2026-09-30T16:59:59Z") });
    await page.reload();
    assert.equal(
      await page
        .locator("#home-month [aria-current=date]")
        .getAttribute("datetime"),
      "2026-09-30",
    );
    await page.clock.runFor(2000);
    assert.equal(
      await page
        .locator("#home-month [aria-current=date]")
        .getAttribute("datetime"),
      "2026-10-01",
    );
    console.log("PASS local midnight and month rollover");
    fixture = { invalid: true };
    await page.reload();
    await page.waitForFunction(() =>
      document
        .querySelector("#home-snapshot-status")
        .textContent.includes("ยังอ่าน"),
    );
    fixture = [];
    await page.reload();
    await page.waitForFunction(() =>
      document
        .querySelector("#home-snapshot-status")
        .textContent.includes("ไม่มีงาน"),
    );
    await context.route("**/mascot-welcome.webp", (r) => r.abort());
    await page.reload();
    await page.locator(".home-companion[data-missing]").waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator(".home-lobby").scrollIntoViewIfNeeded();
    assert.equal(await page.locator("#lobby-canvas canvas").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS invalid/empty snapshot, mascot fallback, reduced motion, no JS exceptions",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
