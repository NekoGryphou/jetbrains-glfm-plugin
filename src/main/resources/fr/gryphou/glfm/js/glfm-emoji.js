// Emoji shortcodes, `:tada:`, resolved against the bundled table.
(function (namespace) {
  "use strict";

  const SHORTCODE = /:([a-z0-9_+\-]+):/g;

  namespace.transformEmoji = function (root) {
    const table = window.__GLFM_EMOJI__ || {};

    namespace.text.replaceInText(root, SHORTCODE, function (match) {
      const glyph = table[match[1]];
      if (!glyph) return null;

      const span = namespace.dom.createGenerated("span", "glfm-emoji", glyph);
      span.setAttribute("title", ":" + match[1] + ":");
      return span;
    });
  };
})(window.GLFM);
