// Inline GitLab constructs: diff markers and colour chips.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;

  const ADDITION = /\{\+([\s\S]+?)\+}|\[\+([\s\S]+?)\+]/g;
  const DELETION = /\{-([\s\S]+?)-}|\[-([\s\S]+?)-]/g;
  const COLOR = /^(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?)\([^)]*\))$/;

  function diffSpan(className) {
    return function () {
      // A container, not generated output: the content is the author's, so the
      // passes that follow still see the references and emoji inside it.
      return dom.createContainer("span", className);
    };
  }

  /**
   * The pattern accepts any `rgb()`/`hsl()` body, and an unparseable one leaves
   * the assignment a no-op - which would put a blank, backgroundless chip in
   * front of the code. The browser's own verdict is the one that counts.
   */
  function colorChip(value) {
    const chip = dom.createGenerated("span", "glfm-color-chip");
    chip.style.backgroundColor = value;
    return chip.style.backgroundColor ? chip : null;
  }

  /**
   * Inline code only: GitLab shows no chip inside a fenced block, and every
   * other transformation treats `pre` as source text that is never rewritten.
   */
  function needsChip(code) {
    return code.closest("pre") === null
      && code.querySelector(".glfm-color-chip") === null
      && COLOR.test(dom.textOf(code).trim());
  }

  namespace.transformInlineDiff = function (root) {
    namespace.text.wrapInText(root, ADDITION, diffSpan("glfm-addition"));
    namespace.text.wrapInText(root, DELETION, diffSpan("glfm-deletion"));
  };

  namespace.transformColorChips = function (root) {
    dom.queryAll(root, "code").filter(needsChip).forEach(function (code) {
      const chip = colorChip(dom.textOf(code).trim());
      if (chip) code.insertBefore(chip, code.firstChild);
    });
  };
})(window.GLFM);
