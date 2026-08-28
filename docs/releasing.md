# 🚀 Release Guide

Releasing `react-native-h3` is designed to be fully automated. A single command, dispatched from
CI, handles the entire process. Everything documented below outlines the pre-flight requirements,
how to safely rehearse a release locally, and how the internal pipeline works.

> **⚠️ Golden Rule:** Never run a live publish from your local machine. Releases are strictly
> dispatched from GitHub Actions to guarantee npm provenance attestations.

## 🏗️ Workspace Architecture

The workspace strictly splits release responsibilities into two halves. An explicit version number
must be passed (e.g., `bun release 1.0.0`) so both halves stay perfectly in sync without computing
increments independently.

- **The Package (`packages/react-native-h3`):** Strictly responsible for publishing the tarball to
  npm. It does absolutely no git operations.
- **The Root:** Strictly handles repository management. It owns the version bump commit, updates
  the package manifests and lockfiles, creates the git tag, generates the changelog, and creates
  the GitHub Release.

## 🚦 Pre-Flight Checklist

Before triggering a release, ensure all local and remote states are perfectly clean.

### 1. Verify CI is Green

The `main` branch must be completely green. Path filters apply to pull requests only, so the last
push to `main` reports the true status of all seven core workflows: `CI`, `Nitrogen drift`,
`Lint C++`, `C++ tests`, `Parity`, `Build Android`, and `Harness Android`.

### 2. Local iOS Validation (Pre-Public Repo)

Because macOS CI minutes are expensive on private repositories, iOS validation is currently run
locally prior to release.

Run the three device checks (targeting the `iPhone 17 Pro` simulator, iOS 26.5) to guarantee the
harness suite runs clean across all sanitizer flavors:

```sh
scripts/device-ios.sh default
scripts/device-ios.sh asan
scripts/device-ios.sh tsan
```

Next, verify framework linking. This builds the app twice (with static frameworks ON and OFF)
because a podspec that only works one way is a silent failure for consumers:

```sh
scripts/build-ios-variants.sh
```

> **Note:** `build-ios-variants.sh` refuses to start while `apps/example/ios` has uncommitted
> changes, because it restores that directory with a hard `git checkout` at the end.

> **🧹 Cleanup Tip:** Each run keeps its own derived-data tree under `apps/example/ios/build`
> (~1.5 GB per sanitizer flavor, ~0.8 GB per framework variant). Once the release is out, delete
> this directory to reclaim ~6 GB of space.

### 3. Regenerate Benchmarks (If required)

If performance characteristics might have shifted, regenerate the benchmarks. CI does not produce
these figures and cannot.

> **Hardware Rule:** Run strictly on a Simulator (`iPhone 17 Pro`, iOS 26.5) or Emulator
> (`afterglow_pixel`) in **Release** mode. Never use a physical device.

**Extracting logs:** Follow the steps in
[Regenerating the Benchmarks](https://github.com/vgorte/react-native-h3/blob/main/docs/benchmark.md#-regenerating-the-benchmarks).
On iOS in Release mode, the chunked payload is only visible at the debug level:

```sh
xcrun simctl spawn booted log stream --level debug \
  --predicate 'eventMessage CONTAINS "BENCHMARK_JSON"'
```

(On Android, use `adb logcat` to extract the payload.)

### 4. Verify Docs, Icons & Vendored C-Core

Ensure all generated assets match their source of truth:

```sh
bun run docs:api --check   # packages/react-native-h3/docs/api.md is up to date
bun run icons --check      # 17 app icons match img/logo.svg
bun run vendor:h3 --check  # third_party/h3 matches upstream v4.5.0
```

> **Note:** If the vendored H3 version changed, highlight this in the release notes and reference
> `packages/react-native-h3/third_party/h3/H3_VERSION`.

### 5. Dry-Run the Tarball

Verify that the published tarball contains exactly what a consumer's native build needs:

```sh
bun run build
cd packages/react-native-h3
npm pack --dry-run
```

The `prepack` guard runs first. Expect it to print `Pack list OK: 215 files` before npm lists the
simulated tarball contents.

> **🛠️ Troubleshooting `lib/` errors:** `lib/` contains build outputs ignored by git, which is why
> `bun run build` comes first. If the `prepack` guard still reports `lib/index.js` missing after a
> build, delete `packages/react-native-h3/tsconfig.tsbuildinfo` and build again to clear the
> incremental compiler cache.

## 🎭 Rehearsing a Release (Dry Run)

You can safely simulate the entire release process locally without writing a single tag or
publishing to npm.

```sh
bun install
bun run build
bun release --dry-run --ci
```

### 1. The Verification Gate

Before simulating the publish, the script strictly enforces the verification gate. It runs:
install, lint, typecheck, build, specs, and the TypeScript test suite. Finally, it compiles the
parity probe and executes the parity suite against it.

### 2. Simulated Outputs

Because this is a dry run, release-it modifies nothing.

- **The Package** prints the version and the `npm publish` command it would perform.
- **The Root** prints the changelog it would generate from conventional commits, along with the
  bump commit, tag, and GitHub Release details.

> **🔑 Bypassing the npm Auth Check:** If you are not logged into npm locally, the run will abort
> with `Not authenticated with npm` (release-it's `npm whoami` pre-flight check, not a property of
> the release). To rehearse past this, use:
>
> ```sh
> bun release --dry-run --ci --npm.skipChecks
> ```
>
> This is the same option the trusted publishing route sets permanently, because under OIDC there
> is no identity to report until the publish step exchanges the token.

### 3. Expected CLI Quirks

Do not be alarmed by these three omissions in the dry-run output:

- release-it does not echo what `npm publish --dry-run` prints (refer to Step 5 of the Pre-Flight
  Checklist for the pack list).
- Hooks are listed but not executed. Consequently, the root hook's `pod install` will not touch
  `apps/example/ios`.
- `Writing changelog to undefined` is expected behavior. The repository keeps no `CHANGELOG.md`
  file; the changelog goes directly into the GitHub Release body.

### 4. Post-Rehearsal Verification

Confirm that your repository remains pristine and no tags were created:

```sh
git status --short
git tag --list
```

## ⚙️ Under the Hood: What `bun release <version>` does

Underneath, `bun release` maps directly to `scripts/release.sh`. It executes the release in three
strict phases:

1. **The Verification Gate (Enforced Parity):** The gate runs before anything is published. (Relying
   on the root release-it's `before:release` hook would fire too late, after the tarball was already
   on npm.) The gate explicitly compiles the parity probe and exports
   `H3_PARITY_REQUIRED`. This guarantees the parity suite runs in strict mode and cannot silently
   skip itself if the probe is missing.
2. **Package Publishing (`packages/react-native-h3`):** Executes a pure `npm publish` for the
   package, strictly without any git operations.
3. **Root Finalization:** Runs the root release-it. This phase owns the version bump commit, the
   git tag, generating the changelog, and creating the GitHub Release. It also bumps the version in
   `packages/react-native-h3/package.json` and `apps/example/package.json`, refreshes both
   lockfiles, and stages them for the commit.

## 🚀 Publishing (Production Release)

> **🛑 Strict Policy:** `bun release` is never run against npm from a developer's laptop.

The production release is exclusively dispatched manually via the GitHub Actions tab (using the
`Release` workflow with the target version as its input).

**Why? npm Provenance.** Cryptographic provenance attestations are only produced by a supported CI
runner, and only for a public repository. Triggering the release via CI is the only way to
guarantee this supply-chain security.

> **Note:** The `Release` workflow arrives with the first public release. Until the repository is
> made public and that release happens, `bun release --dry-run --ci` remains the only valid way to
> run this script.

## 🌅 Post-Launch: The "First Public Release" Checklist

Once the repository is switched from Private to Public, these three tasks must be completed
immediately:

### 1. Verify Assets & Badges

Verify the README renders correctly on both GitHub and npm.

- The logo and the benchmark chart are absolute `raw.githubusercontent.com` URLs pointing at
  `main`, which a private repository serves only with a token; they render once the repository is
  public.
- The npm version and downloads badges (`shields.io`) report "package not found" until the first
  tarball is actually published to the registry.

### 2. Enable macOS / iOS CI Workflows

Currently, the iOS harness workflow (covering the three flavors of `scripts/device-ios.sh`) and the
build workflow (covering the two framework variants) are intentionally omitted from CI.

- **The Reason:** macOS runner minutes bill at 10× the Linux rate on private repositories.
- **The Action:** Once the repository is public, these minutes become free for open-source
  projects. Adding both workflows to the automated CI pipeline is the first CI task.

### 3. Enforce Branch Protection on `main`

Add a strict branch ruleset on `main`. While the repository is private, this isn't strictly
necessary, but a public repository without branch protection allows anyone with write access to
accidentally (or maliciously) force-push over the commit history.
