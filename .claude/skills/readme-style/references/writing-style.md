# Writing style for user-facing documentation

The rules every sentence in the README and in the pages under `docs/` follows. Loaded by the `readme-style` skill. The skeleton those sentences fill lives in `structure.md`.

## Sentences

1. **Address the reader in the second person, or stay neutral.** "Install the package", "the package exposes", "cells arrive as `bigint`". Never the first person plural: no "we built", no "our bindings", no "let us look at".
2. **Present tense throughout.** The package does things now. Future tense signals unreleased work, which does not belong in a published README at all.
3. **Short declarative sentences, one claim each.** If a sentence needs a subordinate clause to stay true, it is usually two sentences.
4. **Lead with the fact, not the wind-up.** Cut "It is worth noting that", "Simply", "Basically", "As you can see", and every variant of "we are excited to announce".
5. **English throughout**, with one spelling convention held consistently across the file.
6. **Headings are short noun phrases**, capitalised as sentences: `## Installation`, `## Migrating from h3-js`. No questions, no verbs in the imperative, no trailing punctuation.

## Claims and numbers

7. **No marketing adjective without a number behind it.** "Fast", "blazing", "lightweight" and "seamless" are either followed by a measurement in the same sentence, or deleted. Native code being faster than JavaScript is not a claim; a measured factor on a named workload is.
8. **Every number carries its measurement conditions**: the workload, the device and OS, the versions of both libraries compared, and how the figure was reduced (median over N passes, not a best case). A number without its conditions is not a smaller claim, it is an unverifiable one.
9. **Every claim of speed, size or compatibility carries a version or a date.** "Matches `h3-js` 4.5.0", "measured on 2026-08-28", "requires `react-native-nitro-modules` 0.37 or newer". Bare "compatible with React Native" ages into a false statement.
10. **Nothing is promised that CI does not check.** Before writing that a platform is supported, an API is complete or a behavior holds, point at the workflow under `.github/workflows/` or the test that proves it. If nothing does, the sentence describes an intention, and intentions are not published.
11. **Comparisons name what is compared and at which version.** "Faster" alone is a direction, not a result.
12. **Numbers repeated in two places drift.** The README carries the headline figure and a short extract; the detailed page under `docs/` owns the full data, and both read off the same source file.

## Markup

13. **Wrap every identifier, command, file path, package name and version in backticks**: `` `latLngToCell` ``, `` `bigint` ``, `` `react-native-nitro-modules` ``, `` `img/benchmark.svg` ``.
14. **No em dashes.** Use a comma, a colon, parentheses, or two sentences.
15. **No emoji in headings.** Emoji in feature bullets are allowed only when every bullet in that list has one; a partial set reads as an unfinished edit.
16. **Every image and link is an absolute `https://` URL.** Repository-relative paths break on npm and in package directories, and they break in this repository specifically because the root `README.md` is a symlink into `packages/react-native-h3/`.
17. **Every fenced block carries a language tag** (`sh`, `ts`, `tsx`, `json`), and every code block runs or compiles as pasted, imports included.
18. **Bullets are flat and short**, one line each where possible. Nested bullets in a README mean the content belongs in `docs/`.
19. **Tables only where the content is genuinely tabular**: platform requirements, a benchmark extract, a migration differences list. Features are bullets, never a table.
20. **Blockquote callouts (`> [!NOTE]`, `> [!IMPORTANT]`) are rare**, at most one or two in the file, and only for something that changes what the reader does next.

## What the document does not carry

21. **No internal planning.** No phase names, no task numbers, no roadmap, no references to plan or design documents. References to upstream sources are welcome when a reader can check them: an H3 function name, an upstream issue, a documentation URL.
22. **No unreleased behavior.** If it is not in the published version, it is not in the README, not even hedged as "coming soon".
23. **No changelog and no migration history** beyond the one section on the library this package replaces. Version history lives in releases.
24. **Length is a constraint, not a target**: under roughly 250 lines. When a section grows past a screen, the detail moves to `docs/` and one sentence with a link stays behind.

## Examples

Claim without an anchor, and the rewrite:

```md
Blazing fast H3 bindings, dramatically faster than the JavaScript implementation.
```

```md
`polygonToCells` over San Francisco at resolution 12 runs 269x faster than `h3-js` 4.5.0:
76.1 ms against 20,444.3 ms, median of three timed passes, iOS 26.5 Release build,
2026-08-28. Full conditions in the benchmark page.
```

Compatibility sentence that ages, and the rewrite:

```md
Works with the latest React Native and all recent versions of Nitro.
```

```md
Requires the New Architecture, React Native 0.87.0 or newer, and
`react-native-nitro-modules` `^0.37.0`.
```

Feature bullets, at the right density:

```md
* **Full API parity** with `h3-js` 4.5.0, checked by a parity test suite over every exported function
* **Synchronous by default**, with async variants for `polygonToCells` and `gridDisk`
* **Cell indexes are `bigint`**, not strings, so no conversion on the hot path
* **iOS and Android**, New Architecture only
```
