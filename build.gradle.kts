import org.jetbrains.changelog.Changelog
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.intellij.platform.gradle.extensions.IntelliJPlatformDependenciesExtension
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion

plugins {
    kotlin("jvm") version "2.4.20"
    id("org.jetbrains.intellij.platform") version "2.18.1"
    // Turns the CHANGELOG's section for this version into the plugin's
    // change-notes, so "What's New" in the IDE is the file, not a second copy of
    // it that drifts.
    id("org.jetbrains.changelog") version "2.5.0"
}

group = providers.gradleProperty("pluginGroup").get()

/**
 * `pluginVersion`, with an optional suffix identifying an unreleased build.
 *
 * A preview handed to someone has to say which commit it is: every build
 * otherwise calls itself the same version, and an installed plugin then gives
 * no way to tell what is actually in it. CI passes
 * `-PpluginBuildSuffix=dev.<run>.<sha>`; a release build passes nothing.
 */
version = providers.gradleProperty("pluginVersion").get() +
    providers.gradleProperty("pluginBuildSuffix")
        .filter { it.isNotEmpty() }
        .map { "-$it" }
        .getOrElse("")

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    testImplementation(platform("org.junit:junit-bom:6.1.3"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    intellijPlatform {
        // Prefer the IDE already installed on this machine: no multi-gigabyte
        // download, and the compiled code is checked against the exact API the
        // developer actually runs.
        val localDir = providers.gradleProperty("localIdeDir").map(::File).orNull
        if (localDir != null && localDir.isDirectory) {
            local(localDir)
        } else {
            create(
                type = IntelliJPlatformType.fromCode(providers.gradleProperty("platformType").get()),
                version = providers.gradleProperty("platformVersion").get(),
            )
        }

        bundledPlugin("org.intellij.plugins.markdown")

        pluginVerifier()
        zipSigner()
    }
}

/**
 * `[Unreleased]` is what `patchChangelog` promotes on release; the rest is what
 * the generated notes link back to.
 */
changelog {
    version = providers.gradleProperty("pluginVersion")
    repositoryUrl = "https://github.com/NekoGryphou/jetbrains-glfm-plugin"
}

intellijPlatform {
    pluginConfiguration {
        /**
         * The CHANGELOG's section for this version, rendered to the HTML the
         * Marketplace and the Plugins dialog expect, so "What's New" is the file
         * rather than a second copy of it.
         *
         * Read from `pluginVersion` rather than the built version, which carries
         * a `-dev.<run>` suffix no section is named after. A version with no
         * section of its own - the next one, before it is cut - falls back to
         * `[Unreleased]` instead of failing the build.
         *
         * Rendered here and not in a provider: a lazy one captures the changelog
         * extension, and through it the `Project`, which `patchPluginXml` then
         * cannot serialise into the configuration cache.
         */
        changeNotes = with(changelog) {
            val release = providers.gradleProperty("pluginVersion").get()
            renderItem(
                (getOrNull(release) ?: getUnreleased())
                    .withHeader(false)
                    .withEmptySections(false),
                Changelog.OutputType.HTML,
            )
        }

        ideaVersion {
            sinceBuild = providers.gradleProperty("pluginSinceBuild")
            untilBuild = providers.gradleProperty("pluginUntilBuild")
                .map { it.trim() }
                .filter { it.isNotEmpty() }
        }
    }

    // Nothing in this plugin is instrumentable: there are no `.form` files, and
    // the instrumenter's other job - adding @NotNull assertions - rewrites Java
    // bytecode, of which there is none (`compileJava` and `compileTestJava` are
    // both NO-SOURCE). Left on, `instrumentTestCode` fails the build on a hosted
    // runner, where the Ant taskdef behind it does not resolve.
    instrumentCode = false

    // `MarkdownBrowserPreviewExtension` is marked @ApiStatus.Obsolete upstream
    // while remaining the only supported way to extend the JCEF preview - every
    // bundled extension (math, alerts, copy buttons) still implements it. Keep
    // the verifier from failing the build over that single expected report.
    pluginVerification {
        failureLevel = listOf(
            org.jetbrains.intellij.platform.gradle.tasks.VerifyPluginTask.FailureLevel.COMPATIBILITY_PROBLEMS,
            org.jetbrains.intellij.platform.gradle.tasks.VerifyPluginTask.FailureLevel.INVALID_PLUGIN,
        )

        // Without a target the task has nothing to verify against and simply
        // hangs resolving one. Prefer the IDE installed on this machine, for
        // the same reason the build compiles against it.
        ides {
            val localDir = providers.gradleProperty("localIdeDir").map(::File).orNull
            if (localDir != null && localDir.isDirectory) {
                local(localDir)
            } else {
                // The platform the build already resolved, rather than
                // `recommended()`: that pulls several further IDE builds, each a
                // multi-gigabyte download and extraction, which does not fit on
                // a hosted runner alongside the build platform itself. This
                // needs no second copy of anything.
                current()
            }
        }
    }

    /**
     * Marketplace refuses an unsigned upload, so a release is signed with the
     * certificate JetBrains issued for this plugin.
     *
     * Read from the environment rather than a file or a gradle property: these
     * are secrets, and a property would end up in a build scan or a shell's
     * history. Absent - every build that is not a release, a fork's pull request
     * included - `signPlugin` simply has nothing to do, so an ordinary build
     * never needs them.
     */
    signing {
        certificateChain = providers.environmentVariable("CERTIFICATE_CHAIN")
        privateKey = providers.environmentVariable("PRIVATE_KEY")
        password = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
    }

    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")

        /*
         * A pre-release goes to a channel of its own, so installing it is opt-in
         * and a stable user is never offered it: `0.2.0-dev.3` publishes to
         * `dev`, and a plain `0.2.0` to the default channel.
         *
         * This is the same identifier the release workflow reads to decide
         * whether a tag is a pre-release.
         */
        channels = providers.gradleProperty("pluginVersion").map { released ->
            listOf(released.substringAfter('-', "").substringBefore('.').ifEmpty { "default" })
        }
    }
}


tasks.test {
    useJUnitPlatform()

    // GlfmPreviewExtensionResourcesTest reads the Node harness's own script
    // list, so a change there has to invalidate this task - otherwise the drift
    // guard stays up-to-date through the very edit it exists to catch.
    val harnessScript = layout.projectDirectory.file("tools/preview-test/harness.js")
    inputs.file(harnessScript).withPropertyName("previewHarness")
    systemProperty("glfm.previewHarness", harnessScript.asFile.absolutePath)

    testLogging {
        events("passed", "failed", "skipped")
    }
}

/**
 * The preview transformation layer only exists in a browser, so it is covered by
 * a Node harness instead.
 *
 * The harness renders with a real IDE's Markdown parser. Which IDE that is gets
 * derived from the compile classpath rather than assumed to be `localIdeDir`, so
 * it is found whether the platform came from a local installation or was
 * downloaded by the build: either way its jars sit in `<home>/lib`, and
 * `product-info.json` marks the root. That is what lets the suite run on a
 * machine with no IDE installed by hand, a CI runner included.
 *
 * The derivation is repeated in both tasks on purpose: a shared script-level
 * provider would be captured as a script object reference, which the
 * configuration cache cannot serialise.
 */
val previewRenderClasses = tasks.register<JavaCompile>("previewRenderClasses") {
    description = "Compiles the preview harness's render helper against the IDE's own parser."

    val platformClasspath = sourceSets.main.get().compileClasspath
    val home = providers.provider {
        platformClasspath.files.firstOrNull { jar ->
            jar.parentFile?.name == "lib" && File(jar.parentFile.parentFile, "product-info.json").isFile
        }?.parentFile?.parentFile
    }

    // `Render.java` needs the platform's own jars plus the Markdown plugin's.
    source(layout.projectDirectory.file("tools/preview-test/Render.java"))
    classpath = files(home.map { root ->
        listOf("lib", "plugins/markdown/lib", "plugins/markdown/lib/modules")
            .map { File(root, it) }
            .flatMap { dir -> dir.listFiles { file: File -> file.name.endsWith(".jar") }?.toList() ?: emptyList() }
    })
    destinationDirectory = layout.buildDirectory.dir("preview-test/classes")
    options.release = 21

    onlyIf { home.orNull != null }
}

/** Skipped when Node's dependencies are absent, so a clean checkout still builds without Node.js. */
val previewTest = tasks.register<Exec>("previewTest") {
    group = "verification"
    description = "Runs the preview transformation tests (requires Node.js; see tools/preview-test)."

    dependsOn(previewRenderClasses)

    val platformClasspath = sourceSets.main.get().compileClasspath
    val home = providers.provider {
        platformClasspath.files.firstOrNull { jar ->
            jar.parentFile?.name == "lib" && File(jar.parentFile.parentFile, "product-info.json").isFile
        }?.parentFile?.parentFile
    }

    val harness = layout.projectDirectory.dir("tools/preview-test")
    workingDir = harness.asFile
    commandLine("npm", "test")

    val renderClasses = previewRenderClasses.flatMap { it.destinationDirectory }
    doFirst {
        environment("GLFM_IDE_HOME", home.get().absolutePath)
        environment("GLFM_RENDER_CLASSES", renderClasses.get().asFile.absolutePath)
    }

    onlyIf { harness.dir("node_modules").asFile.isDirectory && home.orNull != null }
}

/**
 * The visual half of the same harness: the preview loaded into Chromium, which
 * is what JCEF runs, with the plugin's stylesheets attached.
 *
 * Skipped unless its browser is present as well as its dependencies. Playwright
 * downloads that separately from `npm install`, so a checkout that has only run
 * the latter would otherwise fail a build it never asked to run this in.
 */
val previewVisual = tasks.register<Exec>("previewVisual") {
    group = "verification"
    description = "Runs the preview's visual tests (requires Node.js and `npx playwright install chromium`)."

    dependsOn(previewRenderClasses)

    val platformClasspath = sourceSets.main.get().compileClasspath
    val home = providers.provider {
        platformClasspath.files.firstOrNull { jar ->
            jar.parentFile?.name == "lib" && File(jar.parentFile.parentFile, "product-info.json").isFile
        }?.parentFile?.parentFile
    }

    val harness = layout.projectDirectory.dir("tools/preview-test")
    workingDir = harness.asFile
    commandLine("npm", "run", "visual")

    val renderClasses = previewRenderClasses.flatMap { it.destinationDirectory }
    doFirst {
        environment("GLFM_IDE_HOME", home.get().absolutePath)
        environment("GLFM_RENDER_CLASSES", renderClasses.get().asFile.absolutePath)
    }

    val browsers = providers.environmentVariable("PLAYWRIGHT_BROWSERS_PATH")
        .map(::File)
        .orElse(File(System.getProperty("user.home"), ".cache/ms-playwright"))

    onlyIf {
        harness.dir("node_modules").asFile.isDirectory && home.orNull != null && browsers.get().isDirectory
    }
}

tasks.check {
    dependsOn(previewTest)
    dependsOn(previewVisual)

    // Binary compatibility against the platform is a correctness property like
    // any other, so it is verified by `check` rather than left to release day -
    // the API this plugin extends is the one most likely to move under it.
    //
    // It builds the distribution and resolves an IDE to verify against, so it
    // dominates the runtime of `check`. Use `-x verifyPlugin` for a fast loop.
    dependsOn(tasks.named("verifyPlugin"))
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_21
        // Stay within the language/API level the bundled platform stdlib exposes,
        // even though a newer compiler is used to build.
        apiVersion = KotlinVersion.KOTLIN_2_2
        languageVersion = KotlinVersion.KOTLIN_2_2
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
