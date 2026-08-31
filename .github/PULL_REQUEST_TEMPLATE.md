## What changed

<!-- One or two sentences. The reasoning belongs in the commit message; this is the summary a reviewer reads first. -->

## Why

<!-- The problem this solves. Link the issue if there is one. -->

## Verification

<!-- Which gates you ran locally, and anything you could not run. CONTRIBUTING.md lists the full set under "Before opening a PR". -->

- [ ] `bun run lint`, `bun run typecheck`, `bun run build` and `bun test packages/react-native-nitro-h3/__tests__`
- [ ] Native code changed: host tests, `tests_asan`, `clang-format` and `bun run specs` with no nitrogen drift
- [ ] An H3 operation changed: `bun run docs:api --check`, plus `parity/corpus.ts` and `cpp/test/ParityProbe.cpp`
- [ ] Documentation follows the change (README, `docs/`, or the divergence guide)

<!-- Delete the lines that do not apply. -->
