// Table of contents generated from the document's headings.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;

  /**
   * `[[_TOC_]]` never reaches the DOM intact: CommonMark reads `_TOC_` as
   * emphasis, so the paragraph's text is `[[TOC]]`. Normalising away the
   * underscores accepts both that and every other spelling GitLab allows.
   */
  function isMarker(paragraph) {
    const normalized = dom.textOf(paragraph).trim().replace(/_/g, "").toLowerCase();
    return normalized === "[[toc]]" || normalized === "[toc]";
  }

  function tocEntry(heading) {
    const item = dom.createElement("li");
    item.appendChild(dom.createLink("#" + heading.id, dom.textOf(heading), "glfm-toc-link"));
    item.appendChild(dom.createElement("ul"));
    return item;
  }

  function popToLevel(stack, level) {
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
  }

  function buildList(root) {
    const rootList = dom.createElement("ul");
    const stack = [{ level: 0, list: rootList }];

    dom.queryAll(root, namespace.HEADINGS).forEach(function (heading) {
      if (!heading.id) return;

      const level = parseInt(heading.tagName.slice(1), 10);
      popToLevel(stack, level);

      const item = tocEntry(heading);
      stack[stack.length - 1].list.appendChild(item);
      stack.push({ level: level, list: item.lastChild });
    });

    return rootList;
  }

  namespace.transformTableOfContents = function (root) {
    dom.queryAll(root, "p").filter(isMarker).forEach(function (paragraph) {
      const nav = dom.createGenerated("nav", "glfm-toc");
      nav.appendChild(buildList(root));
      dom.replace(paragraph, nav);
    });
  };
})(window.GLFM);
