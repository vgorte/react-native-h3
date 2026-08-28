---
name: readme-style
description: House style for the published README of react-native-h3 and the user-facing pages under docs/. Covers section order, the header block, how a benchmark is presented, and the prose rules for claims and numbers. Use whenever writing, extending or reviewing user-facing documentation in this repository.
---

# README style

The README is the package page on GitHub and on npm at once. `README.md` in the repository root is a symlink to `packages/react-native-h3/README.md`, so a single file has to render correctly from two paths in the repository and from the registry, where nothing repository-relative resolves.

`references/structure.md` holds the canonical skeleton: which sections exist, in which order, and what belongs in each. `references/writing-style.md` holds the sentence-level and claim-level rules. This skill only says when and how to apply them.

## Workflow

1. Read `references/structure.md` and `references/writing-style.md` in full before writing or reviewing README prose.
2. Follow the skeleton. Add a section only when it carries something the reader acts on, and drop a section rather than filling it with placeholder text.
3. Anchor every claim to something checkable in the repository: a version in `package.json`, a workflow under `.github/workflows/`, a figure in `docs/benchmark.md`. A claim with no anchor gets cut, not softened.
4. Keep the file under roughly 250 lines. When a section outgrows that, move the detail to a page under `docs/` and leave one sentence and a link behind.
5. When a source of README text (a draft, an existing section, another package's README) disagrees with the style, keep the substance and rewrite the wording. Never change behavior to match a sentence that is already written.
6. Before committing, run the checklist below over the rendered file, not only over the diff.

## Checklist

1. Every image and every link is an absolute `https://` URL, so the file renders the same from the repository root, from `packages/react-native-h3/`, and on npm.
2. Section order and heading names match `references/structure.md`; no section is empty.
3. Install commands are copy-pasteable as written, and the package names and version ranges match `packages/react-native-h3/package.json`.
4. Every number carries its measurement conditions, and every claim of speed, size or compatibility carries a version or a date.
5. No claim describes behavior that no test or workflow checks.
6. Identifiers, commands, file paths and versions are in backticks; no bare identifiers in prose.
7. No em dash, no emoji in a heading, no first person plural, no announcement voice.
8. Every code block has a language tag and compiles or runs as written.
9. Every link resolves, including links into `docs/` and anchors within the file.
10. Nothing references internal planning, roadmaps or unreleased work.
11. The file is under roughly 250 lines.

## Decided deviations (2026-08-28)

Settled over the published README and binding for this repository wherever they contradict the rules above.

- Every `##` section heading starts with an emoji, and a `###` heading may.
- The section set is the one the README carries today, including `Error Handling` and a standalone `Versioning Strategy` section.
- A length of about 320 lines is accepted; the roughly 250 line target is a direction, not a limit.
- The install block leads with bun and names npm and yarn only in a parenthesis.
- The closing of `Contributing` may address the reader warmly and in the first person plural.

## Scope

Applies to `packages/react-native-h3/README.md` and its root symlink, to the pages under `docs/` that a package user reads, and to any release notes published with the package. Vendored documents under `third_party/` and generated output under `nitrogen/generated/` are never edited for style.
