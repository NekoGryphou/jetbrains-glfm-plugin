// Builds GitLab URLs for the reference syntaxes, from the project's remote.
(function (namespace) {
  "use strict";

  const ISSUABLE_PATHS = {
    "#": "/-/issues/",
    "!": "/-/merge_requests/",
    "$": "/-/snippets/",
    "%": "/-/milestones/"
  };

  const urls = { project: "", instance: "", group: "" };

  /**
   * The group an epic reference belongs to: the project's path without the
   * project itself.
   *
   * Not the first segment - a project in a subgroup belongs to `group/sub`, and
   * epics are numbered per group, so the first segment names a different group's
   * epic entirely.
   */
  function groupOf(projectUrl, instanceUrl) {
    const segments = projectUrl.slice(instanceUrl.length).replace(/^\/+/, "").split("/");
    return segments.slice(0, -1).join("/");
  }

  function epic(number) {
    return urls.group ? urls.instance + "/groups/" + urls.group + "/-/epics/" + number : null;
  }

  /** Cross-project references carry their own `group/project` prefix. */
  function base(projectPrefix) {
    return projectPrefix ? urls.instance + "/" + projectPrefix : urls.project;
  }

  /** The reference pattern only yields `# ! $ % &`, so anything else is `&`. */
  function issuable(sigil, number, projectPrefix) {
    const path = ISSUABLE_PATHS[sigil];
    return path ? base(projectPrefix) + path + number : epic(number);
  }

  namespace.referenceUrls = {
    /** Both arguments are normalised strings; empty means "not configured". */
    configure: function (projectUrl, instanceUrl) {
      urls.project = projectUrl;
      urls.instance = instanceUrl;
      urls.group = projectUrl && instanceUrl ? groupOf(projectUrl, instanceUrl) : "";
    },
    hasProject: function () { return urls.project !== ""; },
    hasInstance: function () { return urls.instance !== ""; },
    issuable: issuable,
    label: function (name) { return urls.project + "/-/issues/?label_name[]=" + encodeURIComponent(name); },
    milestones: function () { return urls.project + "/-/milestones"; },
    user: function (name) { return urls.instance + "/" + name; }
  };
})(window.GLFM);
