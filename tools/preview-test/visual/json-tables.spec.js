const { test, expect } = require("@playwright/test");
const { preparePage } = require("./page");

const markdown = (data) => "```json:table\n" + JSON.stringify(data) + "\n```\n";
const data = {
  fields: [{ key: "name", label: "Name" }, { key: "count", label: "Count" }],
  items: [{ name: "Beta", count: 10 }, { name: "Alpha", count: 2 }, { name: "Gamma", count: 30 }],
  sortable: true, filter: true
};

test("JSON tables filter and sort with keyboard controls after repeated patches", async ({ page }) => {
  await preparePage(page, { markdown: markdown(data) });
  const rows = page.locator(".glfm-json-table tbody tr");
  await expect(rows).toHaveCount(3);
  const sort = page.getByRole("button", { name: "Count" });
  await sort.focus();
  await page.keyboard.press("Enter");
  await expect(rows.first()).toHaveText("Alpha2");
  await expect(page.getByRole("columnheader", { name: "Count" })).toHaveAttribute("aria-sort", "ascending");
  await sort.click();
  await expect(rows.first()).toHaveText("Gamma30");
  await sort.click();
  await expect(rows.first()).toHaveText("Beta10");
  const filter = page.getByRole("searchbox", { name: "Filter table" });
  await filter.fill("ALPHA");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveText("Alpha2");
  await filter.fill("no match");
  await expect(rows).toHaveCount(0);
  await filter.fill("");
  await expect(rows).toHaveCount(3);
  await expect(page.locator(".glfm-json-table")).toHaveCount(1);
});

test("per-column sorting works while unsortable columns remain plain headers", async ({ page }) => {
  await preparePage(page, { markdown: markdown({ ...data, sortable: false,
    fields: [{ key: "name", label: "Name" }, { key: "count", label: "Count", sortable: true }] }) });
  await expect(page.getByRole("button", { name: "Name", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Count", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toHaveText("Alpha2");
});

test("JSON table feature can be disabled", async ({ page }) => {
  await preparePage(page, { markdown: markdown(data), config: { features: { jsonTables: false } } });
  await expect(page.locator(".glfm-json-table")).toHaveCount(0);
  await expect(page.locator("pre")).toContainText('"items"');
});

test("JSON table rerender replaces old data and binds new controls", async ({ page }) => {
  await preparePage(page, { markdown: markdown(data) });
  await page.evaluate(() => {
    const code = document.createElement("code");
    code.className = "language-json:table";
    code.textContent = JSON.stringify({ items: [{ name: "Edited" }], filter: true });
    const pre = document.createElement("pre");
    pre.appendChild(code);
    document.body.replaceChildren(pre);
    window.IncrementalDOM.notifications.afterPatchListeners.forEach(fn => fn());
  });
  await expect(page.locator("tbody tr")).toHaveText(["Edited"]);
  await page.getByRole("searchbox", { name: "Filter table" }).fill("old");
  await expect(page.locator("tbody tr")).toHaveCount(0);
});
