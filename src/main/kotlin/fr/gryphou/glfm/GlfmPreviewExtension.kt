package fr.gryphou.glfm

import com.intellij.openapi.project.Project
import com.intellij.ui.JBColor
import org.intellij.plugins.markdown.extensions.MarkdownBrowserPreviewExtension
import org.intellij.plugins.markdown.ui.preview.MarkdownHtmlPanel
import org.intellij.plugins.markdown.ui.preview.ResourceProvider

/**
 * Injects the GitLab Flavored Markdown renderer into the JCEF Markdown preview.
 *
 * The IDE parses Markdown with a hardcoded CommonMark/GFM flavour - the
 * `flavourProvider` extension point is not consulted when the preview HTML is
 * generated - so GitLab-only constructs reach the preview as plain text. The
 * renderer therefore runs in the preview browser and rewrites the rendered DOM
 * after every incremental-dom patch, which is the same mechanism the bundled
 * math and copy-button extensions use.
 */
class GlfmPreviewExtension(panel: MarkdownHtmlPanel) : MarkdownBrowserPreviewExtension, ResourceProvider {

    /**
     * `MarkdownHtmlPanel.getProject()` is marked experimental, but the panel is
     * the only handle the extension point hands out and it exposes no stable
     * equivalent, so the annotation is acknowledged rather than worked around.
     * The accessor is nullable by contract and every read below tolerates null.
     */
    @Suppress("UnstableApiUsage")
    private val project: Project? = panel.project

    /**
     * Sorted last so the stylesheet is appended after the platform's own base
     * styles and therefore wins on equal specificity.
     */
    override val priority: MarkdownBrowserPreviewExtension.Priority
        get() = MarkdownBrowserPreviewExtension.Priority.AFTER_ALL

    override val scripts: List<String>
        get() = SCRIPTS

    override val styles: List<String>
        get() = STYLES

    override val resourceProvider: ResourceProvider
        get() = this

    override fun canProvide(resourceName: String): Boolean = resourceName in RESOURCES

    override fun loadResource(resourceName: String): ResourceProvider.Resource? = when (resourceName) {
        CONFIG_JS -> ResourceProvider.Resource(buildConfigScript().toByteArray(), JAVASCRIPT)
        else -> ResourceProvider.loadInternalResource(
            GlfmPreviewExtension::class.java,
            resourceName,
            if (resourceName.endsWith(".css")) STYLESHEET else JAVASCRIPT,
        )
    }

    override fun dispose() = Unit

    /**
     * Settings are read once per preview panel, because the static server
     * serves each resource when the panel is created.
     */
    private fun buildConfigScript(): String {
        val state = project?.let { GlfmSettings.getInstance(it).state } ?: GlfmState()
        val projectUrl = project?.let { GlfmSettings.getInstance(it).effectiveProjectUrl(it) }.orEmpty()
        return GlfmConfigScript.build(projectUrl, !JBColor.isBright(), state)
    }

    class Provider : MarkdownBrowserPreviewExtension.Provider {
        override fun createBrowserExtension(panel: MarkdownHtmlPanel): MarkdownBrowserPreviewExtension =
            GlfmPreviewExtension(panel)
    }

    companion object {
        // Charset is stated explicitly so the scripts never depend on the
        // preview document's encoding being guessed correctly.
        private const val JAVASCRIPT = "text/javascript; charset=utf-8"
        private const val STYLESHEET = "text/css; charset=utf-8"

        internal const val CONFIG_JS = "js/glfm-config.js"

        /** Load order matters: helpers and feature modules before the entry point. */
        internal val SCRIPTS = listOf(
            CONFIG_JS,
            "js/glfm-env.js",
            "js/glfm-emoji-data.js",
            "js/glfm-dom.js",
            "js/glfm-text-nodes.js",
            "js/glfm-text.js",
            "js/glfm-fold.js",
            "js/glfm-details.js",
            "js/glfm-quotes.js",
            "js/glfm-headings.js",
            "js/glfm-toc.js",
            "js/glfm-tasks.js",
            "js/glfm-media.js",
            "js/glfm-footnote-definitions.js",
            "js/glfm-footnotes.js",
            "js/glfm-inline.js",
            "js/glfm-emoji.js",
            "js/glfm-reference-urls.js",
            "js/glfm-references.js",
            "js/glfm-anchors.js",
            "js/glfm-pipeline.js",
            "js/glfm-report.js",
            "js/glfm.js",
        )

        internal val STYLES = listOf("css/glfm-theme.css", "css/glfm.css")

        private val RESOURCES = (SCRIPTS + STYLES).toSet()
    }
}
