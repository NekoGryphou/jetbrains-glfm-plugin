// GitLab's "inapplicable" task state, `- [~] item`, unknown to GFM task lists.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;
  const INAPPLICABLE = /^\s*\[~]\s?/;

  /** The text node holding the marker, whether or not the item is wrapped. */
  function taskTextNode(item) {
    const first = item.firstChild;
    const holder = first?.tagName === "P" ? first.firstChild : first;
    return holder?.nodeType === Node.TEXT_NODE ? holder : null;
  }

  function markInapplicable(item, node, prefixLength) {
    node.nodeValue = node.nodeValue.slice(prefixLength);

    const checkbox = dom.createGenerated("input", "glfm-task-checkbox");
    checkbox.type = "checkbox";
    checkbox.disabled = true;
    node.parentNode.insertBefore(checkbox, node);

    item.classList.add("glfm-task-inapplicable", "task-list-item");
  }

  function markIfInapplicable(item) {
    const node = taskTextNode(item);
    const match = INAPPLICABLE.exec(node?.nodeValue ?? "");
    if (match) markInapplicable(item, node, match[0].length);
  }

  namespace.transformInapplicableTasks = function (root) {
    dom.queryAll(root, "li")
      .filter(function (item) { return !item.classList.contains("glfm-task-inapplicable"); })
      .forEach(markIfInapplicable);
  };
})(window.GLFM);
