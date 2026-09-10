# Getting set up

Everything you need to run Widgets locally. If something here is wrong, open an
issue with ~documentation and assign @dpham.

[[_TOC_]]

## Before you start

You need Docker, Ruby 3.4 and Node 22. The versions matter: the lockfiles are
committed and CI runs exactly these.

::: details Why the versions are pinned this tightly

The import path uses a native extension that is compiled against the Ruby ABI.
A different minor version links, then segfaults under load rather than at boot,
which is a genuinely unpleasant afternoon.

:::

## Install

::: details Linux and WSL

```sh
bin/setup
bin/dev
```

`bin/setup` is idempotent — run it again after pulling.

:::

::: details macOS (Apple silicon)

The Postgres extension has no arm64 build in the upstream tap yet:

```sh
arch -x86_64 brew install pgvector
bin/setup
```

Tracked in #874 :hourglass:

:::

## First run

The seed data is a trimmed anonymised catalogue — about 4,000 widgets, enough
that pagination and search behave like production.

```sh
bin/rails db:seed
open http://localhost:3000
```

Sign in as `dev@example.com` with password `password`. The account is an admin,
so you will see the theme editor as well.

>>>
Do not point a local checkout at the shared staging database.

It is restored from production nightly, so a stray `db:seed` there wipes real
tenant data — and the restore takes about six hours. Local Postgres only.
>>>

![Tour of the local admin](local-admin-tour.mp4)

## Theme tokens

The admin theme is defined in `app/assets/tokens.css`. The three you will touch
most:

- `#1f2a44` — header and nav background
- `rgb(217, 119, 6)` — accent, used for primary actions
- `hsl(215, 16%, 47%)` — muted text

Contrast is checked in CI, so a token change that drops below 4.5:1 fails the
build rather than shipping.

## Working on an issue

Branch from `main`, name the branch after the issue, and open the merge request
early — CI on a draft is how you find out the import specs hate you.

- [x] Read this page
- [x] `bin/setup` finishes without errors
- [ ] Pick something from ~"good first issue"
- [~] Request production access — not needed for local work, and not granted
      until after the security training

Reviewers are assigned automatically from `CODEOWNERS`. If nobody has looked
after a day, say so in the merge request rather than direct-messaging: the
rotation is public and someone is on it.

## Where things live

Architecture notes are in &7. The deployment pipeline is documented in
acme/platform#4102, and the import format has its own spec in $91.[^spec]

[^spec]: The spec is a snippet rather than a file in the repository because two
    other services consume it and neither should be vendoring our docs.
