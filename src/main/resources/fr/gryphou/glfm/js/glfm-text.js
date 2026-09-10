// Replacing pattern matches that may span several text nodes.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;

  /**
   * The scan below advances through `lastIndex`, which only moves for a global
   * regex - a caller that forgot the flag would otherwise re-match at offset 0
   * forever and hang the preview browser rather than merely render wrongly.
   */
  function globalCopy(pattern) {
    // `d` as well as `g`: a wrapping transformation needs the captured group's
    // own offsets to tell the construct's delimiters from its content.
    let flags = pattern.flags;
    if (flags.indexOf("g") === -1) flags += "g";
    if (flags.indexOf("d") === -1) flags += "d";
    return new RegExp(pattern.source, flags);
  }

  function allMatches(text, pattern) {
    const regex = globalCopy(pattern);
    const found = [];
    for (let match = regex.exec(text); match; match = regex.exec(text)) {
      if (match[0].length === 0) regex.lastIndex++;
      else found.push(match);
    }
    return found;
  }

  /** Maps an offset into the block's joined text back to a node and offset. */
  function locate(nodes, offset) {
    let remaining = offset;
    for (const node of nodes) {
      if (remaining <= node.nodeValue.length) return { node: node, offset: remaining };
      remaining -= node.nodeValue.length;
    }
    const last = nodes[nodes.length - 1];
    return { node: last, offset: last.nodeValue.length };
  }

  function spanRange(nodes, from, to) {
    const start = locate(nodes, from);
    const end = locate(nodes, to);

    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  }

  function rangeOf(nodes, match) {
    return spanRange(nodes, match.index, match.index + match[0].length);
  }

  /** The first group a pattern's alternatives actually captured. */
  function capturedGroup(match) {
    for (let group = 1; group < match.length; group++) {
      if (match[group] !== undefined) return group;
    }
    return 0;
  }

  /**
   * Whether a match delimits any content once its delimiters are shed.
   *
   * Only rewritable text is joined, so a construct wrapping nothing but a
   * skipped element - `` {+`code`+} `` - reads as empty in the joined text
   * while its DOM range still spans the element. The range is what decides:
   * an element, or any text, is content. A match with neither is the literal
   * `{++}` an author typed, and has to survive as written.
   */
  function wrapsContent(range, leading, trailing) {
    const contents = range.cloneContents();
    dom.trimText(contents, leading, trailing);
    return contents.textContent !== "" || contents.querySelector("*") !== null;
  }

  /**
   * Replaces a match with `build`'s element, moving the captured content into
   * it instead of discarding it.
   *
   * Inline constructs delimit content the author wrote - `{+added+}` is an
   * addition *of* something - so the markup inside has to survive. Nothing is
   * deleted but the delimiters themselves, which is also why this does not need
   * the foreign-text check that replacement does: whatever the match spans is
   * kept, so nothing can be lost and no fragments are joined into new meaning.
   */
  function wrapMatch(nodes, match, build) {
    const group = capturedGroup(match);
    const inner = match.indices[group];
    const outer = rangeOf(nodes, match);
    const leading = inner[0] - match.index;
    const trailing = match.index + match[0].length - inner[1];

    if (!wrapsContent(outer, leading, trailing)) return;

    const wrapper = build(match);
    if (!wrapper) return;

    const contents = outer.extractContents();
    dom.trimText(contents, leading, trailing);

    wrapper.appendChild(contents);
    outer.insertNode(wrapper);
  }

  function wrapInBlock(nodes, pattern, build) {
    const found = allMatches(joinedText(nodes), pattern);
    for (let index = found.length - 1; index >= 0; index--) {
      wrapMatch(nodes, found[index], build);
    }
  }

  /**
   * Whether the range covers text the block's run deliberately left out.
   *
   * Only the text a transformation may rewrite is joined, so a skipped element -
   * a link, a code span - can sit between a match's two ends while the joined
   * text reads as continuous. Replacing such a match would delete that element
   * along with the range, and worse, the join can bring two fragments together
   * into a match the source never contained.
   *
   * Elements whose text *is* in the run are not foreign: the preview wraps every
   * word in a `<span md-src-pos>` for scroll sync, so almost every real match
   * spans those, and the replacement carries their text.
   */
  function coversForeignText(range, nodes) {
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, null);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (range.intersectsNode(node) && nodes.indexOf(node) === -1) return true;
    }
    return false;
  }

  function replaceMatch(nodes, match, build) {
    const built = build(match);
    if (!built) return;

    const range = rangeOf(nodes, match);
    range.deleteContents();
    range.insertNode(built);
  }

  function joinedText(nodes) {
    return nodes.map(function (node) { return node.nodeValue; }).join("");
  }

  /** The matches in a block that may actually be replaced, in document order. */
  function viableMatches(nodes, pattern) {
    return allMatches(joinedText(nodes), pattern).filter(function (match) {
      return !coversForeignText(rangeOf(nodes, match), nodes);
    });
  }

  function replaceInBlock(nodes, pattern, build) {
    const found = viableMatches(nodes, pattern);

    // Last match first: replacing it cannot disturb the offsets of the ones
    // before it, which all sit in earlier, untouched nodes.
    for (let index = found.length - 1; index >= 0; index--) {
      replaceMatch(nodes, found[index], build);
    }
  }

  namespace.text = {
    replaceInText: function (root, pattern, build) {
      namespace.textBlocks(root).forEach(function (nodes) {
        replaceInBlock(nodes, pattern, build);
      });
    },

    /**
     * Every match `replaceInText` would act on, in document order.
     *
     * A transformation that numbers its matches cannot take the order from the
     * replacement itself, which runs backwards through each block so that one
     * replacement never moves the next one's offsets. Both go through the same
     * viability filter, so the two always agree on which matches count.
     */
    /** As `replaceInText`, but keeping the matched content inside the new element. */
    wrapInText: function (root, pattern, build) {
      namespace.textBlocks(root).forEach(function (nodes) {
        wrapInBlock(nodes, pattern, build);
      });
    },

    /** The character span of a match within a block's joined text, as a Range. */
    spanRange: spanRange,

    matchesInText: function (root, pattern) {
      const found = [];
      namespace.textBlocks(root).forEach(function (nodes) {
        viableMatches(nodes, pattern).forEach(function (match) { found.push(match); });
      });
      return found;
    }
  };
})(window.GLFM);
