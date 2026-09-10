// What the stylesheet has to actually achieve, asserted against the browser's
// computed values.
//
// These carry the rules whose breakage is silent and consequential - a fold that
// stops folding, a chip with no colour in it, a definition that stops being
// hidden - and they say so in words, so a failure names the rule rather than a
// pixel count. They need no baseline image, so they are the half of this suite
// that works on a fresh checkout.

const { test, expect } = require("@playwright/test");
const { preparePage, SAMPLE } = require("./page");

// glfm-theme.css, resolved. Asserting the colour and not just "some colour"
// is the point: a dropped custom property computes to a valid value, usually
// transparent or inherited black, and only the exact number catches it.
const LIGHT = {
  surface: "rgb(251, 250, 253)",
  border: "rgb(220, 220, 222)",
  addedBg: "rgb(236, 253, 240)",
  addedFg: "rgb(36, 102, 59)",
  removedBg: "rgb(254, 241, 241)",
  labelBg: "rgb(236, 236, 239)",
  link: "rgb(16, 104, 191)",
  muted: "rgb(115, 114, 120)",
};

const DARK = {
  surface: "rgb(40, 39, 45)",
  addedBg: "rgb(10, 64, 32)",
  addedFg: "rgb(145, 212, 168)",
  link: "rgb(99, 166, 233)",
};

test.describe("collapsible sections", () => {
  test("a fold is closed, and hides its body until opened", async ({ page }) => {
    await preparePage(page, { markdown: "::: details Title\n\nThe body text.\n\n:::\n" });

    const body = page.locator(".glfm-details-body");
    await expect(body).toBeHidden();

    await page.locator("details.glfm-details > summary").click();
    await expect(body).toBeVisible();
  });

  test("the summary is styled as something to click", async ({ page }) => {
    await preparePage(page, { markdown: "::: details Title\n\nBody.\n\n:::\n" });

    const summary = page.locator("details.glfm-details > summary");
    await expect(summary).toHaveCSS("cursor", "pointer");
    await expect(summary).toHaveCSS("font-weight", "600");

    // The default disclosure triangle is replaced by one of our own; if the
    // platform marker comes back there are two.
    await expect(summary).toHaveCSS("list-style-type", "none");
  });

  test("the fold is drawn as a panel", async ({ page }) => {
    await preparePage(page, { markdown: "::: details Title\n\nBody.\n\n:::\n" });

    const details = page.locator("details.glfm-details");
    await expect(details).toHaveCSS("background-color", LIGHT.surface);
    await expect(details).toHaveCSS("border-top-color", LIGHT.border);
    await expect(details).toHaveCSS("border-top-width", "1px");
  });

  test("a raw body keeps the author's line breaks", async ({ page }) => {
    await preparePage(page, { markdown: "::: details Title\nline one\nline two\n:::\n" });
    await expect(page.locator(".glfm-details-raw")).toHaveCSS("white-space", "pre-wrap");
  });
});

test.describe("inline diffs", () => {
  test("an addition is green and a deletion is struck through", async ({ page }) => {
    await preparePage(page, { markdown: "was {-old-} now {+new+}\n" });

    const added = page.locator(".glfm-addition");
    await expect(added).toHaveCSS("background-color", LIGHT.addedBg);
    await expect(added).toHaveCSS("color", LIGHT.addedFg);

    const removed = page.locator(".glfm-deletion");
    await expect(removed).toHaveCSS("background-color", LIGHT.removedBg);
    await expect(removed).toHaveCSS("text-decoration-line", "line-through");
  });
});

test.describe("colour chips", () => {
  test("a chip is painted the colour it names", async ({ page }) => {
    await preparePage(page, { markdown: "Colour `#f4511e` here\n" });

    const chip = page.locator(".glfm-color-chip");
    await expect(chip).toHaveCSS("background-color", "rgb(244, 81, 30)");
  });

  test("a chip is a visible square, not a collapsed inline span", async ({ page }) => {
    await preparePage(page, { markdown: "Colour `#f4511e` here\n" });

    // An inline element with width/height set but display left inline computes
    // to a zero-height box: the chip disappears and nothing else changes.
    const box = await page.locator(".glfm-color-chip").boundingBox();
    expect(box.width).toBeGreaterThan(6);
    expect(box.height).toBeGreaterThan(6);
  });
});

test.describe("footnotes", () => {
  test("the source definition is hidden, and the generated list is not", async ({ page }) => {
    await preparePage(page, { markdown: "Text[^1].\n\n[^1]: The note.\n" });

    await expect(page.locator(".glfm-footnote-definition")).toBeHidden();
    await expect(page.locator(".glfm-footnotes")).toBeVisible();
    await expect(page.locator(".glfm-footnotes")).toContainText("The note.");
  });

  test("a reference reads as a link", async ({ page }) => {
    await preparePage(page, { markdown: "Text[^1].\n\n[^1]: The note.\n" });
    await expect(page.locator(".glfm-footnote-ref a")).toHaveCSS("color", LIGHT.link);
  });
});

test.describe("heading anchors", () => {
  test("the permalink is invisible at rest and appears on hover", async ({ page }) => {
    await preparePage(page, { markdown: "## A section\n" });

    const anchor = page.locator(".glfm-heading-anchor");
    await expect(anchor).toHaveCSS("opacity", "0");

    await page.locator("h2").hover();
    await expect(anchor).toHaveCSS("opacity", "1");
  });

  test("it holds its space, so hovering does not shift the heading", async ({ page }) => {
    await preparePage(page, { markdown: "## A section\n" });

    const heading = page.locator("h2");
    const before = await heading.boundingBox();
    await heading.hover();
    expect((await heading.boundingBox()).height).toBe(before.height);
  });
});

test.describe("references", () => {
  test("a label is a rounded pill", async ({ page }) => {
    await preparePage(page, { markdown: "See ~backend today\n" });

    const label = page.locator("a.glfm-label");
    await expect(label).toHaveCSS("background-color", LIGHT.labelBg);
    await expect(label).toHaveCSS("border-radius", "10px");
    await expect(label).toHaveCSS("display", "inline-block");
  });

  test("an issue reference reads as a link", async ({ page }) => {
    await preparePage(page, { markdown: "See #123 today\n" });
    await expect(page.locator("a.glfm-reference")).toHaveCSS("color", LIGHT.link);
  });

  test("a mention is chipped", async ({ page }) => {
    await preparePage(page, { markdown: "See @someone today\n" });
    await expect(page.locator("a.glfm-mention")).toHaveCSS("background-color", LIGHT.labelBg);
  });
});

test.describe("task lists", () => {
  test("an inapplicable item is muted and loses its bullet", async ({ page }) => {
    await preparePage(page, { markdown: "- [x] done\n- [~] n/a\n" });

    const item = page.locator("li.glfm-task-inapplicable");
    await expect(item).toHaveCSS("list-style-type", "none");
    await expect(item).toHaveCSS("color", LIGHT.muted);
  });

  test("its box is drawn by us, not by the platform checkbox", async ({ page }) => {
    await preparePage(page, { markdown: "- [~] n/a\n" });

    const box = page.locator("li.glfm-task-inapplicable .glfm-task-checkbox");
    await expect(box).toHaveCSS("appearance", "none");

    const rect = await box.boundingBox();
    expect(rect.width).toBeGreaterThan(6);
    expect(rect.height).toBeGreaterThan(6);
  });
});

test.describe("media", () => {
  test("a video link is a bordered chip with a play glyph", async ({ page }) => {
    await preparePage(page, { markdown: "![clip](https://gitlab.com/demo.mp4)\n" });

    const link = page.locator("a.glfm-media-video");
    await expect(link).toHaveCSS("display", "inline-block");
    await expect(link).toHaveCSS("background-color", LIGHT.surface);

    // Chromium resolves the stylesheet's `\25B6` escape to the character itself.
    const glyph = await link.evaluate((el) => getComputedStyle(el, "::before").content);
    expect(glyph).toBe('"\u25b6"');
  });

  test("an audio link carries the note glyph instead", async ({ page }) => {
    await preparePage(page, { markdown: "![sound](https://gitlab.com/note.mp3)\n" });

    const glyph = await page.locator("a.glfm-media-audio")
      .evaluate((el) => getComputedStyle(el, "::before").content);
    expect(glyph).toBe('"\u266a"');
  });
});

test.describe("table of contents", () => {
  test("it is drawn as a panel with unbulleted links", async ({ page }) => {
    await preparePage(page, { markdown: "# One\n\n[[_TOC_]]\n\n## Two\n" });

    const toc = page.locator("nav.glfm-toc");
    await expect(toc).toHaveCSS("background-color", LIGHT.surface);
    await expect(toc.locator("ul").first()).toHaveCSS("list-style-type", "none");
    await expect(toc.locator("a").first()).toHaveCSS("color", LIGHT.link);
  });
});

test.describe("dark theme", () => {
  test("the palette switches with the root class", async ({ page }) => {
    await preparePage(page, { markdown: "::: details Title\n\nBody.\n\n:::\n", dark: true });

    await expect(page.locator("html")).toHaveClass(/glfm-dark/);
    await expect(page.locator("details.glfm-details")).toHaveCSS("background-color", DARK.surface);
  });

  test("diffs and links take their dark values", async ({ page }) => {
    await preparePage(page, { markdown: "now {+new+} and #123\n", dark: true });

    const added = page.locator(".glfm-addition");
    await expect(added).toHaveCSS("background-color", DARK.addedBg);
    await expect(added).toHaveCSS("color", DARK.addedFg);
    await expect(page.locator("a.glfm-reference")).toHaveCSS("color", DARK.link);
  });
});

test.describe("the sample document as a whole", () => {
  test("nothing the plugin generated is accidentally invisible", async ({ page }) => {
    await preparePage(page, { markdown: SAMPLE });

    // The two classes that are hidden by design; everything else the plugin
    // produces is there to be seen, and a zero-height box means a rule broke.
    const collapsed = await page.evaluate(() => {
      const hiddenByDesign = (el) =>
        el.closest(".glfm-footnote-definition") !== null || el.closest("details:not([open])") !== null;

      return Array.from(document.querySelectorAll("[class*='glfm-']"))
        .filter((el) => !hiddenByDesign(el))
        .filter((el) => el.getBoundingClientRect().height === 0)
        .map((el) => el.className);
    });

    expect(collapsed).toEqual([]);
  });

  test("no construct overflows the page width", async ({ page }) => {
    await preparePage(page, { markdown: SAMPLE });

    const overflow = await page.evaluate(() => {
      const limit = document.body.getBoundingClientRect().right;
      return Array.from(document.querySelectorAll("[class*='glfm-']"))
        .filter((el) => el.getBoundingClientRect().right > limit + 1)
        .map((el) => el.className);
    });

    expect(overflow).toEqual([]);
  });
});
