# GitLab Flavored Markdown Preview

A JetBrains IDE plugin that teaches the built-in Markdown preview to render
[GitLab Flavored Markdown](https://docs.gitlab.com/user/markdown/).

## Requirements

A JetBrains IDE from 2025.2 onwards with the bundled Markdown plugin. Tested on
WebStorm 2026.2.1.

## Installation

Download the `.zip` from the [releases page][releases], then go to
**Settings → Plugins → Install Plugin from Disk…** and restart the IDE.

[releases]: https://github.com/NekoGryphou/jetbrains-glfm-plugin/releases

## What it renders

| GitLab syntax | Rendered as |
| --- | --- |
| `::: details Title` … `:::` | a collapsible section |
| `[[_TOC_]]`, `[TOC]` | a nested table of contents built from the headings |
| `[^1]` with `[^1]: text` | numbered footnotes, with a back-linked list at the end |
| `>>>` … `>>>` | one multiline blockquote |
| `{+added+}`, `{-removed-}` | inline diff highlighting (`[+ +]` and `[- -]` work too) |
| `` `#f00` ``, `` `rgb(1,2,3)` `` | a colour swatch inside the inline code |
| `:tada:` | the emoji |
| `- [~] item` | an "inapplicable" task item |
| `![clip](demo.mp4)` | a link to the audio or video (see [Known limits](#known-limits)) |
| `#123` `!45` `$6` `%7` `&8` | issue, merge request, snippet, milestone, epic |
| `%"Q3 Launch"` | milestone by name |
| `~backend`, `~"needs review"` | label, scoped label |
| `@someone` | user |
| `group/project#123` | cross-project reference |
| any heading | a permalink anchor, shown on hover |

## Settings

**Settings → Languages & Frameworks → Markdown → GitLab Flavored Markdown**

## Known limits

Audio and video will not play. The preview's Content Security Policy hardcodes
`media-src 'none'`, and a plugin can only add script and style sources, so a
`<video>` element would show up as a dead control strip. You get a link instead,
which at least beats the broken image you would see otherwise.

`::: details` wants blank lines around its body, the same as GitLab's own
documentation asks for. Without them CommonMark collapses the whole block into
a single paragraph and only the raw text survives. The plugin still renders that
case, with the line breaks kept.

`%"Milestone name"` links to the milestone list rather than to the milestone
itself, because resolving a title to an id would mean calling the API.

## When something does not render

The preview fails quietly. An unrendered construct looks the same whether the
feature is switched off, a script failed to load, or the syntax just did not
match. So the plugin writes one line to the browser console every time the
preview opens:

```
[glfm] active: transformDetails, … , transformReferences
  | missing modules: none | emoji entries: 258 | project URL: https://gitlab.com/acme/widgets
```

To read it, enable `ide.browser.jcef.contextMenu.devTools.enabled` in the
Registry (`Ctrl+Shift+A`, then "Registry"), right-click the preview and choose
**Open DevTools**.

A transform missing from `active` means its setting is off. A name under
`missing modules` means that script did not load. `emoji entries: 0` means the
emoji table is missing, so no shortcode can resolve. `project URL: (not set)`
means references stay literal until you configure one.

If a single construct throws, it is caught and reported on its own line, so
whatever comes after it still renders.

## Contributing

Architecture, build instructions and the test suites are in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[GPL-3.0](LICENSE).
