package fr.gryphou.glfm

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class GitRemoteParserTest {

    @Test
    fun `prefers the origin remote over others`() {
        val config = """
            [core]
                bare = false
            [remote "upstream"]
                url = git@gitlab.com:other/upstream.git
            [remote "origin"]
                url = git@gitlab.com:group/project.git
        """.trimIndent()

        assertEquals("git@gitlab.com:group/project.git", GitRemoteParser.originUrl(config))
    }

    @Test
    fun `falls back to the first remote when there is no origin`() {
        val config = """
            [remote "fork"]
                url = https://gitlab.com/group/fork.git
            [remote "other"]
                url = https://gitlab.com/group/other.git
        """.trimIndent()

        assertEquals("https://gitlab.com/group/fork.git", GitRemoteParser.originUrl(config))
    }

    @Test
    fun `ignores urls outside a remote section`() {
        val config = """
            [branch "main"]
                url = not-a-remote
        """.trimIndent()

        assertNull(GitRemoteParser.originUrl(config))
    }

    @Test
    fun `returns null for a config without remotes`() {
        assertNull(GitRemoteParser.originUrl("[core]\n\tbare = false\n"))
    }

    @Test
    fun `converts scp-like remotes`() {
        assertEquals(
            "https://gitlab.com/group/project",
            GitRemoteParser.toWebUrl("git@gitlab.com:group/project.git"),
        )
    }

    @Test
    fun `converts https remotes and strips the git suffix`() {
        assertEquals(
            "https://gitlab.com/group/project",
            GitRemoteParser.toWebUrl("https://gitlab.com/group/project.git"),
        )
    }

    @Test
    fun `reads keys and sections whatever their case and spacing`() {
        val config = """
            [REMOTE  "origin"]
                URL = git@gitlab.com:group/project.git
        """.trimIndent()

        assertEquals("git@gitlab.com:group/project.git", GitRemoteParser.originUrl(config))
    }

    @Test
    fun `reads a section header followed by a comment`() {
        val config = """
            [remote "origin"] ; the canonical one
                url = git@gitlab.com:group/project.git
            [remote "upstream"]
                url = git@gitlab.com:other/upstream.git
        """.trimIndent()

        assertEquals("git@gitlab.com:group/project.git", GitRemoteParser.originUrl(config))
    }

    @Test
    fun `strips an inline comment from the url value`() {
        // Detection would otherwise appear to succeed while every derived
        // reference link carried the comment along.
        val config = """
            [remote "origin"]
                url = git@gitlab.com:group/project.git # canonical
        """.trimIndent()

        assertEquals("git@gitlab.com:group/project.git", GitRemoteParser.originUrl(config))
        assertEquals("https://gitlab.com/group/project", GitRemoteParser.toWebUrl(GitRemoteParser.originUrl(config)!!))
    }

    @Test
    fun `strips a semicolon comment and surrounding quotes`() {
        val config = """
            [remote "origin"]
                url = "git@gitlab.com:group/project.git" ; also canonical
        """.trimIndent()

        assertEquals("git@gitlab.com:group/project.git", GitRemoteParser.originUrl(config))
    }

    @Test
    fun `keeps a comment character that is part of a quoted value`() {
        val config = """
            [remote "origin"]
                url = "https://gitlab.com/group/pro#ject.git"
        """.trimIndent()

        assertEquals("https://gitlab.com/group/pro#ject.git", GitRemoteParser.originUrl(config))
    }

    @Test
    fun `ignores keys that merely start with url`() {
        val config = """
            [remote "origin"]
                urlsomething = nonsense
        """.trimIndent()

        assertNull(GitRemoteParser.originUrl(config))
    }

    @Test
    fun `converts ssh remotes with a port`() {
        assertEquals(
            "https://gitlab.example.com/group/project",
            GitRemoteParser.toWebUrl("ssh://git@gitlab.example.com:2222/group/project.git"),
        )
    }

    @Test
    fun `keeps the port of a self-hosted https remote`() {
        assertEquals(
            "https://gitlab.example.com:8443/group/project",
            GitRemoteParser.toWebUrl("https://gitlab.example.com:8443/group/project.git"),
        )
    }

    @Test
    fun `keeps a plain http scheme instead of forcing https`() {
        assertEquals(
            "http://gitlab.example.com/group/project",
            GitRemoteParser.toWebUrl("http://gitlab.example.com/group/project.git"),
        )
    }

    @Test
    fun `keeps nested subgroups`() {
        assertEquals(
            "https://gitlab.com/group/sub/project",
            GitRemoteParser.toWebUrl("git@gitlab.com:group/sub/project.git"),
        )
    }

    @Test
    fun `rejects remotes with no path`() {
        assertNull(GitRemoteParser.toWebUrl("https://gitlab.com"))
    }

    @Test
    fun `rejects an empty remote`() {
        assertNull(GitRemoteParser.toWebUrl("   "))
    }

    @Test
    fun `recognises gitlab hosts only`() {
        assertTrue(GitRemoteParser.isGitLab("https://gitlab.com/group/project"))
        assertTrue(GitRemoteParser.isGitLab("https://GitLab.example.com/group/project"))
        assertFalse(GitRemoteParser.isGitLab("https://github.com/group/project"))
    }

    @Test
    fun `matches the host rather than the whole url`() {
        // A project merely named after GitLab, mirrored to another forge, would
        // otherwise have its references linked into GitLab's URL layout.
        assertFalse(GitRemoteParser.isGitLab("https://github.com/acme/gitlab-markdown-preview"))
        assertFalse(GitRemoteParser.isGitLab("https://example.com/gitlab/project"))
        assertTrue(GitRemoteParser.isGitLab("https://gitlab.example.com:8443/group/project"))
    }
}
