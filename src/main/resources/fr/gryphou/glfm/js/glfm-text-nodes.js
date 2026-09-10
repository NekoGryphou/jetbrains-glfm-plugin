// Finding the text a transformation may rewrite, grouped into blocks.
//
// The preview wraps words in `<span md-src-pos=...>` for scroll sync, so a
// construct like `:tada:` is split across several text nodes. Everything here
// therefore works on a whole block's worth of text rather than one node.
(function (namespace) {
  "use strict";

  // Text inside these is source-ish or already a link: never rewritten. Note
  // `.glfm-generated` and not `.glfm-container`: a fold wrapper is ours, but
  // the blocks it holds are the document's and still need every pass.
  const SKIP_SELECTOR = "code, pre, kbd, samp, var, script, style, textarea, a, summary, .glfm-generated";

  // A match may never span two of these, or it would join separate paragraphs.
  const BLOCK_SELECTOR = "p, li, td, th, dt, dd, h1, h2, h3, h4, h5, h6," +
    " figcaption, caption, blockquote, div, section, article, body";

  function isRewritable(node) {
    const parent = node.parentElement;
    return Boolean(node.nodeValue) && parent !== null && parent.closest(SKIP_SELECTOR) === null;
  }

  function collectTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
    return nodes.filter(isRewritable);
  }

  function blockOf(node) {
    return node.parentElement.closest(BLOCK_SELECTOR) || document.body;
  }

  /** The rewritable text of `root`, as one array of nodes per block. */
  namespace.textBlocks = function (root) {
    const order = [];
    const groups = new Map();

    collectTextNodes(root).forEach(function (node) {
      const block = blockOf(node);
      if (!groups.has(block)) {
        groups.set(block, []);
        order.push(block);
      }
      groups.get(block).push(node);
    });

    return order.map(function (block) { return groups.get(block); });
  };
})(window.GLFM);
