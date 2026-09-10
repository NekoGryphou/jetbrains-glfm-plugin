# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- Table of contents entries show a heading as the preview renders it, so a
  heading's `:warning:` reaches the contents as the glyph and `{+text+}` loses
  its delimiters, instead of both being copied in as raw source.

## [0.1.0] - 2026-09-10

Initial release.

### Added

- Collapsible sections - `::: details Title`, nestable.
- Table of contents - `[[_TOC_]]` and `[TOC]`, nested from the headings.
- Footnotes - `[^1]`, with a back-linked list at the end.
- Multiline blockquotes - `>>>`.
- Inline diffs - `{+added+}` and `{-removed-}`, `[+ +]` and `[- -]`.
- Colour swatches for `#RGB`, `rgb()` and `hsl()` in inline code.
- Emoji shortcodes - `:tada:`.
- Inapplicable task items - `- [~]`.
- Links for audio and video embeds.
- Permalink anchors on headings, shown on hover.
- References to issues, merge requests, snippets, milestones, epics, labels and
  users, including cross-project ones, linked against the GitLab remote
  detected from the repository.
- Settings under **Languages & Frameworks → Markdown → GitLab Flavored
  Markdown**: a toggle per construct, and a project URL that overrides
  detection.

[Unreleased]: https://github.com/NekoGryphou/jetbrains-glfm-plugin/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/NekoGryphou/jetbrains-glfm-plugin/releases/tag/v0.1.0
