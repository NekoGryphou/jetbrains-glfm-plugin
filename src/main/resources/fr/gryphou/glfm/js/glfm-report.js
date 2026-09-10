// A one-line startup summary in the preview console.
//
// The preview fails quietly by nature: an unrendered construct looks the same
// whether its module never loaded, its feature is switched off, or the syntax
// simply did not match. This states which of those it was.
(function (namespace) {
  "use strict";

  function emojiCount() {
    return Object.keys(window.__GLFM_EMOJI__ || {}).length;
  }

  function orElse(value, fallback) {
    return value || fallback;
  }

  namespace.report = function () {
    const pipeline = namespace.pipelineReport();
    console.info(
      "[glfm]"
      + " active: " + orElse(pipeline.active.join(", "), "(none)")
      + " | missing modules: " + orElse(pipeline.missing.join(", "), "none")
      + " | emoji entries: " + emojiCount()
      + " | project URL: " + orElse(namespace.config.projectUrl, "(not set)")
    );
  };
})(window.GLFM);
