// Folding of marker-delimited blocks, shared by `::: details` and `>>>`.
//
// Both constructs have the same shape: an opening marker, an arbitrary run of
// sibling blocks, and a closing marker that CommonMark left as a separate node.
(function (namespace) {
  "use strict";

  /**
   * The siblings between `opening` and its matching closing marker.
   *
   * A construct of the same kind may be nested inside, so an `isOpening` the
   * caller supplies raises the depth that the closing markers then unwind -
   * without it the fold would stop at the first closing marker it met, which
   * for a nested block is the inner one's.
   */
  namespace.collectUntil = function (opening, isClosing, isOpening) {
    const body = [];
    let depth = 0;

    for (let sibling = opening.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
      if (isClosing(sibling)) {
        if (depth === 0) return { body: body, closing: sibling };
        depth--;
      } else if (isOpening && isOpening(sibling)) {
        depth++;
      }
      body.push(sibling);
    }
    return null;
  };

  /**
   * Puts `wrapper` where the opening marker was, moves the collected blocks
   * into `receiver`, and drops both markers.
   */
  namespace.foldInto = function (wrapper, receiver, opening, range) {
    opening.parentNode.insertBefore(wrapper, opening);
    range.body.forEach(function (node) { receiver.appendChild(node); });
    opening.remove();
    range.closing.remove();
  };
})(window.GLFM);
