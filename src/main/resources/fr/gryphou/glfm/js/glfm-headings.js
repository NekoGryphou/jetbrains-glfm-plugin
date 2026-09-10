// Heading ids, and the permalink anchors the table of contents links to.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;

  namespace.HEADINGS = "h1, h2, h3, h4, h5, h6";

  function uniqueSlug(base, used) {
    let slug = base;
    for (let counter = 1; used[slug]; counter++) slug = base + "-" + counter;
    used[slug] = true;
    return slug;
  }

  function claimExistingIds(headings) {
    const used = Object.create(null);
    headings.forEach(function (heading) {
      if (heading.id) used[heading.id] = true;
    });
    return used;
  }

  function needsId(heading) {
    return !heading.id;
  }

  /**
   * The platform's own HeaderGeneratingProvider already emits an anchor for
   * every heading, so this only fills gaps. Overwriting them would break
   * in-document links written against the ids the IDE generates.
   */
  namespace.assignHeadingIds = function (root) {
    const headings = dom.queryAll(root, namespace.HEADINGS);
    const used = claimExistingIds(headings);

    headings.filter(needsId).forEach(function (heading) {
      const base = dom.slugify(dom.textOf(heading));
      if (base) heading.id = uniqueSlug(base, used);
    });
  };

  /**
   * The visible permalink GitLab puts on every heading.
   *
   * Kept separate from `assignHeadingIds`, which the table of contents needs
   * whether or not the anchors themselves are switched on.
   */
  namespace.transformHeadingAnchors = function (root) {
    dom.queryAll(root, namespace.HEADINGS).forEach(function (heading) {
      if (!heading.id || heading.querySelector(".glfm-heading-anchor") !== null) return;

      const anchor = dom.createLink("#" + heading.id, "\u{00B6}", "glfm-heading-anchor");
      anchor.setAttribute("aria-label", "Permalink to " + dom.textOf(heading).trim());
      heading.appendChild(anchor);
    });
  };
})(window.GLFM);
