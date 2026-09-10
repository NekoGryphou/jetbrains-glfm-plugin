// Collapsible sections: `::: details Title` ... `:::`
(function (namespace) {
  "use strict";

  const dom = namespace.dom;
  const CLOSING_MARKER = ":::";
  const OPENING = /^\s*:::\s*details\s*(.*)$/;

  function detailsTitle(paragraph) {
    const match = OPENING.exec(dom.firstLine(paragraph));
    return match ? (match[1].trim() || "Details") : null;
  }

  function createDetails(title) {
    const details = dom.createContainer("details", "glfm-details");
    details.appendChild(dom.createElement("summary", null, title));
    return details;
  }

  function isClosingMarker(element) {
    return dom.textOf(element).trim() === CLOSING_MARKER;
  }

  /**
   * A paragraph that opens a block the enclosing fold has to step over.
   *
   * One that carries its own closing marker is self-contained and does not
   * deepen anything, so it must not count.
   */
  function isOpeningMarker(element) {
    return detailsTitle(element) !== null && closingLineIndex(dom.lines(element)) === -1;
  }

  function closingLineIndex(lines) {
    return lines.findIndex(function (line, index) {
      return index > 0 && line.trim() === CLOSING_MARKER;
    });
  }

  /**
   * Without blank lines around the body, CommonMark folds the whole construct
   * into a single paragraph and only the raw text survives - the same reason
   * GitLab's own documentation asks for the blank lines.
   *
   * Whatever follows the closing marker in that paragraph is ordinary content
   * that merely shares it, so it is put back as a paragraph of its own and
   * offered to the fold again: two adjacent blocks arrive this way.
   */
  function foldRawDetails(paragraph, title, lines, closingLine) {
    const details = createDetails(title);
    const body = lines.slice(1, closingLine).join("\n").trim();
    details.appendChild(dom.createElement("div", "glfm-details-body glfm-details-raw", body));

    const rest = lines.slice(closingLine + 1).join("\n").trim();
    dom.replace(paragraph, details);
    if (!rest) return;

    const trailing = dom.createElement("p", null, rest);
    details.parentNode.insertBefore(trailing, details.nextSibling);
    foldDetails(trailing);
  }

  /** The body is made of real sibling blocks, so all inline rendering survives. */
  function foldBlockDetails(paragraph, title, range) {
    const details = createDetails(title);
    const body = dom.createElement("div", "glfm-details-body");
    details.appendChild(body);
    namespace.foldInto(details, body, paragraph, range);
  }

  function foldDetails(paragraph) {
    const title = detailsTitle(paragraph);
    if (!title) return;

    const lines = dom.lines(paragraph);
    const closingLine = closingLineIndex(lines);
    if (closingLine !== -1) {
      foldRawDetails(paragraph, title, lines, closingLine);
      return;
    }

    const range = namespace.collectUntil(paragraph, isClosingMarker, isOpeningMarker);
    if (range) foldBlockDetails(paragraph, title, range);
  }

  namespace.transformDetails = function (root) {
    // Document order, so an outer block is folded before the ones nested in it
    // and their paragraphs are still reachable as siblings when their turn
    // comes. Paragraphs an earlier fold consumed are detached, not gone.
    dom.queryAll(root, "p").filter(dom.isAttached).forEach(foldDetails);
  };
})(window.GLFM);
