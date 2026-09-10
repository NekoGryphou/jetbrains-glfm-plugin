// Assembles, in a real browser, the page the preview shows.
//
// `check.js` verifies what each construct *becomes*; it runs in jsdom, which has
// no cascade and no layout, so the 358 lines of stylesheet this plugin ships are
// invisible to it. A rule that stops applying - a renamed class, a dropped
// custom property, a fold that no longer folds - is a change jsdom cannot see.
// Here the same output is loaded into Chromium, which is what JCEF runs, with
// the real stylesheets attached.
//
// The parser HTML, the script list and the feature flags all come from the
// existing harness, so the two suites can never disagree about what the preview
// loads or in which order.

const fs = require("fs");
const path = require("path");
const { renderMarkdown, SCRIPTS, STYLES, FEATURES } = require("../harness");

const ROOT = path.join(__dirname, "..", "..", "..");
const JS_DIR = path.join(ROOT, "src", "main", "resources", "fr", "gryphou", "glfm", "js");
const CSS_DIR = path.join(ROOT, "src", "main", "resources", "fr", "gryphou", "glfm", "css");

const SAMPLE = fs.readFileSync(path.join(ROOT, "docs", "glfm-sample.md"), "utf8");

/**
 * Stands in for the IDE's own preview stylesheet.
 *
 * The real one lives inside the Markdown plugin's jar and changes with the IDE,
 * which would make every baseline expire on the next platform bump. A fixed
 * neutral base instead keeps a screenshot diff attributable to this repo: the
 * only thing that can move it is this plugin's own CSS.
 */
const BASE_CSS = fs.readFileSync(path.join(__dirname, "base.css"), "utf8");

const CONFIG = {
  projectUrl: "https://gitlab.com/acme/widgets",
  instanceUrl: "https://gitlab.com",
  features: FEATURES,
};

function readAll(dir, names) {
  return names.map((name) => fs.readFileSync(path.join(dir, name), "utf8"));
}

/**
 * Loads `bodyHtml` the way the preview does: stylesheets first, then the config,
 * then every module in the order the extension declares.
 *
 * Scripts are attached one at a time rather than inlined into the document, so
 * nothing has to be escaped and the execution order is the browser's own.
 */
async function preparePage(page, options) {
  const settings = options || {};
  const bodyHtml = settings.html !== undefined
    ? settings.html
    : renderMarkdown(settings.markdown);

  // Nothing is fetched. The document names remote images - which the plugin
  // rewrites into links, but not before the browser has tried to load them -
  // and a suite that reaches the network is a suite that fails when the network
  // does.
  await page.route("**/*", (route) => route.abort());

  // Surfaced as a test failure: the preview swallows script errors, which is the
  // exact failure mode this suite exists to catch. `glfm-pipeline.js` reports a
  // failed step through `console.error`, so the console is watched too - minus
  // the load failures the blocking above causes by design.
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().startsWith("Failed to load resource")) return;
    errors.push(message.text());
  });

  await page.setContent(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"></head>` +
    `<body>${bodyHtml}</body></html>`,
    { waitUntil: "load" },
  );

  await page.addStyleTag({ content: BASE_CSS });
  for (const css of readAll(CSS_DIR, STYLES)) await page.addStyleTag({ content: css });

  // The real preview always ships incremental-dom and notifies after each patch;
  // only its absence falls back to the MutationObserver. This is the production
  // path, so it is the one screenshotted.
  await page.evaluate((config) => {
    window.__GLFM_CONFIG__ = config;
    window.IncrementalDOM = { notifications: {} };
  }, { ...CONFIG, dark: Boolean(settings.dark), ...(settings.config || {}) });

  for (const js of readAll(JS_DIR, SCRIPTS)) await page.addScriptTag({ content: js });

  // The preview re-runs the pipeline over the DOM its own last pass wrote. A
  // transformation that is not idempotent corrupts the document as it is edited,
  // and that corruption is visible - so the screenshot is taken after several.
  await page.evaluate((patches) => {
    const listeners = window.IncrementalDOM.notifications.afterPatchListeners || [];
    for (let patch = 0; patch < patches; patch++) listeners.forEach((listener) => listener());
  }, settings.patches === undefined ? 2 : settings.patches);

  // Lets the fallback MutationObserver, and any transition, settle before the
  // pixels are read.
  await page.waitForTimeout(50);

  if (errors.length) throw new Error(`the preview scripts reported errors:\n  ${errors.join("\n  ")}`);
}

module.exports = { preparePage, SAMPLE };
