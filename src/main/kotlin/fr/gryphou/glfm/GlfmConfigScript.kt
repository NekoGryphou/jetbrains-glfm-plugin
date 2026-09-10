package fr.gryphou.glfm

/**
 * Builds the `window.__GLFM_CONFIG__` literal handed to the preview browser.
 *
 * Kept free of platform types, and the single place where values are escaped
 * before being written into a `<script>` body.
 */
object GlfmConfigScript {

    fun build(projectUrl: String, dark: Boolean, state: GlfmState): String = buildString {
        val instanceUrl = instanceUrlOf(projectUrl)

        append("window.__GLFM_CONFIG__ = {")
        append("projectUrl:").append(jsString(projectUrl)).append(',')
        append("instanceUrl:").append(jsString(instanceUrl)).append(',')
        // The stylesheet carries both palettes; the IDE only picks one.
        append("dark:").append(dark).append(',')
        append("features:{")
        appendFeatures(state, resolvable = instanceUrl.isNotEmpty())
        append("}};")
    }

    private fun StringBuilder.appendFeatures(state: GlfmState, resolvable: Boolean) {
        val features = listOf(
            // A reference needs an absolute project URL to hang off. The
            // settings field is free text, so a value that is not one would
            // otherwise produce relative hrefs pointing at the preview server.
            "references" to (state.references && resolvable),
            "details" to state.details,
            "tableOfContents" to state.tableOfContents,
            "footnotes" to state.footnotes,
            "multilineBlockquote" to state.multilineBlockquote,
            "inlineDiff" to state.inlineDiff,
            "colorChips" to state.colorChips,
            "emoji" to state.emoji,
            "inapplicableTasks" to state.inapplicableTasks,
            "media" to state.media,
            "headingAnchors" to state.headingAnchors,
            // Heading ids are what the table of contents links to, so either
            // feature being on is enough to need them.
            "headingIds" to (state.headingAnchors || state.tableOfContents),
        )
        features.joinTo(this, separator = ",") { (name, enabled) -> "$name:$enabled" }
    }

    /**
     * The instance root the preview resolves `@user`, `&epic` and cross-project
     * references against. Empty unless the project URL is an absolute `http(s)`
     * address, which is the only kind the preview can build a link from.
     */
    internal fun instanceUrlOf(projectUrl: String): String =
        UrlParts.parse(projectUrl)?.takeIf { it.isWeb }?.origin.orEmpty()

    /** `<` is escaped so a URL can never close the surrounding script element. */
    internal fun jsString(value: String): String = buildString {
        append('"')
        for (character in value) {
            when (character) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '<' -> append("\\u003c")
                else -> append(character)
            }
        }
        append('"')
    }
}
