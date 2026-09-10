// Audio and video written with image syntax, which GitLab renders as a player.
//
// The preview cannot play them: PreviewStaticServer's Content Security Policy
// hardcodes `media-src 'none'`, and an extension can only contribute script and
// style sources. A <video> element would therefore render as a dead control
// strip. A link is offered instead - still better than the broken image the
// preview shows otherwise, since the browser cannot decode an .mp4 as an image.
(function (namespace) {
  "use strict";

  const dom = namespace.dom;

  const MEDIA_KINDS = [
    { pattern: /\.(mp4|m4v|mov|webm|ogv)(\?.*)?$/i, kind: "video" },
    { pattern: /\.(mp3|oga|ogg|spx|wav)(\?.*)?$/i, kind: "audio" }
  ];

  function mediaKindFor(source) {
    const match = MEDIA_KINDS.find(function (candidate) { return candidate.pattern.test(source); });
    return match ? match.kind : null;
  }

  function toMediaLink(image, kind) {
    const source = image.getAttribute("src");
    const label = image.getAttribute("alt") || source.split("/").pop();

    const link = dom.createLink(source, label, "glfm-media glfm-media-" + kind);
    link.setAttribute("title", source);
    return link;
  }

  namespace.transformMedia = function (root) {
    dom.queryAll(root, "img").forEach(function (image) {
      const kind = mediaKindFor(image.getAttribute("src") || "");
      if (kind) dom.replace(image, toMediaLink(image, kind));
    });
  };
})(window.GLFM);
