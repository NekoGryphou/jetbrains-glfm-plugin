// JSON tables are built with DOM text nodes; JSON never becomes executable HTML.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const text = (value) => value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const label = (key) => key.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());

  function parse(source) {
    let data;
    try { data = JSON.parse(source); } catch (_) { return null; }
    if (!object(data) || !Array.isArray(data.items) || !data.items.every(object)) return null;
    const fields = data.fields === undefined
      ? Object.keys(data.items[0] || {}) : data.fields;
    if (!Array.isArray(fields)) return null;
    const normalized = [];
    for (const field of fields) {
      if (typeof field !== "string" && (!object(field) || typeof field.key !== "string")) return null;
      const key = typeof field === "string" ? field : field.key;
      normalized.push({
        key: key,
        label: typeof field === "string" || field.label === undefined ? label(key) : text(field.label),
        sortable: object(field) && own(field, "sortable") ? field.sortable === true : data.sortable === true
      });
    }
    return { fields: normalized, items: data.items, filter: data.filter === true,
      caption: data.caption === undefined ? "Generated with JSON data" : text(data.caption) };
  }

  function build(data) {
    const wrapper = dom.createGenerated("div", "glfm-json-table");
    const table = dom.createElement("table");
    table.appendChild(dom.createElement("caption", "", data.caption));
    const head = dom.createElement("thead");
    const headings = dom.createElement("tr");
    const body = dom.createElement("tbody");
    const headers = [];
    let sorted = -1;
    let direction = 0;
    let query = "";
    const rows = data.items.map((item, index) => ({ index: index,
      values: data.fields.map((field) => own(item, field.key) ? item[field.key] : null) }));

    function render() {
      const visible = rows.filter((row) => row.values.some((value) => text(value).toLowerCase().includes(query)) || !query);
      if (direction !== 0) visible.sort((left, right) => {
        const a = left.values[sorted];
        const b = right.values[sorted];
        // Missing values remain last in either direction; equal values keep source order.
        if (a == null || a === "") return b == null || b === "" ? left.index - right.index : 1;
        if (b == null || b === "") return -1;
        const compared = typeof a === "number" && typeof b === "number"
          ? a - b : text(a).localeCompare(text(b), undefined, { numeric: true, sensitivity: "base" });
        return compared * direction || left.index - right.index;
      });
      const fragment = document.createDocumentFragment();
      visible.forEach((row) => {
        const tr = dom.createElement("tr");
        row.values.forEach((value) => tr.appendChild(dom.createElement("td", "", text(value))));
        fragment.appendChild(tr);
      });
      body.replaceChildren(fragment);
      headers.forEach((header, index) => {
        if (data.fields[index].sortable) header.setAttribute("aria-sort",
          index === sorted && direction !== 0 ? direction === 1 ? "ascending" : "descending" : "none");
      });
    }

    data.fields.forEach((field, index) => {
      const th = dom.createElement("th");
      th.setAttribute("scope", "col");
      if (field.sortable) {
        const button = dom.createElement("button", "glfm-json-sort", field.label);
        button.type = "button";
        button.setAttribute("aria-label", field.label);
        button.addEventListener("click", () => {
          direction = sorted !== index ? 1 : direction === 1 ? -1 : direction === -1 ? 0 : 1;
          sorted = index;
          render();
        });
        th.appendChild(button);
      } else th.textContent = field.label;
      headers.push(th);
      headings.appendChild(th);
    });
    head.appendChild(headings);
    table.appendChild(head);
    table.appendChild(body);
    if (data.filter) {
      const filterLabel = dom.createElement("label", "glfm-json-filter", "Filter table ");
      const input = dom.createElement("input");
      input.type = "search";
      input.addEventListener("input", () => {
        query = input.value.toLowerCase();
        render();
      });
      filterLabel.appendChild(input);
      wrapper.appendChild(filterLabel);
    }
    wrapper.appendChild(table);
    render();
    return wrapper;
  }

  namespace.transformJsonTables = function (root) {
    dom.queryAll(root, "pre > code").forEach((code) => {
      if (!code.classList.contains("language-json:table") || code.closest(".glfm-generated")) return;
      const data = parse(code.textContent);
      if (!data) return;
      const pre = code.parentNode;
      const table = build(data);
      const sourcePosition = pre.getAttribute("md-src-pos") || code.getAttribute("md-src-pos");
      if (sourcePosition) table.setAttribute("md-src-pos", sourcePosition);
      pre.replaceWith(table);
    });
  };
})(window.GLFM);
