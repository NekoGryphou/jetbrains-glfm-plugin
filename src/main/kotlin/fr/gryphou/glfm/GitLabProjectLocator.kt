package fr.gryphou.glfm

import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap

/**
 * Derives the GitLab project web URL from the repository's `origin` remote.
 *
 * Reads `.git/config` directly instead of depending on the Git plugin, so the
 * plugin stays installable in any JetBrains IDE without an optional dependency.
 */
object GitLabProjectLocator {

    private class Detection(val config: Path?, val stamp: Long, val webUrl: String?)

    /**
     * Detection is filesystem work, and it is asked for on the EDT while the
     * settings dialog is built and again for every preview panel that opens.
     * Keying the memo on the config file's modification time keeps a newly
     * added remote from needing a restart.
     */
    private val cache = ConcurrentHashMap<Path, Detection>()

    fun detect(project: Project): String? {
        val basePath = project.basePath ?: return null
        return detect(Path.of(basePath))
    }

    /**
     * Every filesystem access sits under this guard, including the walk: a
     * repository we cannot read is simply one without a detected remote, and
     * must never fail the settings dialog or the preview resource that asks.
     *
     * [stopAt] bounds the walk upwards, as `GIT_CEILING_DIRECTORIES` does for
     * git itself. Production leaves it open, so opening a subdirectory of a
     * repository detects that repository the way every other git tool would.
     */
    internal fun detect(root: Path, stopAt: Path? = null): String? = runCatching { detectUncached(root, stopAt) }
        .onFailure { thisLogger().debug("Cannot detect the GitLab remote under $root", it) }
        .getOrNull()

    private fun detectUncached(root: Path, stopAt: Path?): String? {
        val config = findGitConfig(root, stopAt)
        val stamp = if (config == null) 0L else Files.getLastModifiedTime(config).toMillis()

        val cached = cache[root]
        if (cached != null && cached.config == config && cached.stamp == stamp) return cached.webUrl

        val webUrl = config?.let(::webUrlOf)
        cache[root] = Detection(config, stamp, webUrl)
        return webUrl
    }

    private fun webUrlOf(config: Path): String? = GitRemoteParser.originUrl(Files.readString(config))
        ?.let(GitRemoteParser::toWebUrl)
        ?.takeIf(GitRemoteParser::isGitLab)

    /** Walks up from [start] looking for a `.git` directory or worktree file. */
    private fun findGitConfig(start: Path, stopAt: Path?): Path? {
        var current: Path? = start
        while (current != null) {
            val dotGit = current.resolve(".git")
            if (Files.isDirectory(dotGit)) {
                return dotGit.resolve("config").takeIf(Files::isRegularFile)
            }
            if (Files.isRegularFile(dotGit)) {
                return worktreeConfig(current, dotGit)
            }
            current = if (current == stopAt) null else current.parent
        }
        return null
    }

    /** A worktree's `.git` is a file pointing at the real git directory. */
    private fun worktreeConfig(root: Path, dotGit: Path): Path? {
        val gitDir = Files.readString(dotGit).substringAfter("gitdir:", "").trim()
        if (gitDir.isEmpty()) return null

        val resolved = root.resolve(gitDir).normalize()
        // Worktrees keep the config in the main repository.
        val commonDir = resolved.resolve("commondir")
        val mainDir = if (Files.isRegularFile(commonDir)) {
            resolved.resolve(Files.readString(commonDir).trim()).normalize()
        } else {
            resolved
        }
        return mainDir.resolve("config").takeIf(Files::isRegularFile)
    }
}
