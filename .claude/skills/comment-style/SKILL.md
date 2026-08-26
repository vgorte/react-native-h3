---
name: comment-style
description: House style for code comments in react-native-h3 (TypeScript, C++, podspec, CMake, Gradle). Use whenever writing or editing any comment, doc comment, file header or TODO in this repository, and when reviewing comments for style.
---

# Comment style

The writing style itself lives in `references/writing-style.md`. This skill only says when and how to apply it.

## Workflow

1. Read `references/writing-style.md` in full before writing or reviewing any comment.
2. When a source of comment text (a plan, a template, an existing file) disagrees with the style, keep the substance of the comment (the reason it exists) and rewrite the wording to the style. Never change code to fit a comment.
3. Before committing, scan the diff for comments only: headers present on every C++ file, no comment longer than three sentences, no bare identifiers in prose, no references to internal documents.
4. In review, style drift in comments is a finding like any other: cite file and line and the rule that is violated.

## Scope

Applies to every hand-written file in this repository. Generated files under `nitrogen/generated/` and vendored code under `third_party/` are never edited for style.
