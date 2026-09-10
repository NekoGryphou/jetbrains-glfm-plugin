# Contributing

How the plugin works, how to build it and how it is tested. If you only
want to use it, the [README](README.md) is the place to look.

## How it works

The IDE parses Markdown with a hardcoded CommonMark/GFM flavour:
`MarkdownParserManager.FLAVOUR` is a static field, and the `flavourProvider`
extension point is not consulted when preview HTML is generated. A parser
extension therefore cannot reach the preview, so the plugin rewrites the
rendered DOM instead.

`GlfmPreviewExtension` registers on
`org.intellij.markdown.browserPreviewExtensionProvider` and injects stylesheets
and scripts into the preview browser. Those scripts hook
`IncrementalDOM.notifications.afterPatchListeners`, the callback the preview
fires after every re-render, and rewrite the DOM in place — the same mechanism
the platform's own math extension uses. Every pass is idempotent, so it
converges on each keystroke.

Two properties of the rendered DOM shape the implementation:

- The preview wraps words in `<span md-src-pos="…">` for scroll sync, so an
  inline construct such as `:tada:` arrives split across several text nodes.
  Matching therefore runs over a whole block's joined text and applies the
  result with a `Range`, rather than one text node at a time.
- Matching is scoped to a block element, so a match can never join two
  paragraphs.

Only the text a transformation may rewrite is joined - never the contents of a
link, a code span or the plugin's own output - so the joined text is not always
contiguous in the DOM. Two rules follow, and between them they are the reason
most of this layer's bugs have been where they were:

- A **replacing** transformation (a reference, an emoji) declines any match
  whose range covers text the join left out. Replacing it would delete the
  skipped element, and worse, the join can bring two fragments together into a
  match the source never contained - `` #1`x`23 `` must not become issue 123.
  Declining leaves the GitLab syntax visible, which is what the preview already
  does for anything it cannot render.
- A **wrapping** transformation (an inline diff) keeps what it spans: only the
  delimiters are removed, and the content moves into the new element. Nothing
  can be lost, so no such check is needed, and because the wrapper is a
  container rather than generated output the passes that follow still see the
  references and emoji inside it.

A transformation that numbers its matches takes the order in a separate
document-order pass, because replacement runs backwards through each block so
that one replacement never moves the next one's offsets.

## Building

Requires a JDK 21+. The build uses an IDE already installed on the machine
rather than downloading a platform archive:

```bash
JAVA_HOME=/opt/webstorm/jbr ./gradlew buildPlugin
```

The installable archive is written to `build/distributions/`.

Point `localIdeDir` in `gradle.properties` at a different IDE to build against
it, or clear that property to download the IDE named by `platformType` and
`platformVersion`.

Run a sandboxed IDE with the plugin loaded:

```bash
JAVA_HOME=/opt/webstorm/jbr ./gradlew runIde
```

`docs/glfm-sample.md` exercises every construct, plus the cases that must be
left alone.

## Testing

```bash
JAVA_HOME=/opt/webstorm/jbr ./gradlew check
```

`check` runs the unit tests, the preview suite and the IntelliJ Plugin
Verifier. The verifier dominates the runtime; use `-x verifyPlugin` for a fast
loop.

CI (`.github/workflows/build.yml`) runs the same `check` on a hosted runner,
where the platform is downloaded rather than taken from `localIdeDir` - and the
preview suite runs against that downloaded IDE, so both suites and the verifier
are covered there.

Three suites:

**`src/test`** — JUnit 5 tests for the Kotlin side: git remote parsing
(`GitRemoteParser`), project detection (`GitLabProjectLocator`), URL
decomposition (`UrlParts`, where the port is what matters), the persisted
defaults (`GlfmState`) and generation of the config script handed to the browser
(`GlfmConfigScript`), including the escaping that keeps a URL from closing the
surrounding `<script>` element. All are free of platform types and run without
an IDE.

**`tools/preview-test`** — the transformation layer only exists in a browser, so
it is covered headlessly: Markdown is rendered with the **IDE's own parser**,
loaded from the installed IDE's jars, and the plugin's preview scripts are
replayed over the result in jsdom. Every case runs in five shapes:

| mode                 | what it catches                                                                             |
|----------------------|---------------------------------------------------------------------------------------------|
| plain                | the parser's own output                                                                     |
| split                | words wrapped in `<span md-src-pos="…">`, so an inline construct is split across text nodes |
| pipeline run twice   | a transformation that is not idempotent                                                     |
| incremental-dom      | the path production takes - `afterPatchListeners`, not the `MutationObserver` fallback      |
| document re-rendered | an edit re-rendering over the plugin's own output                                           |

Each case is read only after the browser has settled, so a transformation that
undoes itself asynchronously fails rather than passing on the synchronous
snapshot. `docs/glfm-sample.md` is run as a case of its own, which keeps the
manual checklist honest.

It needs `npm install` in `tools/preview-test` and nothing else: the build
compiles the render helper itself and points the harness at whichever IDE it
resolved, local or downloaded. The task skips itself when `node_modules` is
absent, so a clean checkout still builds without Node.js.

**`tools/preview-test/visual`** — jsdom has no cascade and no layout, so the
stylesheets are invisible to the suite above: a renamed class or a dropped
custom property passes there. The same output is therefore loaded into Chromium,
which is what JCEF runs, with the real stylesheets attached.

`visual/styles.spec.js` asserts computed values - the fold is closed, the chip is
painted the colour it names, the permalink is transparent until hovered - and
needs no baseline, so it works on a fresh checkout. `visual/visual.spec.js`
screenshots each construct, and the whole sample, in both themes.

It additionally needs `npx playwright install chromium`, and the Gradle task
skips itself when that browser is absent. Baselines live in
`visual/__screenshots__/` and are **Linux**, as CI takes them; see
`tools/preview-test/README.md` before regenerating one.

## Releasing

Tag it. `v0.2.0` publishes a release; a tag with `dev` in it - `v0.2.0-dev.3` -
publishes as a pre-release, and to a Marketplace channel of its own so a stable
user is never offered it.

The tagged version's own `## [x.y.z]` section in `CHANGELOG.md` becomes both the
GitHub release notes and the plugin's change-notes, so cut that section before
tagging. Without one, the notes fall back to what GitHub generates from the
commits and the change-notes to `[Unreleased]`.

Signing and Marketplace publishing are skipped unless their secrets exist, so
the release path works before either is set up:

| secret                 | what it is                                        |
|------------------------|---------------------------------------------------|
| `CERTIFICATE_CHAIN`    | the signing certificate chain, PEM                |
| `PRIVATE_KEY`          | its private key, PEM                              |
| `PRIVATE_KEY_PASSWORD` | that key's password                               |
| `PUBLISH_TOKEN`        | a Marketplace token, from your JetBrains profile  |

See [plugin signing](https://plugins.jetbrains.com/docs/intellij/plugin-signing.html)
for generating the first three. The **first** version has to be uploaded and
approved by hand: `publishPlugin` can only update a listing that already exists.

## A note on the extension point

`MarkdownBrowserPreviewExtension` is marked `@ApiStatus.Obsolete` upstream while
remaining the only supported way to extend the JCEF preview; every bundled
extension still implements it. If it is ever replaced, only
`GlfmPreviewExtension.kt` is affected. The plugin verifier reports one
experimental-API usage for the same reason, and it is left visible on purpose.
