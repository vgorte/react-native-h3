# Vendored agent skills

Source: https://github.com/margelo/react-native-skills (commit pinned below, cloned 2026-08-26).
Only the three skills relevant to this package were vendored:

- `build-nitro-modules` - Nitrogen codegen, HybridObject specs, C++/Swift/Kotlin implementation, publishing
- `cpp` - modern C++ API and ownership guidance for Nitro-backed implementations
- `api-design` - public TypeScript API shape for RN libraries

Not vendored: `swift`, `kotlin` (this package is pure C++ over Nitro, no platform glue expected),
and the per-library skills `react-native-mmkv`, `react-native-nitro-fetch`,
`react-native-vision-camera`, `react-native-vision-camera-realtime` (about consuming those
libraries, not about building this one).

Upstream declares MIT in the `build-nitro-modules` frontmatter; the repository itself carries no
LICENSE file. Re-check before redistributing.

To update: `npx skills add margelo/react-native-skills`, or re-copy from a fresh clone.
Upstream commit: 1e9e17be6f41c838db472d6a4b943fc26355a3be
