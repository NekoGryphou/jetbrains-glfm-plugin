const fs = require("fs");
const path = require("path");
const { renderMarkdown, transform } = require("./harness");

// The document the plugin is checked against by hand. Running it here as well
// keeps that checklist honest: a construct that stops rendering fails the build
// rather than waiting to be noticed in a preview.
const SAMPLE = fs.readFileSync(path.join(__dirname, "..", "..", "docs", "glfm-sample.md"), "utf8");

const cases = [
  { name: "TOC [[_TOC_]]", md: "# One\n\n[[_TOC_]]\n\n## Two\n", expect: /<nav class="glfm-toc[\s\S]*href="#two"[^>]*>Two</ },
  { name: "TOC links to platform anchor", html: '<h2 id="platform-anchor">Title</h2><p>[TOC]</p>', expect: /href="#platform-anchor"/ },
  { name: "TOC [TOC]", md: "# One\n\n[TOC]\n\n## Two\n", expect: /<nav class="glfm-toc[\s\S]*href="#two"[^>]*>Two</ },
  // An entry is a generated link, which every text pass skips, so the contents
  // has to be built after them or a shortcode in a heading stays raw for good.
  { name: "TOC entry shows a heading's emoji as the glyph", md: "[[_TOC_]]\n\n## :warning: Careful\n", expect: /glfm-toc-link[^>]*>\u26A0\uFE0F Careful</, reject: /glfm-toc-link[^>]*>:warning:/ },
  { name: "TOC entry sheds inline diff delimiters", md: "[[_TOC_]]\n\n## Now {+faster+}\n", expect: /glfm-toc-link[^>]*>Now faster</ },
  { name: "details (blank lines)", md: "::: details Title\n\nBody **bold**\n\n:::\n", expect: /<details class="glfm-details[^>]*><summary>Title<\/summary>[\s\S]*<strong[ >]/, expectText: /Body bold/ },
  { name: "details (no blank lines)", md: "::: details Title\nline one\nline two\n:::\n", expect: /glfm-details-raw/ },
  { name: "details unterminated stays literal", md: "::: details Title\n\nBody\n", expectText: /::: details Title/ },
  { name: "multiline blockquote", md: ">>>\nQuoted.\n\nSecond.\n>>>\n", expect: /<blockquote class="glfm-multiline-quote[\s\S]*Quoted[\s\S]*Second/ },
  // The definition keeps its own nodes, so in the preview's scroll-sync markup
  // its words are separate spans - the text is asserted, not the HTML string.
  { name: "footnote ref + definition", md: "Text[^1].\n\n[^1]: Def here.\n", expect: /glfm-footnote-ref[\s\S]*glfm-footnotes/, expectText: /Def here/ },
  { name: "footnote without definition stays literal", md: "Text[^ghost].\n", expectText: /\[\^ghost]/ },
  { name: "inapplicable task", md: "- [~] n/a\n", expect: /glfm-task-inapplicable/ },
  { name: "inline diff {+ +}", md: "was {-old-} now {+new+}\n", expect: /glfm-deletion[\s\S]*glfm-addition/ },
  { name: "inline diff [+ +]", md: "was [-old-] now [+new+]\n", expect: /glfm-deletion[\s\S]*glfm-addition/ },
  { name: "color chip hex", md: "Color `#f4511e`\n", expect: /glfm-color-chip/ },
  { name: "color chip rgba", md: "Color `rgba(1,2,3,0.5)`\n", expect: /glfm-color-chip/ },
  { name: "color chip 8-digit hex", md: "Color `#1f1e2480`\n", expect: /glfm-color-chip/ },
  { name: "non-color code untouched", md: "Not `#define` here\n", expectText: /#define/, reject: /glfm-color-chip/ },
  { name: "color in a fenced block untouched", md: "```\n#f4511e\n```\n", expectText: /#f4511e/, reject: /glfm-color-chip/ },
  { name: "emoji", md: "Shipped :tada:\n", expect: /glfm-emoji/ },
  { name: "unknown emoji stays literal", md: "Nope :notarealone:\n", expectText: /:notarealone:/ },
  { name: "video link", md: "![clip](demo.mp4)\n", expect: /<a[^>]*glfm-media-video[^>]*href="demo\.mp4"/, expectText: /clip/ },
  { name: "audio link", md: "![sound](note.mp3)\n", expect: /<a[^>]*glfm-media-audio[^>]*href="note\.mp3"/, expectText: /sound/ },
  { name: "image untouched", md: "![pic](x.png)\n", expect: /<img[^>]+src="x\.png"/ },
  { name: "issue ref", md: "See #123 today\n", expect: /href="https:\/\/gitlab\.com\/acme\/widgets\/-\/issues\/123"/ },
  { name: "MR ref", md: "See !45 today\n", expect: /merge_requests\/45/ },
  { name: "snippet ref", md: "See $6 today\n", expect: /snippets\/6/ },
  { name: "milestone number ref", md: "See %7 today\n", expect: /milestones\/7/ },
  { name: "milestone quoted ref", md: 'See %"Q3 Launch" today\n', expect: /\/-\/milestones"/ },
  { name: "epic ref", md: "See &8 today\n", expect: /groups\/acme\/-\/epics\/8/ },
  // Epics are numbered per group, so a subgroup project must not resolve them
  // against the top-level group - that is a different group's epic.
  {
    name: "epic ref uses the project's own group",
    md: "See &8 today\n",
    config: { projectUrl: "https://gitlab.com/group/sub/project", instanceUrl: "https://gitlab.com" },
    expect: /href="https:\/\/gitlab\.com\/groups\/group\/sub\/-\/epics\/8"/
  },
  { name: "label ref", md: "See ~backend today\n", expect: /label_name\[]=backend/ },
  { name: "scoped label ref", md: 'See ~"needs review" today\n', expect: /label_name\[]=needs%20review/ },
  { name: "user ref", md: "See @someone today\n", expect: /href="https:\/\/gitlab\.com\/someone"/ },
  { name: "cross-project ref", md: "See group/other#99 today\n", expect: /gitlab\.com\/group\/other\/-\/issues\/99/ },
  { name: "refs inside code not linkified", md: "Literal `#12345` and `@someone`\n", reject: /glfm-reference|glfm-mention/ },
  { name: "email not linkified", md: "Mail me at a@b.com now\n", reject: /glfm-mention/ },
  { name: "heading keeps existing id", md: "", html: '<h2 id="platform-anchor">Title</h2>', expect: /id="platform-anchor"/ },
  { name: "footnote definition is hidden, not dropped", md: "Text[^1].\n\n[^1]: Def here.\n", expect: /glfm-footnote-definition/ },
  { name: "unreferenced footnote definition stays visible", md: "[^1]: Def here.\n", expectText: /Def here/, reject: /glfm-footnote-definition/ },
  { name: "footnote definition the parser reads as a link", md: "Text[^1].\n\n[^1]: one\n", expect: /glfm-footnote-ref[\s\S]*glfm-footnotes[\s\S]*one/, reject: /href="one"/ },
  { name: "references render inside details", md: "::: details Title\n\nSee #123 and :tada: and {+add+}\n\n:::\n", expect: /glfm-reference[\s\S]*glfm-emoji[\s\S]*glfm-addition/ },
  { name: "references render inside a multiline blockquote", md: ">>>\nSee #123 here\n\nmore\n>>>\n", expect: /glfm-multiline-quote[\s\S]*glfm-reference/ },
  { name: "content after a raw details block survives", md: "::: details A\nbody\n:::\nTRAILING TEXT\n", expect: /glfm-details-raw/, expectText: /TRAILING TEXT/ },
  { name: "adjacent raw details blocks both fold", md: "::: details A\nfirst\n:::\n::: details B\nsecond\n:::\n", expect: /<summary>A<\/summary>[\s\S]*<summary>B<\/summary>/, expectText: /first[\s\S]*second/ },
  { name: "nested details fold at the matching marker", md: "::: details Outer\n\n::: details Inner\n\ninner body\n\n:::\n\n:::\n", expect: /<summary>Outer<\/summary>[\s\S]*<summary>Inner<\/summary>/, expectText: /^((?!:::).)*$/s },
  { name: "invalid colour value gets no chip", md: "Color `rgb(zzz)`\n", expectText: /rgb\(zzz\)/, reject: /glfm-color-chip/ },
  { name: "heading anchor rendered", md: "# Title here\n", expect: /<a[^>]*glfm-heading-anchor[^>]*href="#title-here"/ },
  { name: "heading anchor stays out of the table of contents", md: "# One\n\n[[_TOC_]]\n\n## Two\n", expect: /glfm-toc-link[^>]*>Two</ },
  // A match whose two ends sit either side of a skipped element is declined:
  // replacing it would delete the element, and the join can invent a match the
  // source never contained.
  { name: "diff spanning a link wraps it rather than deleting it", md: "Removed {-see [the docs](https://example.com) here-} today\n", expect: [/glfm-deletion[\s\S]*href="https:\/\/example\.com"/], expectText: /the docs/ },
  { name: "reference spanning a code span is not invented", md: "See #1`x`23 end\n", expect: /<code[^>]*>(<span[^>]*>)?x/, reject: /glfm-reference|issues\/123/ },
  { name: "diff not spanning anything still renders", md: "was {-old-} now {+new+}\n", expect: /glfm-deletion[\s\S]*glfm-addition/ },
  { name: "prototype keys are not emoji", md: "A :constructor: and :toString: here\n", expectText: /:constructor:[\s\S]*:toString:/, reject: /glfm-emoji/ },
  { name: "label stops before sentence punctuation", md: "Fixed in ~backend. Also done\n", expect: /label_name\[]=backend"/, expectText: /backend\. Also/ },
  { name: "dotted label name survives", md: "See ~v1.2 today\n", expect: /label_name\[]=v1\.2"/ },
  // An inline construct delimits content the author wrote, so the markup inside
  // it survives - and the passes that follow still see what it holds.
  { name: "diff keeps bold inside it", md: "was {-old **bold** text-} now\n", expect: /glfm-deletion[^>]*>(<span[^>]*>[^<]*<\/span>)?[\s\S]*<strong/ },
  { name: "diff keeps a link inside it", md: "was {+see [docs](https://example.com)+} now\n", expect: /glfm-addition[\s\S]*href="https:\/\/example\.com"/ },
  { name: "diff keeps a code span inside it", md: "was {-a `x` b-} now\n", expect: /glfm-deletion[\s\S]*<code/ },
  { name: "reference inside a diff is linked", md: "was {+see #123+} now\n", expect: /glfm-addition[\s\S]*glfm-reference[^>]*issues\/123/ },
  { name: "footnote definitions in one paragraph keep their markup", md: "A[^1] B[^2].\n\n[^1]: **first** one\n[^2]: see [docs](https://example.com)\n", expect: /<li id="glfm-fn-1">[\s\S]*<strong[\s\S]*<li id="glfm-fn-2">[\s\S]*href="https:\/\/example\.com"/ },
  { name: "footnote continuation line keeps its markup", md: "A[^1].\n\n[^1]: first line\n  continued **here**\n", expect: /glfm-footnotes[\s\S]*<strong/, expectText: /first line\s+continued\s+here/ },
  // An inline link that merely reads like a reference is told apart by its
  // source span, which is longer than the reference itself.
  { name: "inline link shaped like a footnote ref is left alone", md: "See [^1](https://example.com) here\n", expect: /href="https:\/\/example\.com"/, reject: /glfm-footnote-ref|glfm-footnotes/ },
  { name: "footnote definition keeps its inline markup", md: "Text[^1].\n\n[^1]: see **this** thing\n", expect: /glfm-footnotes[\s\S]*<strong/ },
  { name: "footnote definition keeps a link", md: "Text[^1].\n\n[^1]: see [the docs](https://example.com)\n", expect: /glfm-footnotes[\s\S]*href="https:\/\/example\.com"/ },
  // Replacement runs backwards through each block, so the numbering has to be
  // taken in a separate document-order pass.
  { name: "footnotes in one paragraph are numbered forwards", md: "A[^1] B[^2].\n\n[^1]: first\n[^2]: second\n", expect: /id="glfm-fnref-1"[^>]*>1<[\s\S]*id="glfm-fnref-2"[^>]*>2</ },
  { name: "footnote numbering follows first use", md: "Ref[^b] then[^a] then[^b].\n\n[^a]: alpha\n[^b]: beta\n", expect: /<li id="glfm-fn-b">beta[\s\S]*<li id="glfm-fn-a">alpha/ },
  { name: "unreferenced definition still gets its own rendering", md: "[^1]: unused :tada: definition\n", expect: /glfm-emoji/, reject: /glfm-footnote-definition/ },
  {
    name: "docs/glfm-sample.md renders every construct",
    md: SAMPLE,
    expect: [
      /glfm-toc/, /glfm-details/, /glfm-details-raw/, /glfm-multiline-quote/,
      /glfm-addition/, /glfm-deletion/, /glfm-color-chip/, /glfm-emoji/,
      /glfm-task-inapplicable/, /glfm-media-video/, /glfm-media-audio/,
      /glfm-footnotes/, /glfm-footnote-ref/, /glfm-reference/, /glfm-mention/,
      /glfm-label/, /glfm-heading-anchor/,
      // The nested block closes against its own marker, not the first one seen.
      /<summary>Outer block<\/summary>[\s\S]*<summary>Inner block<\/summary>/
    ],
    expectText: [
      // "Must stay literal" - each of these has to survive untouched.
      /:notarealemoji:/, /\[\^ghost]/, /someone@example\.com/, /C# and F#/,
      /::: details This one never closes/,
      // A definition nothing references is shown rather than silently hidden.
      /Nothing points at this one/
    ],
    reject: [
      // No stray fold marker escaped into the rendered output.
      /<p[^>]*>\s*:::\s*<\/p>/,
      // The permalink glyph must not have been read as heading text.
      /glfm-toc-link[^>]*>[^<]*\u00B6/
    ]
  }
];

// Every case runs in each of these shapes.
const MODES = [
  // The parser's own output.
  { label: "plain", split: false },
  // Words wrapped in `<span md-src-pos=...>`, as the preview does for scroll
  // sync: an inline construct is then split across several text nodes.
  { label: "split (preview scroll-sync markup)", split: true },
  // The preview keeps running the pipeline over the DOM its own last pass
  // wrote, so every transformation has to be idempotent.
  { label: "plain, pipeline run twice", split: false, passes: 2 },
  // The path production actually takes: incremental-dom notifies after every
  // patch, so the MutationObserver fallback never runs there.
  { label: "incremental-dom (production render path)", split: true, incrementalDom: true, patches: 3 },
  // An edit re-renders the document over the plugin's own output.
  { label: "incremental-dom, document re-rendered", split: true, incrementalDom: true, rerender: true }
];

/** A case states one pattern, or a list of them when it covers a whole document. */
function patterns(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function verdict(testCase, mode, output) {
  // Without this the incremental-dom modes would pass while silently testing
  // nothing: an unregistered listener means no patch was ever delivered.
  if (mode.incrementalDom && output.patchListeners === 0) return "no afterPatch listener registered";

  const missing = patterns(testCase.expect).find(function (p) { return !p.test(output.html); });
  if (missing) return `expected ${missing}`;

  const missingText = patterns(testCase.expectText).find(function (p) { return !p.test(output.text); });
  if (missingText) return `expected text ${missingText}`;

  const unwanted = patterns(testCase.reject).find(function (p) { return p.test(output.html); });
  if (unwanted) return `unexpected ${unwanted}`;

  if (output.errors.length > 0) return `console error: ${output.errors[0].split("\n")[0]}`;
  return null;
}

async function runCase(testCase, mode) {
  const body = testCase.html !== undefined ? testCase.html : renderMarkdown(testCase.md);
  const output = await transform(body, { ...mode, config: testCase.config });
  const failure = verdict(testCase, mode, output);

  console.log(`${failure ? "FAIL  " : "  ok  "} ${testCase.name}`);
  if (failure) console.log(`        ${failure}\n        got: ${output.html.slice(0, 240)}`);
  return failure === null;
}

async function main() {
  let failed = 0;
  let total = 0;

  for (const mode of MODES) {
    console.log(`\n--- ${mode.label} markup ---`);
    for (const testCase of cases) {
      total++;
      try {
        if (!await runCase(testCase, mode)) failed++;
      } catch (error) {
        console.log(`ERROR ${testCase.name}: ${error.message.split("\n")[0]}`);
        failed++;
      }
    }
  }

  console.log(`\n${total - failed}/${total} passed`);
  // Without this the suite is advisory: `npm test` - and so the `previewTest`
  // Gradle task wired into `check` - would exit 0 with any number of failures.
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
