// In-page anchor clicks, handled here because the platform's link extension
// treats every click as a request to leave the preview.
(function (namespace) {
  "use strict";

  function anchorTarget(event) {
    const anchor = event.target && event.target.closest ? event.target.closest("a") : null;
    const href = anchor ? anchor.getAttribute("href") || "" : "";
    if (href.length < 2 || href.charAt(0) !== "#") return null;
    return document.getElementById(href.slice(1));
  }

  function handleClick(event) {
    const target = anchorTarget(event);
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  namespace.installAnchorHandling = function () {
    document.addEventListener("click", handleClick, true);
  };
})(window.GLFM);
