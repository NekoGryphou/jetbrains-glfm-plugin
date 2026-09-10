package fr.gryphou.glfm

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class GlfmConfigScriptTest {

    private val projectUrl = "https://gitlab.com/acme/widgets"

    @Test
    fun `derives the instance url from the project url`() {
        assertEquals("https://gitlab.com", GlfmConfigScript.instanceUrlOf(projectUrl))
        assertEquals("https://gitlab.example.com", GlfmConfigScript.instanceUrlOf("https://gitlab.example.com/a/b"))
    }

    @Test
    fun `keeps the port of a self-hosted instance`() {
        assertEquals(
            "https://gitlab.example.com:8443",
            GlfmConfigScript.instanceUrlOf("https://gitlab.example.com:8443/group/project"),
        )
        assertEquals("http://gitlab.internal", GlfmConfigScript.instanceUrlOf("http://gitlab.internal/g/p"))
    }

    @Test
    fun `has no instance url without a usable project url`() {
        assertEquals("", GlfmConfigScript.instanceUrlOf(""))
        assertEquals("", GlfmConfigScript.instanceUrlOf("not a url"))
        // No scheme: the preview would emit relative hrefs against its own server.
        assertEquals("", GlfmConfigScript.instanceUrlOf("gitlab.com/group/project"))
        assertEquals("", GlfmConfigScript.instanceUrlOf("ssh://git@gitlab.com/group/project"))
    }

    @Test
    fun `disables references when the project url is not an absolute web address`() {
        val script = GlfmConfigScript.build("gitlab.com/group/project", dark = false, state = GlfmState())

        assertTrue(script.contains("references:false"))
        assertTrue(script.contains("instanceUrl:\"\""))
    }

    @Test
    fun `escapes characters that would break out of the script element`() {
        assertEquals("\"\\u003c/script>\"", GlfmConfigScript.jsString("</script>"))
        assertEquals("\"a\\\"b\"", GlfmConfigScript.jsString("a\"b"))
        assertEquals("\"a\\\\b\"", GlfmConfigScript.jsString("a\\b"))
        assertEquals("\"a\\nb\"", GlfmConfigScript.jsString("a\nb"))
    }

    @Test
    fun `emits every feature the preview pipeline looks up`() {
        val script = GlfmConfigScript.build(projectUrl, dark = false, state = GlfmState())

        val expected = listOf(
            "references", "details", "tableOfContents", "footnotes", "multilineBlockquote",
            "inlineDiff", "colorChips", "emoji", "inapplicableTasks", "media",
            "headingAnchors", "headingIds",
        )
        expected.forEach { feature -> assertTrue(script.contains("$feature:"), "missing feature: $feature") }
    }

    @Test
    fun `disables references when no project url is known`() {
        val script = GlfmConfigScript.build("", dark = false, state = GlfmState())

        assertTrue(script.contains("references:false"))
        assertTrue(script.contains("projectUrl:\"\""))
        assertTrue(script.contains("instanceUrl:\"\""))
    }

    @Test
    fun `keeps references off when the setting is off despite a project url`() {
        val state = GlfmState().apply { references = false }
        val script = GlfmConfigScript.build(projectUrl, dark = false, state = state)

        assertTrue(script.contains("references:false"))
    }

    @Test
    fun `derives heading ids from anchors or the table of contents`() {
        val neither = GlfmState().apply { headingAnchors = false; tableOfContents = false }
        assertTrue(GlfmConfigScript.build(projectUrl, false, neither).contains("headingIds:false"))

        val tocOnly = GlfmState().apply { headingAnchors = false; tableOfContents = true }
        assertTrue(GlfmConfigScript.build(projectUrl, false, tocOnly).contains("headingIds:true"))

        val anchorsOnly = GlfmState().apply { headingAnchors = true; tableOfContents = false }
        assertTrue(GlfmConfigScript.build(projectUrl, false, anchorsOnly).contains("headingIds:true"))
    }

    @Test
    fun `passes the theme through`() {
        assertTrue(GlfmConfigScript.build(projectUrl, dark = true, state = GlfmState()).contains("dark:true"))
        assertFalse(GlfmConfigScript.build(projectUrl, dark = false, state = GlfmState()).contains("dark:true"))
    }

    @Test
    fun `produces a single assignment statement`() {
        val script = GlfmConfigScript.build(projectUrl, dark = false, state = GlfmState())

        assertTrue(script.startsWith("window.__GLFM_CONFIG__ = {"))
        assertTrue(script.endsWith("}};"))
    }
}
