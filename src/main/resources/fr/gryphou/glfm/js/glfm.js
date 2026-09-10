// Entry point: wires the transformation pipeline into the preview's render loop.
//
// The IDE parses Markdown with a hardcoded CommonMark/GFM flavour, so
// GitLab-only constructs reach the preview as literal text. Rewriting the
// rendered DOM after every incremental-dom patch - the hook the bundled math
// extension also uses - keeps `.md` files plain `.md` files.
(function (namespace) {
  "use strict";

  const config = namespace.config;
  const OBSERVED = { childList: true, subtree: true };

  function listenToPatches() {
    const incrementalDom = window.IncrementalDOM;
    if (!incrementalDom || !incrementalDom.notifications) return false;

    const notifications = incrementalDom.notifications;
    notifications.afterPatchListeners = notifications.afterPatchListeners || [];
    notifications.afterPatchListeners.push(namespace.runPipeline);
    return true;
  }

  /**
   * Defensive fallback: the preview should always ship incremental-dom.
   *
   * The observer is suspended for the duration of the pass. Its callback is
   * delivered as a microtask, long after the pipeline's synchronous guard has
   * been cleared, so a pass's own writes would otherwise schedule the next one
   * and the document would be rewritten on a loop with no input at all.
   */
  function observeMutations() {
    if (!window.MutationObserver || !document.body) return;

    const observer = new MutationObserver(function () {
      observer.disconnect();
      try {
        namespace.runPipeline();
      } finally {
        observer.observe(document.body, OBSERVED);
      }
    });
    observer.observe(document.body, OBSERVED);
  }

  function install() {
    namespace.referenceUrls.configure(config.projectUrl, config.instanceUrl);

    // The palette lives in a stylesheet; the IDE only tells us which one to use.
    document.documentElement.classList.toggle("glfm-dark", config.dark);

    const patched = listenToPatches();
    namespace.installAnchorHandling();
    namespace.runPipeline();

    // Started after the first pass, so that pass's own writes are not the
    // observer's opening delivery.
    if (!patched) observeMutations();
    namespace.report();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})(window.GLFM);
