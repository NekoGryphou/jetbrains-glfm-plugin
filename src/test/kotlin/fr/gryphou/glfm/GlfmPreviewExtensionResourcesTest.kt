package fr.gryphou.glfm

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import java.nio.file.Path
import kotlin.io.path.readText

/**
 * The preview fails silently by nature, and a resource the extension declares
 * but cannot serve is the worst version of that: the browser simply never runs
 * the module, and the features that depended on it disappear with no error the
 * user can see.
 */
class GlfmPreviewExtensionResourcesTest {

    @Test
    fun `every declared resource is on the classpath`() {
        val declared = GlfmPreviewExtension.SCRIPTS.filterNot { it == GlfmPreviewExtension.CONFIG_JS } +
            GlfmPreviewExtension.STYLES

        declared.forEach { name ->
            assertNotNull(
                GlfmPreviewExtension::class.java.getResource(name),
                "declared but not packaged: $name",
            )
        }
    }

    /**
     * The Node harness evaluates the modules itself and so keeps its own copy of
     * the load order. Order decides what a module can rely on already existing,
     * so a harness that has drifted is testing a program the IDE never runs.
     */
    @Test
    fun `the preview test harness loads the same scripts in the same order`() {
        // Gradle passes the path so the task can declare the file as an input;
        // the fallback keeps the test runnable straight from the IDE.
        val location = System.getProperty("glfm.previewHarness")
            ?.let(Path::of)
            ?: Path.of("tools", "preview-test", "harness.js")

        val harness = location.readText()
        val declared = harness.substringAfter("const SCRIPTS = [").substringBefore("];")

        val listed = Regex("\"([^\"]+\\.js)\"").findAll(declared).map { it.groupValues[1] }.toList()
        val expected = GlfmPreviewExtension.SCRIPTS
            .filterNot { it == GlfmPreviewExtension.CONFIG_JS }
            .map { it.removePrefix("js/") }

        assertEquals(expected, listed)
    }

    /**
     * The visual suite attaches the stylesheets itself, and their order decides
     * which rules win on equal specificity - the reason this extension sorts
     * itself after all the others. A harness that has drifted is screenshotting
     * a cascade the IDE never builds.
     */
    @Test
    fun `the preview test harness loads the same styles in the same order`() {
        val location = System.getProperty("glfm.previewHarness")
            ?.let(Path::of)
            ?: Path.of("tools", "preview-test", "harness.js")

        val harness = location.readText()
        val declared = harness.substringAfter("const STYLES = [").substringBefore("];")

        val listed = Regex("\"([^\"]+\\.css)\"").findAll(declared).map { it.groupValues[1] }.toList()
        val expected = GlfmPreviewExtension.STYLES.map { it.removePrefix("css/") }

        assertEquals(expected, listed)
    }
}
