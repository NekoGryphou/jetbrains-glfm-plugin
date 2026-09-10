const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { JSDOM, VirtualConsole } = require("jsdom");

const JS_DIR = path.join(__dirname, "..", "..", "src", "main", "resources", "fr", "gryphou", "glfm", "js");
const API_DIR = __dirname;

// The IDE supplies both the parser and the JVM. `GLFM_IDE_HOME` points the
// harness at an installation elsewhere; see README.
const IDE_HOME = process.env.GLFM_IDE_HOME || "/opt/webstorm";

// Where the build compiled `Render.class`. Defaults to this directory, so the
// suite still runs from a checkout where it was compiled by hand.
const RENDER_CLASSES = process.env.GLFM_RENDER_CLASSES || ".";

// Resolved on first use rather than at import: a machine without the IDE should
// fail the one task that needs it, not every `require` of this module.
let classpath = null;

function ideClasspath() {
  if (classpath === null) {
    classpath = RENDER_CLASSES + ":" + execFileSync("bash", ["-c",
      `ls ${IDE_HOME}/lib/*.jar ${IDE_HOME}/plugins/markdown/lib/*.jar ` +
      `${IDE_HOME}/plugins/markdown/lib/modules/*.jar | tr '\\n' ':'`]).toString();
  }
  return classpath;
}

// Same order the plugin declares, minus the runtime-generated config script.
const SCRIPTS = [
  "glfm-env.js", "glfm-emoji-data.js", "glfm-dom.js", "glfm-text-nodes.js", "glfm-text.js",
  "glfm-fold.js", "glfm-details.js", "glfm-quotes.js", "glfm-headings.js",
  "glfm-toc.js", "glfm-tasks.js", "glfm-media.js", "glfm-footnote-definitions.js",
  "glfm-footnotes.js", "glfm-inline.js", "glfm-emoji.js", "glfm-reference-urls.js",
  "glfm-references.js", "glfm-anchors.js", "glfm-pipeline.js", "glfm-report.js",
  "glfm.js"
];

// Same list, and the same order, `GlfmPreviewExtension` declares. Order decides
// which rules win on equal specificity, so the visual suite has to load them
// exactly as the preview does.
const STYLES = ["glfm-theme.css", "glfm.css"];

const FEATURES = {
  references: true, details: true, tableOfContents: true, footnotes: true,
  multilineBlockquote: true, inlineDiff: true, colorChips: true, emoji: true,
  inapplicableTasks: true, media: true, headingAnchors: true,
  // Derived by GlfmPreviewExtension.kt; mirrored here so the harness matches
  // the config the plugin actually emits.
  headingIds: true
};

// Every case is rendered once per markup mode, and rendering costs a JVM
// launch, so the parser's answer for a given source is kept.
const rendered = new Map();

function renderMarkdown(markdown) {
  if (!rendered.has(markdown)) rendered.set(markdown, render(markdown));
  return rendered.get(markdown);
}

// Per-process, so two harness runs never write each other's case file.
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), "glfm-preview-test-"));

function render(markdown) {
  const file = path.join(SCRATCH, "case.md");
  fs.writeFileSync(file, markdown);
  const html = execFileSync(path.join(IDE_HOME, "jbr", "bin", "java"),
    ["-cp", ideClasspath(), "Render", file],
    { cwd: API_DIR, env: { ...process.env, USE_GFM: "1" } }).toString();
  return html.replace(/^\s*<body>/, "").replace(/<\/body>\s*$/, "").trim();
}

/** Lets jsdom deliver the MutationObserver callbacks the fallback path relies on. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

async function transform(bodyHtml, options) {
  const settings = options || {};
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("error", (...args) => errors.push(args.map(String).join(" ")));
  virtualConsole.on("jsdomError", (e) => errors.push(String(e)));
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${bodyHtml}</body></html>`,
    { runScripts: "outside-only", virtualConsole });
  const w = dom.window;
  w.__GLFM_CONFIG__ = {
    projectUrl: "https://gitlab.com/acme/widgets",
    instanceUrl: "https://gitlab.com",
    dark: false,
    features: { ...FEATURES },
    // A case may need a different project - a subgroup one, say - to say
    // anything about the URLs the plugin builds.
    ...(settings.config || {})
  };
  // The real preview always ships incremental-dom and notifies after each
  // patch; only its absence falls back to the MutationObserver.
  if (settings.incrementalDom) w.IncrementalDOM = { notifications: {} };

  if (settings.split) splitWords(w.document);

  // jsdom still reports readyState "loading" in the construction tick, so let
  // it settle before the entry script decides whether to wait for DOMContentLoaded.
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (const name of SCRIPTS) {
    w.eval(fs.readFileSync(path.join(JS_DIR, name), "utf8"));
  }
  const notifications = w.IncrementalDOM ? w.IncrementalDOM.notifications : {};
  const patchListeners = notifications.afterPatchListeners || [];
  const notifyPatch = function () { patchListeners.forEach(function (listener) { listener(); }); };

  // An edit re-renders the document into the same DOM: everything the plugin
  // wrote is wiped, and the next notification has to rebuild all of it.
  if (settings.rerender) {
    w.document.body.innerHTML = bodyHtml;
    if (settings.split) splitWords(w.document);
    notifyPatch();
  }

  // The preview re-runs the pipeline after every patch, over the DOM its own
  // previous pass wrote. A transformation that is not idempotent shows up here.
  for (let patch = 1; patch < (settings.patches || 1); patch++) notifyPatch();
  for (let pass = 1; pass < (settings.passes || 1); pass++) w.GLFM.runPipeline();

  // The fallback MutationObserver delivers asynchronously, so the result is
  // only final once it has had its chance to react to the pass's own writes.
  await settle();

  return {
    html: w.document.body.innerHTML,
    text: w.document.body.textContent,
    errors: errors,
    patchListeners: patchListeners.length
  };
}

/**
 * Mimics the preview's scroll-sync markup, which wraps each word in
 * `<span md-src-pos=...>` and so splits a construct across several text nodes.
 * This is the shape the plugin actually has to cope with.
 *
 * Done on the DOM rather than the HTML string, so entities stay intact.
 */
function splitWords(document) {
  const walker = document.createTreeWalker(document.body, 4 /* SHOW_TEXT */, null);
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);

  for (const node of nodes) {
    const parts = node.nodeValue.split(/([A-Za-z0-9_]+)/);
    if (parts.length < 2) continue;

    const fragment = document.createDocumentFragment();
    parts.forEach((part, index) => {
      if (!part) return;
      if (index % 2 === 1) {
        const span = document.createElement("span");
        span.setAttribute("md-src-pos", "0..0");
        span.textContent = part;
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    });
    node.parentNode.replaceChild(fragment, node);
  }
}

module.exports = { renderMarkdown, transform, SCRIPTS, STYLES, FEATURES };
