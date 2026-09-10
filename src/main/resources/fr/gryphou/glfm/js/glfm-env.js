// The runtime configuration, normalised once.
//
// Every module downstream reads it from here rather than reaching for
// `window.__GLFM_CONFIG__` with its own fallback, so there is a single answer
// to what an absent or half-built config means.
window.GLFM = window.GLFM || {};

(function (namespace) {
  "use strict";

  const raw = window.__GLFM_CONFIG__ || {};

  namespace.config = {
    projectUrl: raw.projectUrl || "",
    instanceUrl: raw.instanceUrl || "",
    dark: Boolean(raw.dark),
    features: raw.features || {}
  };
})(window.GLFM);
