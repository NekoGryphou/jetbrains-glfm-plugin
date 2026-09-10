package fr.gryphou.glfm

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class GlfmStateTest {

    /**
     * Everything is opt-out: a plain `.md` file should render the way GitLab
     * renders it, with no per-file or per-project opt-in.
     *
     * Asserted over the fields rather than one by one, so a feature added later
     * has to make the same choice instead of shipping switched off by an
     * oversight no test would notice.
     */
    @Test
    fun `every feature is on by default`() {
        val state = GlfmState()

        val flags = GlfmState::class.java.declaredFields
            .filter { it.type == Boolean::class.javaPrimitiveType }
            .associate { it.name to it.getBoolean(state) }

        assertTrue(flags.isNotEmpty(), "no feature flags found - has the state been restructured?")
        assertEquals(emptyList<String>(), flags.filterValues { !it }.keys.toList())
    }

    /** Empty means "detect from the `origin` remote", which is the default path. */
    @Test
    fun `the project url starts empty`() {
        assertEquals("", GlfmState().projectUrl)
    }
}
