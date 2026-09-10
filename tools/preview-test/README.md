# Preview tests

Two suites over the same fixtures. `check.js` asserts what each construct
*becomes*; the visual suite asserts what it then *looks like*.

## Transformations (`npm test`)

The transformation layer only runs inside the preview browser, so it is verified
headlessly here:

1. `Render.java` parses Markdown with the **IDE's own parser**, loaded from the
   installed IDE's jars, and prints the HTML the preview would receive.
2. `harness.js` loads that HTML into jsdom and evaluates the plugin's preview
   scripts against it, in the order `GlfmPreviewExtension` declares.
3. `check.js` asserts what each construct becomes, including the cases that must
   be left alone.

Every case runs in three shapes:

- **plain** — the parser's own output.
- **split** — words wrapped in `<span md-src-pos="…">`, as the preview does for
  scroll sync. This splits an inline construct across several text nodes, which
  is the shape the plugin actually has to cope with.
- **plain, pipeline run twice** — the pipeline is run a second time over the DOM
  its first pass produced. The preview re-runs it after every patch, so a
  transformation that is not idempotent corrupts the document as it is edited.

Each case is also read only after the browser has settled, so a transformation
that undoes itself asynchronously — via the fallback `MutationObserver` — fails
rather than passing on the synchronous snapshot.

## Setup

```bash
npm install
```

That is the whole setup. Run through Gradle - `./gradlew previewTest`, or
`check`, which includes it - and the build compiles `Render.java` for you and
points the harness at the IDE it resolved, whether that is the local
installation named by `localIdeDir` or one it downloaded. The task skips itself
when `node_modules` is absent, so a clean checkout still builds without Node.

To run `npm test` directly instead, the harness needs to be told where an IDE
is: it uses `GLFM_IDE_HOME` (default `/opt/webstorm`) for the parser jars and
the JVM, and `GLFM_RENDER_CLASSES` for the compiled `Render` class, falling
back to this directory.

## Running

```bash
npm test
```

Once set up, `./gradlew check` runs this suite too; the Gradle task skips itself
when `node_modules` or `Render.class` is absent.

## Flavour caveat

`harness.js` sets `USE_GFM=1`, which makes `Render.java` fall back to
`GFMFlavourDescriptor`. The IDE's own `MarkdownDefaultFlavour` needs a live
`Application` to build heading anchors and cannot render headings outside the
IDE. The two flavours agree on every construct this plugin touches — verified by
rendering each one both ways — so `check.js` supplies heading `id` attributes as
literal HTML where a test needs them.

# Visual tests

jsdom has no cascade and no layout, so `check.js` cannot see the stylesheets.
These load the same output into Chromium, which is what JCEF runs.

| file | asserts |
| --- | --- |
| `visual/page.js` | builds the page: IDE parser output, real stylesheets, every module in declared order, incremental-dom patches |
| `visual/styles.spec.js` | computed values. No baselines, so it runs on a fresh checkout |
| `visual/visual.spec.js` | screenshots, per construct and whole-sample, both themes |
| `visual/base.css` | the neutral page they are drawn on, not the IDE's own stylesheet |

## Setup

```bash
npm install
npx playwright install chromium
```

## Running

```bash
npm run visual
```

Also `./gradlew previewVisual`, or `check`. The Gradle task skips itself when
the browser is absent.

## Baselines

`visual/__screenshots__/` is committed, shared rather than per-machine, and
belongs to **Linux, as CI runs**. Another platform differs in font rendering.

```bash
npm run visual:update      # rewrite them from this machine
```

Update a baseline when the change was intended, not to make a red build green.
A failing CI run uploads what it saw under `verify-reports`.
