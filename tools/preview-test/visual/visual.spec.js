// Pixel baselines for every construct the plugin renders, in both themes.
//
// Screenshotted per construct rather than only as one page: a diff then names
// the thing that moved instead of reporting that the document is different
// somewhere. The whole sample is still captured as a catch-all, for the
// regressions no single construct owns - spacing between blocks, a rule that
// leaks into content it should not touch.

const { test, expect } = require("@playwright/test");
const { preparePage, SAMPLE } = require("./page");

/** One construct each, kept small so a baseline stays readable as an image. */
const CONSTRUCTS = [
  { name: "details", md: "::: details A collapsible section\n\nBody with **bold** and `code`.\n\n:::\n" },
  { name: "details-raw", md: "::: details No blank lines\nline one\nline two\n:::\n" },
  { name: "toc", md: "# Title\n\n[[_TOC_]]\n\n## First section\n\n### Nested\n\n## Second section\n" },
  { name: "multiline-quote", md: ">>>\nOne quote.\n\nAcross two paragraphs.\n>>>\n" },
  { name: "inline-diff", md: "The flag was {-disabled-} and is now {+enabled+}.\n" },
  { name: "color-chips", md: "`#f4511e`, `#fa0`, `rgb(31, 30, 36)` and `hsl(210, 90%, 55%)`.\n" },
  { name: "emoji", md: "Shipped :tada: - tests green :white_check_mark:, one :bug: left.\n" },
  { name: "task-list", md: "- [x] done\n- [ ] outstanding\n- [~] inapplicable\n" },
  { name: "footnotes", md: "Text[^1] and more[^why].\n\n[^1]: The first note.\n[^why]: The second one.\n" },
  { name: "media", md: "![a video](https://gitlab.com/demo.mp4)\n\n![a sound](https://gitlab.com/note.mp3)\n" },
  { name: "references", md: "Issue #123, MR !45, milestone %7, epic &8, label ~backend, user @someone.\n" },
];

for (const theme of ["light", "dark"]) {
  const dark = theme === "dark";

  test.describe(`${theme} theme`, () => {
    for (const construct of CONSTRUCTS) {
      test(construct.name, async ({ page }) => {
        await preparePage(page, { markdown: construct.md, dark });
        await expect(page.locator("body")).toHaveScreenshot(`${construct.name}-${theme}.png`);
      });
    }

    // The permalink is invisible until its heading is hovered, so it is the one
    // construct a resting screenshot cannot show.
    test("heading anchor on hover", async ({ page }) => {
      await preparePage(page, { markdown: "## A section title\n", dark });
      await page.locator("h2").hover();
      await expect(page.locator("body")).toHaveScreenshot(`heading-anchor-${theme}.png`);
    });

    test("the whole sample document", async ({ page }) => {
      await preparePage(page, { markdown: SAMPLE, dark });
      await expect(page).toHaveScreenshot(`sample-${theme}.png`, { fullPage: true });
    });
  });
}
