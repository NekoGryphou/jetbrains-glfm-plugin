// The ordered list of transformations, and the guarded pass over the document.
(function (namespace) {
  "use strict";

  const features = namespace.config.features;

  // Block structure first, so the inline passes see the final tree. Steps name
  // their transform rather than holding a reference, so a module that failed to
  // load costs only its own feature instead of breaking the list.
  const STEPS = [
    { feature: "details", transform: "transformDetails" },
    { feature: "multilineBlockquote", transform: "transformMultilineBlockquotes" },
    { feature: "inapplicableTasks", transform: "transformInapplicableTasks" },
    { feature: "media", transform: "transformMedia" },
    { feature: "headingIds", transform: "assignHeadingIds" },
    { feature: "footnotes", transform: "transformFootnotes" },
    { feature: "inlineDiff", transform: "transformInlineDiff" },
    { feature: "colorChips", transform: "transformColorChips" },
    { feature: "emoji", transform: "transformEmoji" },
    { feature: "references", transform: "transformReferences" },
    // After the inline passes, so an entry shows the heading as rendered: a
    // heading's `:warning:` reaches the contents as the glyph. An entry is a
    // generated link, and the text passes skip both links and their own output,
    // so anything copied in before them would stay raw for good.
    { feature: "tableOfContents", transform: "transformTableOfContents" },
    // Last: the anchor is appended inside the heading, and everything that
    // reads a heading's text - the table of contents, the slugs - must see the
    // author's title rather than the permalink glyph.
    { feature: "headingAnchors", transform: "transformHeadingAnchors" }
  ];

  const missing = [];

  function resolve(step) {
    const run = namespace[step.transform];
    if (!run) missing.push(step.transform);
    return { name: step.transform, run: run };
  }

  let resolved = null;

  function steps() {
    resolved = resolved || STEPS.filter(function (step) { return features[step.feature]; })
      .map(resolve)
      .filter(function (step) { return Boolean(step.run); });
    return resolved;
  }

  /** What actually ran, for the startup report. */
  namespace.pipelineReport = function () {
    return { active: steps().map(function (step) { return step.name; }), missing: missing };
  };

  /** One step's failure must never cost the steps that follow it. */
  function runStep(step, root) {
    try {
      step.run(root);
    } catch (error) {
      console.error("[glfm] " + step.name + " failed:", error);
    }
  }

  let running = false;

  /** Re-entrancy guard: our own writes must not trigger another pass. */
  namespace.runPipeline = function () {
    if (running || !document.body) return;
    running = true;
    try {
      steps().forEach(function (step) { runStep(step, document.body); });
    } finally {
      running = false;
    }
  };
})(window.GLFM);
