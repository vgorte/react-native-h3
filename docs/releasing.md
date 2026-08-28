# Releasing

One command, `bun release <version>`, and it is dispatched from CI rather than run by hand.
Everything below is what has to be true before that, and how to rehearse it locally without writing
anything.

The workspace splits the work in two. The package publishes itself to npm and does nothing else; the
root owns the version bump commit, the tag, the changelog and the GitHub release. The version is
passed explicitly because both halves would otherwise compute an increment of their own, and only an
explicit argument guarantees that the tarball on npm and the tag on GitHub carry the same number.

## Before the release

1. `main` is green. Seven workflows run on every push to `main`: `CI`, `Nitrogen drift`,
   `Lint C++`, `C++ tests`, `Parity`, `Build Android` and `Harness Android`. Five of them carry
   path filters, but those apply to pull requests only, so the last push to `main` reports all
   seven.

2. Run the iOS checks no workflow covers. There are no macOS jobs, so these are the only proof that
   iOS still builds and still runs the harness suite clean:

   ```sh
   scripts/device-ios.sh default
   scripts/device-ios.sh asan
   scripts/device-ios.sh tsan
   scripts/build-ios-variants.sh
   ```

   The three device runs use the `iPhone 17 Pro` simulator on iOS 26.5. `build-ios-variants.sh`
   builds the example app twice, with static frameworks on and off, because a podspec that only
   works one way is a failure a consumer discovers and the maintainer does not. It refuses to start
   while `apps/example/ios` has uncommitted changes, because it restores that directory with a hard
   `git checkout` at the end.

   Each run keeps its own derived-data tree under `apps/example/ios/build`, which is roughly 1.5 GB
   per sanitizer flavor and 0.8 GB per framework variant, about 6 GB once all five have run. Delete
   the directory when the release is out.

3. Regenerate the benchmark if any of the numbers could have moved. CI does not produce these
   figures and cannot.

   1. Build `apps/example` in **Release** on the `iPhone 17 Pro` simulator (iOS 26.5) or on the
      `afterglow_pixel` emulator, never on a physical device. A Debug build is several times slower
      on the native side and its numbers are not comparable with the `h3-js` column measured beside
      them.
   2. Open the Benchmark tab and press `Run benchmark`. The run takes about 171 seconds and the app
      is unresponsive throughout, because `h3-js` alone needs roughly 20 seconds for each of its
      `W3` passes.
   3. Check the caption before going further. A run marked `Debug`, or carrying a
      `RESULTS DIFFER FROM h3-js` warning, is not publishable.
   4. Collect the payload from the log. It arrives as lines of the form
      `BENCHMARK_JSON <i>/<total> |<chunk>|`, 700 characters per chunk, because the iOS unified log
      truncates a long message. On iOS in Release the lines are only visible at debug level:

      ```sh
      xcrun simctl spawn booted log stream --level debug \
        --predicate 'eventMessage CONTAINS "BENCHMARK_JSON"'
      ```

      On the emulator the same lines come out of `adb logcat`. Take the text between the bars, in
      the order the numbering gives, and concatenate it with nothing in between. The bars pin both
      edges because the log trims outer whitespace.
   5. Save the result as `apps/example/benchmark.json`, pretty-printed with two spaces.
   6. Run `bun run benchmark:svg`. It validates the JSON, rewrites `img/benchmark.svg` and prints
      one line beginning `HEADLINE`.
   7. Paste that headline figure into the Benchmark section of `packages/react-native-h3/README.md`,
      update the three published rows and the sentence naming the platform, the OS version and the
      build type, then update the table and the conditions in `docs/benchmark.md` from the same
      file.

   [docs/benchmark.md](https://github.com/vgorte/react-native-h3/blob/main/docs/benchmark.md) holds
   the method behind those numbers.

4. The generated documents match their sources:

   ```sh
   bun run docs:api --check   # packages/react-native-h3/docs/api.md is up to date
   bun run icons --check      # 17 app icons match img/logo.svg
   bun run vendor:h3 --check  # third_party/h3 matches upstream v4.5.0
   ```

   If the vendored H3 version changed, say so in the release notes and name
   `third_party/h3/H3_VERSION`.

5. The tarball carries everything a consumer's native build needs:

   ```sh
   bun run build
   cd packages/react-native-h3 && npm pack --dry-run
   ```

   The `prepack` guard runs first and prints `Pack list OK: 215 files`, then npm lists every file
   it would put in the tarball. `bun run build` comes first because `lib/` is build output and is
   not in git, so the guard reports `lib/index.js` and `lib/index.d.ts` as missing without it. If
   it still reports them after a build, delete
   `packages/react-native-h3/tsconfig.tsbuildinfo` and build again: the compiler is incremental and
   considers an emit it has already recorded to be done.

## Rehearsing

```sh
bun install
bun run build
bun release --dry-run --ci
```

The verification gate runs first, in full: install, lint, typecheck, build, specs, the host test
suite, then the parity probe is compiled and the parity suite is run against it. The two release-it
invocations follow, and neither writes: the package prints the version and the `npm publish` it
would perform, and the root prints the changelog it would generate from the conventional commits,
the bump commit, the tag and the GitHub release it would create.

Without an npm login the run stops at `Not authenticated with npm`, which is release-it's
`npm whoami` pre-flight check and not a property of the release. To rehearse past it:

```sh
bun release --dry-run --ci --npm.skipChecks
```

That is the same option the trusted publishing route sets permanently, because under OIDC there is
no identity to report until the publish itself exchanges the token.

Three things the output does not show. release-it does not echo what `npm publish --dry-run` prints,
so the pack list comes from step 5 above rather than from here. Hooks are listed but not executed in
a dry run, which is why the root hook's `pod install` does not touch `apps/example/ios`. And
`Writing changelog to undefined` is expected: no changelog file is kept in the repository, the entry
goes into the GitHub release body.

Confirm afterwards that nothing was written:

```sh
git status --short
git tag --list
```

## What `bun release <version>` does

`bun release` is `scripts/release.sh`. It runs the verification gate first, before anything is
published, because the root release-it's own `before:release` hook would fire after the tarball is
already on npm. The gate compiles the parity probe and sets `H3_PARITY_REQUIRED`, since the parity
suite skips itself when the probe is missing and a gate that skips is not a gate.

It then releases each package in `packages/`, which is npm publish only with no git operations, and
finally runs the root release-it, which owns the version bump commit, the tag, the changelog and the
GitHub release. The root run also bumps the version in `packages/react-native-h3/package.json` and
`apps/example/package.json`, refreshes both lockfiles and stages them.

## Publishing

`bun release` is never run against npm from a laptop. The `Release` workflow is dispatched by hand
from the Actions tab with the version as its input, and it is the only thing that publishes, because
provenance attestations are produced only by a supported CI runner and only for a public repository.
That workflow arrives with the first public release; until then `bun release --dry-run --ci` is the
only invocation there is.

## After the first public release

- Verify the README on GitHub and on npm. The logo, the benchmark chart and the badges are absolute
  `raw.githubusercontent.com` and `shields.io` URLs, and a private repository serves none of them.
  The npm version badge stays blank until the package exists on the registry.
- Add the iOS workflows. An iOS harness workflow covering the three flavors of
  `scripts/device-ios.sh`, and a build workflow covering the two framework variants, are absent by
  decision: macOS runner minutes bill at ten times the Linux rate on a private repository, which is
  what step 2 above replaces. Once the repository is public and the minutes are free, adding both is
  the first CI task.
- Add the branch ruleset on `main`. There is none while the repository is private, and a public
  repository without one is a repository anyone with write access can force-push.
