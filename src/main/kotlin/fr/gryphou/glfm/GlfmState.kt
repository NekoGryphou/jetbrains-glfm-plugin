package fr.gryphou.glfm

/**
 * The persisted settings, kept free of platform types so the config-script
 * builder that consumes it can be exercised without a running IDE.
 *
 * Everything is opt-out: a plain `.md` file should render the way GitLab
 * renders it, with no per-file opt-in.
 */
class GlfmState {
    /**
     * Web URL of the GitLab project used to resolve `#123`, `!45`, `~label` and
     * friends, e.g. `https://gitlab.com/group/project`.
     *
     * Empty means "detect from the `origin` remote".
     */
    @JvmField
    var projectUrl: String = ""

    @JvmField var references: Boolean = true
    @JvmField var details: Boolean = true
    @JvmField var tableOfContents: Boolean = true
    @JvmField var footnotes: Boolean = true
    @JvmField var multilineBlockquote: Boolean = true
    @JvmField var inlineDiff: Boolean = true
    @JvmField var colorChips: Boolean = true
    @JvmField var emoji: Boolean = true
    @JvmField var inapplicableTasks: Boolean = true
    @JvmField var media: Boolean = true
    @JvmField var headingAnchors: Boolean = true
}
