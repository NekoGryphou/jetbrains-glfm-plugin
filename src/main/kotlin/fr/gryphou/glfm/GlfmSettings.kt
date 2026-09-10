package fr.gryphou.glfm

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.util.xmlb.XmlSerializerUtil

/** Per-project configuration for the GitLab Flavored Markdown preview. */
@Service(Service.Level.PROJECT)
@State(name = "Glfm", storages = [Storage("glfm.xml")])
class GlfmSettings : PersistentStateComponent<GlfmState> {

    private var state = GlfmState()

    override fun getState(): GlfmState = state

    override fun loadState(state: GlfmState) {
        XmlSerializerUtil.copyBean(state, this.state)
    }

    /** Configured URL if set, otherwise the auto-detected one, otherwise empty. */
    fun effectiveProjectUrl(project: Project): String {
        val configured = state.projectUrl.trim().trimEnd('/')
        if (configured.isNotEmpty()) return configured
        return GitLabProjectLocator.detect(project).orEmpty()
    }

    companion object {
        fun getInstance(project: Project): GlfmSettings = project.service()
    }
}
