// Parsing of `[^id]: text` definition paragraphs.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;
  const DEFINITION = /^\[\^([^\]\s]+)]:\s*(.*)$/;

  // The label introducing a definition, which the rendered list drops: the
  // number in front of the list item already says which footnote this is.
  const LABEL = /^\s*\[\^[^\]\s]+]:\s*/;

  // Hidden by the stylesheet, and only once the section that shows the
  // definition elsewhere has actually rendered.
  const DEFINITION_CLASS = "glfm-footnote-definition";

  function isDefinitionParagraph(paragraph) {
    return dom.isAttached(paragraph) && DEFINITION.test(dom.firstLine(paragraph).trim());
  }

  function textNodesOf(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
    return nodes;
  }

  /**
   * Reads every definition in a paragraph, folding continuation lines in.
   *
   * Each one also records the character span it occupies in the paragraph's
   * text. Definitions are separated by line, which the DOM does not model, so
   * the span is what lets the rendered list be built from a definition's own
   * nodes rather than from its flattened text.
   */
  function readInto(definitions, paragraph) {
    const text = dom.textOf(paragraph);
    const regions = [];
    let offset = 0;
    let currentId = null;

    text.split("\n").forEach(function (line) {
      const trimmed = line.trim();
      const match = DEFINITION.exec(trimmed);
      if (match) {
        currentId = match[1];
        definitions[currentId] = match[2];
        regions.push({ id: currentId, start: offset, label: LABEL.exec(line)[0].length, end: 0 });
      } else if (currentId && trimmed) {
        definitions[currentId] += " " + trimmed;
      }
      offset += line.length + 1;
    });

    regions.forEach(function (region, index) {
      const next = regions[index + 1];
      region.end = next ? next.start : text.length;
      while (region.end > region.start && /\s/.test(text.charAt(region.end - 1))) region.end--;
    });

    return regions;
  }

  namespace.footnoteDefinitions = {
    /**
     * Reads every definition paragraph into `definitions`, and reports what
     * each paragraph carried.
     *
     * The paragraphs stay in the document - it is what the next pass rebuilds
     * from - but are marked as generated straight away, so the numbering pass
     * that follows does not rewrite the raw `[^id]:` source still sitting there.
     */
    collect: function (root, definitions) {
      return dom.queryAll(root, "p").filter(isDefinitionParagraph).map(function (paragraph) {
        const regions = readInto(definitions, paragraph);
        paragraph.classList.add(dom.GENERATED);
        return {
          paragraph: paragraph,
          regions: regions,
          ids: regions.map(function (region) { return region.id; })
        };
      });
    },

    /**
     * A definition's own nodes, so `**bold**` and links survive into the
     * rendered list instead of being flattened to their text.
     */
    content: function (source, id) {
      const region = source.regions.find(function (candidate) { return candidate.id === id; });
      if (!region) return null;

      const range = namespace.text.spanRange(textNodesOf(source.paragraph), region.start, region.end);
      const fragment = range.cloneContents();
      dom.trimText(fragment, region.label, 0);
      return fragment;
    },

    /**
     * Settles what happens to each definition paragraph now that the section is
     * built: one the list shows is hidden, and one nothing references is handed
     * back to the rest of the pipeline, which would otherwise skip the emoji and
     * references in a definition left visible on purpose.
     */
    settle: function (sources, rendered) {
      sources.forEach(function (source) {
        const shown = source.ids.some(function (id) { return rendered.indexOf(id) !== -1; });
        if (shown) source.paragraph.classList.add(DEFINITION_CLASS);
        else source.paragraph.classList.remove(dom.GENERATED);
      });
    },

    /**
     * Undoes a previous pass's hiding.
     *
     * A definition whose reference the author has since deleted renders
     * nowhere, and has to become visible again rather than vanish silently.
     */
    reveal: function (root) {
      dom.queryAll(root, "." + DEFINITION_CLASS).forEach(function (paragraph) {
        paragraph.classList.remove(DEFINITION_CLASS);
      });
    }
  };
})(window.GLFM);
