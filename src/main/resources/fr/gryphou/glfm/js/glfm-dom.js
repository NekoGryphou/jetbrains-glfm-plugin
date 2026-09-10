// Element helpers shared by every GitLab Flavored Markdown transformation.
window.GLFM = window.GLFM || {};

(function (namespace) {
  "use strict";

  // Marks content this plugin produced. The text transformations skip it, so a
  // pass never rewrites its own output.
  const GENERATED = "glfm-generated";

  // Marks a wrapper this plugin built around content the document already had -
  // a `::: details` fold, a `>>>` quote. Deliberately not `GENERATED`: what is
  // inside is still the author's text, and the transformations have to keep
  // seeing it.
  const CONTAINER = "glfm-container";

  function queryAll(root, selector) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function marked(className, marker) {
    return className ? className + " " + marker : marker;
  }

  /** As `createElement`, plus the marker every generated node has to carry. */
  function createGenerated(tag, className, text) {
    return createElement(tag, marked(className, GENERATED), text);
  }

  /** As `createElement`, for a wrapper whose contents stay transformable. */
  function createContainer(tag, className, text) {
    return createElement(tag, marked(className, CONTAINER), text);
  }

  function createLink(href, text, className) {
    const anchor = createGenerated("a", className, text);
    anchor.setAttribute("href", href);
    return anchor;
  }

  function textOf(node) {
    return node && node.textContent ? node.textContent : "";
  }

  /**
   * A block construct is written over several source lines, which reach the DOM
   * as one text run inside a single paragraph.
   */
  function lines(node) {
    return textOf(node).split("\n");
  }

  function firstLine(node) {
    return lines(node)[0];
  }

  /** A node an earlier transformation folded away is detached, not gone. */
  function isAttached(node) {
    return node.parentNode !== null;
  }

  function replace(node, replacement) {
    node.parentNode.replaceChild(replacement, node);
  }

  /**
   * Drops `leading` characters from the front of a fragment's text and
   * `trailing` from its end, however many nodes those characters span.
   *
   * Used to shed a construct's delimiters from content that is being kept: the
   * text is split across nodes by the preview's scroll-sync markup, so the
   * count cannot be applied to a single node.
   */
  function trimText(fragment, leading, trailing) {
    const nodes = [];
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, null);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);

    let front = leading;
    for (let index = 0; index < nodes.length && front > 0; index++) {
      const taken = Math.min(front, nodes[index].nodeValue.length);
      nodes[index].nodeValue = nodes[index].nodeValue.slice(taken);
      front -= taken;
    }

    let back = trailing;
    for (let index = nodes.length - 1; index >= 0 && back > 0; index--) {
      const value = nodes[index].nodeValue;
      const taken = Math.min(back, value.length);
      nodes[index].nodeValue = value.slice(0, value.length - taken);
      back -= taken;
    }
  }

  /** Re-attaches the boundary character a reference pattern had to consume. */
  function withBoundary(boundary, node) {
    if (!boundary) return node;
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode(boundary));
    fragment.appendChild(node);
    return fragment;
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N} \-_]/gu, "")
      .replace(/\s+/g, "-");
  }

  namespace.dom = {
    GENERATED: GENERATED,
    CONTAINER: CONTAINER,
    queryAll: queryAll,
    createElement: createElement,
    createGenerated: createGenerated,
    createContainer: createContainer,
    createLink: createLink,
    textOf: textOf,
    lines: lines,
    firstLine: firstLine,
    isAttached: isAttached,
    replace: replace,
    trimText: trimText,
    withBoundary: withBoundary,
    slugify: slugify
  };
})(window.GLFM);
