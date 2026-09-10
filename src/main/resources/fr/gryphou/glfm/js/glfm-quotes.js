// Multiline blockquotes delimited by `>>>`.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;

  /** A bare `>>>` line parses as three nested, empty blockquotes. */
  function isEmptyNestedQuote(node) {
    return dom.textOf(node).trim() === "" && node.querySelector("blockquote blockquote") !== null;
  }

  function isQuoteMarker(node) {
    const isPlainBlockquote = node.tagName === "BLOCKQUOTE" && !node.classList.contains(dom.CONTAINER);
    return isPlainBlockquote && isEmptyNestedQuote(node);
  }

  function foldQuote(opening) {
    const range = namespace.collectUntil(opening, isQuoteMarker);
    if (!range) return;

    const quote = dom.createContainer("blockquote", "glfm-multiline-quote");
    namespace.foldInto(quote, quote, opening, range);
  }

  namespace.transformMultilineBlockquotes = function (root) {
    dom.queryAll(root, "blockquote")
      .filter(function (node) { return dom.isAttached(node) && isQuoteMarker(node); })
      .forEach(foldQuote);
  };
})(window.GLFM);
