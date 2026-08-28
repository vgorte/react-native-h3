# README structure

The canonical skeleton for the published README, in order. Loaded by the `readme-style` skill. Each section below names what it contains and what it must not absorb from its neighbours.

## Section order

1. Header block (no markdown heading): logo, title, tagline, badges.
2. Intro: two or three bullets, or one short paragraph.
3. `## Features`
4. `## Benchmark`
5. `## Installation`
6. `## Usage`
7. Up to two package-specific sections, if the package genuinely has a behavior a caller must know before the first call.
8. `## API`
9. `## Migrating from h3-js`
10. `## Requirements`
11. `## Contributing`
12. `## License`

## 1. Header block

Centred raw HTML (`<div align="center">`), in this order: logo, `<h1>` title, one-line tagline, badge row. Nothing else goes above the intro.

- **Logo**: an `<img>` whose `src` is the repository-relative path of the file in `img/`, for example `img/logo.svg`. The root README is a symlink, so GitHub resolves the path against the repository root, and npm rewrites it to the repository's raw URL via the `repository` field. Never an absolute `raw.githubusercontent.com` URL: a private repository serves those only with a token.
- **Title**: the display name in an `<h1>`, not the npm package name if the two differ.
- **Tagline**: one line that states what the package is and why it exists, in that order. It carries the motivation, so there is no `## Why` section anywhere in the file.
- **Badges**: npm version, license, CI status, and a platforms badge. Skip social, sponsor and follower badges. Badges backed by the GitHub API stay blank while the repository is private, so keep the markup and re-check the rendered row right after the repository becomes public.
- **Absolute URLs are a hard rule for the whole file**, not only the header: every image, every badge, every link. This is what keeps the GitHub render, the npm page and any package directory showing the same document.

## 2. Intro

Two or three bullets, or one paragraph of at most three sentences: what H3 is, what this package binds, and what a reader gets that `h3-js` does not give them. No heading.

## 3. Features

Six to ten flat bullets, bold lead phrase per bullet, no table. Every bullet is a fact the reader can verify from the package: full API parity with `h3-js`, synchronous calls with async variants for the expensive operations, `bigint` cell indexes, iOS and Android, MIT license. Adjectives that no bullet elsewhere backs with a number do not belong here, and neither does the headline benchmark figure, which has its own section.

## 4. Benchmark

Four parts, in this order: the chart image (absolute raw URL to `img/benchmark.svg`), one headline figure as a single bold line, a table of at most four rows taken from the same data, and one provenance sentence. The provenance sentence names the device, the OS version, both library versions and the date of the run. Close with a link to `docs/benchmark.md` for the methodology, the full row set and the reproduction steps. Nothing here is a figure that `docs/benchmark.md` does not also carry.

## 5. Installation

Two fenced `sh` blocks, React Native first, Expo second:

```sh
npm install react-native-h3 react-native-nitro-modules
cd ios && pod install
```

```sh
npx expo install react-native-h3 react-native-nitro-modules
npx expo prebuild
```

Then one short paragraph of peer requirements: the `react-native-nitro-modules` range from `peerDependencies`, the New Architecture requirement, and the minimum iOS and Android versions as they stand in `NitroH3.podspec` and `android/build.gradle`. No configuration dump, no per-platform troubleshooting; those go to `docs/`.

## 6. Usage

The smallest complete example: one fenced `ts` block including the imports, doing one real thing end to end. It has to run as pasted. One sentence after it, and a link to the example app. No feature tour, no second and third snippet showing variations.

## 7. Package-specific sections

Two at most, each under a `##` heading named for the behavior it describes, each under a screen. They exist only for something a caller hits on the way to a correct first call and cannot discover from the type signatures: an error model, a limit that makes a call throw, an async variant with different semantics. Everything else that feels important is documentation, not README: it goes to `docs/` with a link from `## API`.

## 8. API

A pointer, not a dump. One or two sentences stating that the exported surface mirrors `h3-js`, plus links to `docs/h3-function-table.md` and to the typed exports. Never list function signatures here; the table is generated and the README goes stale against it.

## 9. Migrating from h3-js

The positioning section, and the reason it sits above `## Requirements` rather than at the end. Three things: what changes at the import line, what differs in practice (cell indexes as `bigint`, the async variants, error types), and what does not change. A small differences table is appropriate here, which is the one place a table beats bullets.

## 10. Requirements

One small table: platform, minimum version, notes. Rows for iOS and Android, with the numbers read from `NitroH3.podspec` and `android/build.gradle` rather than remembered, plus rows or notes for the React Native and `react-native-nitro-modules` ranges. The New Architecture requirement belongs in the notes column. A short versioning statement (which part of the version number tracks the vendored H3 release) may follow the table as two or three sentences, not as its own section.

## 11. Contributing

One or two lines pointing at `CONTRIBUTING.md` and the development setup page under `docs/`. Never inline the contribution flow, the build steps or a walkthrough of how to add an operation; if those pages do not exist yet, write them before this section links to them.

## 12. License

One line naming MIT, plus one sentence naming the license of the vendored H3 sources under `third_party/h3`. This is the last section in the file.

## Sections that do not exist

No `## Why` heading (the tagline carries it), no changelog, no roadmap, no sponsors or agency block, no features table, no badge wall of individual CI workflows, no acknowledgements section beyond the one license sentence.
