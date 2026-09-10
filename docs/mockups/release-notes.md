# Widgets 4.2

Released 2026-09-02 against %"4.2 — Autumn". Rollout owner: @dpham.

[[_TOC_]]

## Highlights

Bulk import streams instead of buffering the whole payload, so a 2 GB catalogue
no longer needs 2 GB of heap (!1184, closes #906). Thanks :tada: to @rsilva for
the flame graphs that found it.

![Streaming import walkthrough](import-stream.mp4)

The scheduler now picks jobs up in priority order (!1191). Anything queued
before the upgrade keeps its original position.

## Upgrade notes

::: details Config changes — read this before deploying

`widgets.yaml` gains a `stream:` block, and two keys move into it:

- {+`stream.chunk_bytes`+} — new, defaults to `8388608`
- {-`import.buffer_limit`-} — removed, ignored if still present
- `import.workers` is now {+`stream.workers`+}

The old names are accepted for one more minor release, with a deprecation
warning at boot.

:::

::: details Database migration — about 40 s on a 50 GB catalogue

Adds an index on `imports.priority`:

```sh
bundle exec rake db:migrate
```

Safe to run online. It takes a `SHARE UPDATE EXCLUSIVE` lock only, so writes
continue while it builds.

:::

## Fixed

- Import retries no longer double-count rows (#912, ~backend)
- Timezone drift in the weekly digest mail (#918, ~"needs review")
- Admin theme colours were a shade off: the header is `#1f2a44` again rather
  than `#1f2a4f`, and the accent stays `rgb(217, 119, 6)` (#921)
- Pagination cursor leaked across tenants — see the advisory in $84[^advisory]

## Still open

- [x] Flaky import spec, quarantined then fixed (!1195)
- [ ] Search relevance regressed for single-character queries (#930)
- [~] Windows packaging — not shipped this cycle, tracked under &12

## Rollout plan

>>>
Staged by region, one hour apart, starting 09:00 UTC.

Roll back with `helm rollback widgets 41` if the error rate passes 2%. The
migration is additive, so a rollback needs no down-migration — but re-running
the deploy afterwards will re-apply it.
>>>

The mirrored ops runbook lives in acme/platform#4471.

[^advisory]: Kept in a snippet rather than the repository because it quotes the
    affected tenant's logs verbatim.
