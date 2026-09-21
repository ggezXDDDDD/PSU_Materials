// Static preview regression. Auth is isolated here; use test_auth_security.py for real auth.
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const assert = require("node:assert/strict");
const base = process.env.PSU_TEST_URL || "http://127.0.0.1:8765";
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.route("**/assets/js/auth.js*", (r) =>
      r.fulfill({ contentType: "application/javascript", body: "" }),
    );
    const original = execFileSync("git", ["show", "HEAD:tasks.html"], {
      encoding: "utf8",
    });
    const old = await context.newPage();
    await old.route("**/tasks.html", (r) =>
      r.fulfill({ contentType: "text/html", body: original }),
    );
    await old.goto(base + "/tasks.html");
    const records = (page) =>
      page
        .locator(".assignment-card")
        .evaluateAll((cards) =>
          cards.map((c) => [
            c.textContent.replace(/\s+/g, " ").trim(),
            c.dataset.course,
            c.dataset.status,
            [...c.querySelectorAll("a")].map((a) => a.getAttribute("href")),
          ]),
        );
    const before = digest(await records(old));
    await old.close();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const width of [360, 390, 412, 480, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/tasks.html");
      assert.equal(
        digest(await records(page)),
        before,
        "Task text, status and links must be unchanged",
      );
      assert(
        await page.locator(".assignment-card").evaluateAll((cards) =>
          cards.every((c) => {
            const section = c.closest(".course-task-section");
            return (
              section &&
              section.dataset.course === c.dataset.course &&
              !!c.closest(".course-task-body-wrapper")
            );
          }),
        ),
        "All cards must belong to their course filter and accordion",
      );
      const total = await page.locator(".assignment-card").count();
      await page.locator("#task-search-input").fill("__no_matching_task__");
      assert.equal(await page.locator(".assignment-card:visible").count(), 0);
      assert.equal(
        await page.locator(".course-task-section:visible").count(),
        0,
      );
      await page.locator('[onclick="resetFilters()"]').click();
      assert.equal(
        await page.locator(".assignment-card:visible").count(),
        total,
      );
      for (const filter of await page
        .locator("#course-filter-bar .filter-pill")
        .all()) {
        const tag = await filter.getAttribute("data-filter");
        if (tag === "all") continue;
        await filter.click();
        assert(
          await page
            .locator(".assignment-card:visible")
            .evaluateAll(
              (cards, tag) =>
                cards.length > 0 &&
                cards.every((c) => c.dataset.course === tag),
              tag,
            ),
        );
        const count = await page.locator(".assignment-card:visible").count();
        assert.match(
          await page.locator("#results-count").textContent(),
          new RegExp(`แสดง ${count} งาน`),
        );
      }
      await page.locator('[onclick="resetFilters()"]').click();
      await page.locator('[onclick="collapseAllSections()"]').click();
      assert.equal(
        await page.locator(".course-task-body-wrapper:not(.collapsed)").count(),
        0,
      );
      await page.locator('[onclick="expandAllSections()"]').click();
      assert.equal(
        await page.locator(".assignment-card:visible").count(),
        total,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow at ${width}`,
      );
      console.log(
        `PASS Tasks ${width}px: all filters, empty search, reset, counts, accordion, preserved records`,
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
