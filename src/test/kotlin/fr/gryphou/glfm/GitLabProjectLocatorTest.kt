package fr.gryphou.glfm

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.createDirectories
import kotlin.io.path.writeText

class GitLabProjectLocatorTest {

    @Test
    fun `reads the origin of a plain repository`(@TempDir root: Path) {
        gitDir(root).resolve("config").writeText(ORIGIN_CONFIG)

        assertEquals("https://gitlab.com/group/project", GitLabProjectLocator.detect(root))
    }

    @Test
    fun `walks up to the repository root`(@TempDir root: Path) {
        gitDir(root).resolve("config").writeText(ORIGIN_CONFIG)
        val nested = root.resolve("module/src").also { it.createDirectories() }

        assertEquals("https://gitlab.com/group/project", GitLabProjectLocator.detect(nested))
    }

    @Test
    fun `follows a worktree pointer to the main repository config`(@TempDir root: Path) {
        val main = root.resolve("main").also { it.createDirectories() }
        gitDir(main).resolve("config").writeText(ORIGIN_CONFIG)

        val worktreeGitDir = main.resolve(".git/worktrees/feature").also { it.createDirectories() }
        worktreeGitDir.resolve("commondir").writeText("../..")

        val worktree = root.resolve("feature").also { it.createDirectories() }
        worktree.resolve(".git").writeText("gitdir: ${worktreeGitDir.toAbsolutePath()}\n")

        assertEquals("https://gitlab.com/group/project", GitLabProjectLocator.detect(worktree))
    }

    @Test
    fun `an unreadable worktree pointer is undetected rather than fatal`(@TempDir root: Path) {
        // A pointer file that is not valid UTF-8 is the shape that used to
        // escape detection and take the settings dialog down with it.
        Files.write(root.resolve(".git"), byteArrayOf(0xC3.toByte(), 0x28))

        assertNull(GitLabProjectLocator.detect(root))
    }

    @Test
    fun `ignores a remote that is not gitlab`(@TempDir root: Path) {
        gitDir(root).resolve("config").writeText(
            "[remote \"origin\"]\n\turl = git@github.com:acme/gitlab-markdown-preview.git\n",
        )

        assertNull(GitLabProjectLocator.detect(root))
    }

    @Test
    fun `has nothing to detect without a repository`(@TempDir root: Path) {
        // Bounded at the temp directory: the walk goes to the filesystem root
        // by design, so an ancestor that happens to be a repository would
        // otherwise decide the outcome.
        assertNull(GitLabProjectLocator.detect(root, stopAt = root))
    }

    @Test
    fun `stops at the ceiling instead of adopting an enclosing repository`(@TempDir root: Path) {
        gitDir(root).resolve("config").writeText(ORIGIN_CONFIG)
        val nested = root.resolve("unrelated").also { it.createDirectories() }

        assertEquals("https://gitlab.com/group/project", GitLabProjectLocator.detect(nested))
        assertNull(GitLabProjectLocator.detect(nested, stopAt = nested))
    }

    private fun gitDir(root: Path): Path = root.resolve(".git").also { it.createDirectories() }

    private companion object {
        const val ORIGIN_CONFIG = "[remote \"origin\"]\n\turl = git@gitlab.com:group/project.git\n"
    }
}
