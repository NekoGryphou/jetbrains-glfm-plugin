package fr.gryphou.glfm

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * The class exists because [java.net.URI.getHost] drops the port, so the port is
 * what most of this covers: losing it rewrites a self-hosted instance's address
 * into one that does not answer, and every reference the preview builds is hung
 * off that address.
 */
class UrlPartsTest {

    @Test
    fun `keeps a non-default port in the origin`() {
        val parts = UrlParts.parse("https://gitlab.example.com:8443/group/project")!!
        assertEquals("https://gitlab.example.com:8443", parts.origin)
        assertEquals("gitlab.example.com", parts.host)
    }

    @Test
    fun `omits the port when the url does not name one`() {
        assertEquals("https://gitlab.com", UrlParts.parse("https://gitlab.com/acme/widgets")!!.origin)
    }

    @Test
    fun `a web remote keeps its own scheme and port`() {
        assertEquals("http://gitlab.internal", UrlParts.parse("http://gitlab.internal/g/p")!!.webOrigin)
        assertEquals(
            "https://gitlab.example.com:8443",
            UrlParts.parse("https://gitlab.example.com:8443/g/p")!!.webOrigin,
        )
    }

    /**
     * An ssh remote names a transport port, which the web interface does not
     * listen on - carrying it over would point every reference at the git daemon.
     */
    @Test
    fun `an ssh remote keeps only the host`() {
        assertEquals("https://gitlab.example.com", UrlParts.parse("ssh://git@gitlab.example.com:2222/g/p")!!.webOrigin)
        assertEquals("https://gitlab.example.com", UrlParts.parse("git://gitlab.example.com/g/p")!!.webOrigin)
    }

    @Test
    fun `only http and https count as web urls`() {
        assertTrue(UrlParts.isWebUrl("https://gitlab.com/a/b"))
        assertTrue(UrlParts.isWebUrl("http://gitlab.internal/a/b"))
        assertFalse(UrlParts.isWebUrl("ssh://git@gitlab.com/a/b"))
        assertFalse(UrlParts.isWebUrl("git@gitlab.com:a/b.git"))
    }

    /**
     * Anything relative would be emitted as-is and resolve against the preview's
     * own static server rather than the instance.
     */
    @Test
    fun `a url without a scheme and host does not parse`() {
        assertNull(UrlParts.parse(""))
        assertNull(UrlParts.parse("   "))
        assertNull(UrlParts.parse("not a url"))
        assertNull(UrlParts.parse("/group/project"))
        assertNull(UrlParts.parse("gitlab.com/group/project"))
        assertFalse(UrlParts.isWebUrl("/group/project"))
    }

    @Test
    fun `the scheme is compared without regard to case`() {
        assertTrue(UrlParts.isWebUrl("HTTPS://gitlab.com/a/b"))
        assertEquals("https", UrlParts.parse("HTTPS://gitlab.com/a/b")!!.scheme)
    }

    @Test
    fun `the path is stripped of its surrounding slashes`() {
        assertEquals("group/project", UrlParts.parse("https://gitlab.com/group/project/")!!.path)
        assertEquals("", UrlParts.parse("https://gitlab.com")!!.path)
        assertEquals("", UrlParts.parse("https://gitlab.com/")!!.path)
    }

    @Test
    fun `surrounding whitespace is ignored`() {
        assertEquals("https://gitlab.com", UrlParts.parse("  https://gitlab.com/a/b  ")!!.origin)
    }
}
