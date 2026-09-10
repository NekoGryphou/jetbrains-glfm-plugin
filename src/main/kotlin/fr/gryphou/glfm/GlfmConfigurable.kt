package fr.gryphou.glfm

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ModalityState
import com.intellij.openapi.options.BoundConfigurable
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.COLUMNS_LARGE
import com.intellij.ui.dsl.builder.bindSelected
import com.intellij.ui.dsl.builder.bindText
import com.intellij.ui.dsl.builder.columns
import com.intellij.ui.dsl.builder.panel

/** Settings > Languages & Frameworks > Markdown > GitLab Flavored Markdown. */
class GlfmConfigurable(private val project: Project) : BoundConfigurable("GitLab Flavored Markdown") {

    override fun createPanel(): DialogPanel {
        val state = GlfmSettings.getInstance(project).state

        return panel {
            row("Project URL:") {
                val field = textField()
                    .bindText(state::projectUrl)
                    .columns(COLUMNS_LARGE)
                    .validationOnInput { component ->
                        val value = component.text.trim()
                        // Anything else yields relative hrefs that resolve
                        // against the preview's own server, so references would
                        // silently produce dead links.
                        if (value.isEmpty() || UrlParts.isWebUrl(value)) null
                        else error("Enter a full URL, e.g. https://gitlab.com/group/project")
                    }
                    .comment(DETECTING)

                // Detection walks the filesystem, and this runs on the EDT while
                // the dialog is built, so the answer is filled in afterwards
                // rather than freezing the dialog on a slow or remote project.
                field.comment?.let(::describeRemoteInto)
            }

            group("Render") {
                row { checkBox("Collapsible sections (<code>::: details</code>)").bindSelected(state::details) }
                row { checkBox("Table of contents (<code>[[_TOC_]]</code>)").bindSelected(state::tableOfContents) }
                row { checkBox("Footnotes (<code>[^1]</code>)").bindSelected(state::footnotes) }
                row { checkBox("Multiline blockquotes (<code>&gt;&gt;&gt;</code>)").bindSelected(state::multilineBlockquote) }
                row { checkBox("Inline diffs (<code>{+added+}</code>, <code>{-removed-}</code>)").bindSelected(state::inlineDiff) }
                row { checkBox("Colour chips in inline code").bindSelected(state::colorChips) }
                row { checkBox("Emoji shortcodes (<code>:tada:</code>)").bindSelected(state::emoji) }
                row { checkBox("Inapplicable task items (<code>[~]</code>)").bindSelected(state::inapplicableTasks) }
                row { checkBox("Audio and video embeds").bindSelected(state::media) }
                row { checkBox("Heading anchors").bindSelected(state::headingAnchors) }
                row { checkBox("GitLab references (issues, merge requests, labels, users)").bindSelected(state::references) }
            }

            row {
                comment("Close and reopen the Markdown preview to apply changes.")
            }
        }
    }

    private fun describeRemoteInto(comment: javax.swing.JEditorPane) {
        val application = ApplicationManager.getApplication()
        application.executeOnPooledThread {
            val detected = GitLabProjectLocator.detect(project)
            // `any()` so the text still lands while the Settings dialog is up.
            application.invokeLater({ comment.text = describe(detected) }, ModalityState.any())
        }
    }

    private companion object {
        const val DETECTING = "Looking for a GitLab remote&hellip;"

        const val NO_REMOTE = "No GitLab remote detected. Set the project URL to enable " +
            "<code>#123</code>, <code>!45</code>, <code>~label</code> and <code>@user</code> links."

        fun describe(detected: String?): String =
            detected?.let { "Leave empty to use the detected remote: $it" } ?: NO_REMOTE
    }
}
