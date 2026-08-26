# Writing style for comments

The rules every comment in this repository follows, with examples. Loaded by the `comment-style` skill.

## Rules

1. **Doc comments on public API use `/** */` blocks**, one leading `*` per line, in TypeScript and C++ alike.
2. **Doc comments start with a verb** (`Returns`, `Creates`, `Represents`, `Finds`, `Removes`), third person present tense. Never "This function ...". One short summary sentence first; a blank `*` line separates it from any elaboration.
3. **Keep doc comments to two or three sentences.** No multi-paragraph rationale. If the reason for a design needs more than that, it belongs in a README or a commit message, not in the code.
4. **Internal comments are single-line `//`**, terse (usually under twelve words), and explain *why*, not *what*. Lowercase first letter unless the sentence starts with a type or proper noun. Do not narrate the next line.
5. **Comment density stays low.** Many files need no comments at all; good names carry the meaning. Comment only at public boundaries, non-obvious branches and workarounds.
6. **Wrap every identifier, type and literal in backticks** inside prose: `` `CellBuffer` ``, `` `nullptr` ``, `` `H3_NULL` ``, `` `true` ``.
7. **Full sentences end with a period**; short `//` fragments do not.
8. **TypeScript JSDoc uses tags freely**: `@param`, `@returns`, `@throws`, `@see`, `@example`, `@deprecated`, `@platform`. Cross-reference symbols with `{@linkcode Name}`. `@example` bodies are fenced with ```ts and contain only code.
9. **C++ doc comments use prose instead of `@param`/`@returns`.**
10. **Every C++ `.hpp` and `.cpp` file starts with an Xcode-style header**, and TypeScript files have no header:

    ```cpp
    //
    //  CellBuffer.hpp
    //  react-native-h3
    //
    //  Created by Viktor Gorte on 26.08.26.
    //
    ```

11. **Section dividers inside classes and interfaces are short, capitalized `//` lines without a period**: `// Properties`, `// Methods`, `// Indexing`, `// Traversal`.
12. **`.nitro.ts` spec files use plain `//` line comments above declarations, never `/** */`**: one or two short sentences on the codegen or C++ behavior the declaration triggers.
13. **TODOs are `// TODO: <sentence>`**, continuation lines aligned under the text. No `TODO(name)`, no ticket links.
14. **Lint suppressions carry a reason after a colon**: `// biome-ignore lint/rule: reason.` A bare `// @ts-expect-error` is fine when the reason is self-evident.
15. **Build files (podspec, CMake, Gradle) use `#` or `//` labels**: a short noun phrase above a block (`# Vendored H3 (C)`), and aligned trailing annotations on link targets (`ReactAndroid::jsi  # <-- RN: JSI`).
16. **No emoji, no jokes, no first person, no references to internal planning or design documents.** References to upstream sources are welcome when they are checkable by a reader (`algos.c:193`, a Nitro header, a documentation URL).

## Examples

TypeScript doc comment:

```ts
/**
 * Finds the cell containing the given coordinate at the given resolution.
 *
 * @param lat Latitude in degrees.
 * @param lng Longitude in degrees.
 * @param res Resolution, `0` to `15`.
 * @throws {@linkcode H3Error} if the resolution is out of range.
 */
```

C++ doc comment and internal comment:

```cpp
/**
 * Owns a zero-initialised block of H3 cell indexes and removes `H3_NULL` holes in place.
 * `gridDisk`, `gridRing` and `polygonToCells` require the buffer to arrive zero-filled
 * (`algos.c:193`), and pentagons leave holes anywhere in the output.
 */
class CellBuffer final {
  // ...
  // value-initialising new[] zeroes the block, which H3 requires
  cells_ = std::unique_ptr<uint64_t[]>(new uint64_t[static_cast<size_t>(capacity)]());
```

Spec file:

```ts
// `bigint` without signedness is a nitrogen error; cells are `UInt64`.
latLngToCell(lat: number, lng: number, res: number): UInt64
```
