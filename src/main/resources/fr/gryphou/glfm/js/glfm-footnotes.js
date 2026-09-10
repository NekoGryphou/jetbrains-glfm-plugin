// `[^1]` references and the definition list GitLab renders at the end.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;
  const definitions = namespace.footnoteDefinitions;

  const REFERENCE = /\[\^([^\]\s]+)]/g;
  // What the parser leaves behind when it has eaten a definition; see below.
  const PARSED_REFERENCE = /^\^([^\]\s]+)$/;

  const ID_ATTRIBUTE = "data-glfm-footnote";
  const TEXT_ATTRIBUTE = "data-glfm-footnote-text";

  function referenceMarker(id, number, text) {
    const marker = dom.createGenerated("sup", "glfm-footnote-ref");
    marker.setAttribute(ID_ATTRIBUTE, id);
    marker.setAttribute(TEXT_ATTRIBUTE, text);

    const anchor = dom.createLink("#glfm-fn-" + id, String(number));
    anchor.id = "glfm-fnref-" + id;
    marker.appendChild(anchor);
    return marker;
  }

  /**
   * Turns the markers of an earlier pass back into `[^id]` source text, and
   * hands back the definitions they were rendered from.
   *
   * Numbering is derived from the order of the references in the document, so
   * a pass has to see them as text; and a definition the parser had eaten
   * (see `recoverParsedDefinitions`) exists nowhere else, so the marker is
   * where it is kept.
   */
  function restoreMarkers(root) {
    const carried = Object.create(null);

    dom.queryAll(root, "sup.glfm-footnote-ref[" + ID_ATTRIBUTE + "]").forEach(function (marker) {
      const id = marker.getAttribute(ID_ATTRIBUTE);
      const text = marker.getAttribute(TEXT_ATTRIBUTE);
      if (text !== null) carried[id] = text;
      dom.replace(marker, document.createTextNode("[^" + id + "]"));
    });

    return carried;
  }

  /**
   * Recovers the definitions CommonMark consumed before the preview saw them.
   *
   * `[^id]: text` is also a valid link reference definition whenever `text`
   * parses as a link destination, and the parser prefers that reading: the
   * definition produces no output at all and `[^id]` in the body becomes
   * `<a href="text">^id</a>`. The destination - and the title, when the rest
   * of the line supplied one - is the definition, so both are recoverable.
   */
  /**
   * Whether the anchor's source text is the reference and nothing else.
   *
   * The preview records every node's source offsets for scroll sync, which
   * tells a reference the parser rewrote apart from an ordinary inline link
   * that merely happens to read `[^id](...)`: the latter's source is longer
   * than the reference. Absent the attribute there is nothing to check, so the
   * shape of the text has to be trusted on its own.
   */
  function spansOnlyTheReference(anchor, id) {
    const bounds = /^(\d+)\.\.(\d+)$/.exec(anchor.getAttribute("md-src-pos") || "");
    if (!bounds) return true;
    return Number(bounds[2]) - Number(bounds[1]) === id.length + "[^]".length;
  }

  function recoverParsedDefinitions(root, values) {
    dom.queryAll(root, "a[href]").forEach(function (anchor) {
      if (anchor.classList.contains(dom.GENERATED)) return;

      const match = PARSED_REFERENCE.exec(dom.textOf(anchor).trim());
      if (!match || !spansOnlyTheReference(anchor, match[1])) return;

      const title = anchor.getAttribute("title");
      values[match[1]] = anchor.getAttribute("href") + (title ? " " + title : "");
      dom.replace(anchor, document.createTextNode("[^" + match[1] + "]"));
    });
  }

  /**
   * Numbers footnotes by order of first reference, the way GFM does.
   *
   * The order is taken in a separate pass, because the replacement runs
   * backwards through each block - reading the order off it would number the
   * references in a paragraph back to front.
   */
  function numberReferences(root, values) {
    const order = [];

    namespace.text.matchesInText(root, REFERENCE).forEach(function (match) {
      const id = match[1];
      if (id in values && order.indexOf(id) === -1) order.push(id);
    });

    namespace.text.replaceInText(root, REFERENCE, function (match) {
      const id = match[1];
      const number = order.indexOf(id) + 1;
      return number > 0 ? referenceMarker(id, number, values[id]) : null;
    });

    return order;
  }

  function definitionItem(id, content) {
    const item = dom.createElement("li");
    item.id = "glfm-fn-" + id;
    item.appendChild(content);
    item.appendChild(document.createTextNode(" "));
    item.appendChild(dom.createLink("#glfm-fnref-" + id, "\u{21A9}", "glfm-footnote-back"));
    return item;
  }

  /** The paragraph that defined [id], so its own markup can be reused. */
  function sourceOf(sources, id) {
    return sources.find(function (source) { return source.ids.indexOf(id) !== -1; });
  }

  function renderSection(root, order, values, sources) {
    const section = dom.createGenerated("section", "footnotes glfm-footnotes");
    section.appendChild(dom.createElement("hr"));

    const list = dom.createElement("ol");
    order.forEach(function (id) {
      const source = sourceOf(sources, id);
      const content = (source && definitions.content(source, id)) || document.createTextNode(values[id]);
      list.appendChild(definitionItem(id, content));
    });

    section.appendChild(list);
    root.appendChild(section);
  }

  namespace.transformFootnotes = function (root) {
    // Everything the last pass wrote is undone before anything is read, so a
    // repeated pass starts from the state the first one saw and rebuilds the
    // same result - numbering included, as the document is edited.
    root.querySelector(".glfm-footnotes")?.remove();
    const values = restoreMarkers(root);
    definitions.reveal(root);

    recoverParsedDefinitions(root, values);
    // A definition still present in the document is authoritative over the one
    // carried on a marker, which may be a pass out of date.
    const sources = definitions.collect(root, values);

    const order = numberReferences(root, values);
    if (order.length > 0) renderSection(root, order, values, sources);

    // Runs even with nothing rendered: a definition no reference resolved has
    // to be handed back to the pipeline rather than left marked as ours.
    definitions.settle(sources, order);
  };
})(window.GLFM);
