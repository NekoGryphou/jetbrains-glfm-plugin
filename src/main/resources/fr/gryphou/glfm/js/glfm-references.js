// GitLab references - #123, !45, %7, &8, ~label, @user.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;
  const urls = namespace.referenceUrls;

  // A reference only counts at a word boundary, which the pattern has to
  // consume and `withBoundary` then puts back.
  const BOUNDARY = "(^|[\\s(\\[{,;:\"'])";

  function linkIssuable(match) {
    const [, boundary, projectPrefix, sigil, number] = match;

    const url = urls.issuable(sigil, number, projectPrefix);
    if (!url) return null;

    const label = (projectPrefix || "") + sigil + number;
    return dom.withBoundary(boundary, dom.createLink(url, label, "glfm-reference"));
  }

  function linkLabel(match) {
    const name = match[2] !== undefined ? match[2] : match[3];
    if (!name) return null;
    return dom.withBoundary(match[1], dom.createLink(urls.label(name), name, "glfm-label"));
  }

  /** A milestone title cannot be resolved to an id, so link the list instead. */
  function linkMilestone(match) {
    return dom.withBoundary(match[1], dom.createLink(urls.milestones(), "%" + match[2], "glfm-reference"));
  }

  function linkMention(match) {
    if (!urls.hasInstance()) return null;
    return dom.withBoundary(match[1], dom.createLink(urls.user(match[2]), "@" + match[2], "glfm-mention"));
  }

  const RULES = [
    { pattern: new RegExp(BOUNDARY + "((?:[\\w.\\-]+/)+[\\w.\\-]+)?([#!$%&])(\\d+)\\b", "g"), build: linkIssuable },
    // A dot is allowed inside a label name but never at its end, so the period
    // closing a sentence stays out of the label.
    { pattern: new RegExp(BOUNDARY + "~(?:\"([^\"\\n]+)\"|([\\w\\-]+(?:\\.[\\w\\-]+)*))", "g"), build: linkLabel },
    { pattern: new RegExp(BOUNDARY + "%\"([^\"\\n]+)\"", "g"), build: linkMilestone },
    { pattern: new RegExp(BOUNDARY + "@([A-Za-z0-9][\\w.\\-]*)\\b", "g"), build: linkMention }
  ];

  namespace.transformReferences = function (root) {
    if (!urls.hasProject()) return;

    RULES.forEach(function (rule) {
      namespace.text.replaceInText(root, rule.pattern, rule.build);
    });
  };
})(window.GLFM);
