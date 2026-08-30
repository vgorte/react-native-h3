# 🚀 Release Guide

Releasing `react-native-h3` is designed to be fully automated. A single command, dispatched from
CI, handles the entire process. Everything documented below outlines the pre-flight requirements,
how to safely rehearse a release locally, and how the internal pipeline works.

> **⚠️ Golden Rule:** Never run a live publish from your local machine. Releases are strictly
> dispatched from GitHub Actions to guarantee npm provenance attestations. The very first release
> is the single documented exception, and it is spelled out at the end of the Publishing section.

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

> **Hardware Rule:** The published payload comes from an Android **Release** build on a physical
> Samsung Galaxy S23. A run on a simulator or an emulator serves for comparison only and is not
> published; that holds until iOS figures are published in their own right.

**Extracting logs:** Follow the steps in
[Regenerating the Benchmarks](https://github.com/vgorte/react-native-h3/blob/main/docs/benchmark.md#-regenerating-the-benchmarks).
On Android, `adb logcat` prints the chunked payload:

```sh
adb logcat | grep BENCHMARK_JSON
```

On iOS in Release mode, the chunked payload is only visible at the debug level:

```sh
xcrun simctl spawn booted log stream --level debug \
  --predicate 'eventMessage CONTAINS "BENCHMARK_JSON"'
```

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

`lib/` contains build outputs ignored by git, which is why `bun run build` comes first.

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

- **The Package** prints the version and the `npm publish . --tag latest --dry-run --provenance`
  command it would perform.
- **The Root** prints the changelog it would generate from conventional commits, along with the
  bump commit, tag, and GitHub Release details.

> **🔑 No npm Login Required:** The package sets `npm.skipChecks` permanently, so release-it never
> runs its `npm whoami` pre-flight check. That option exists for the trusted publishing route,
> because under OIDC there is no identity to report until the publish step exchanges the token, and
> it has the welcome side effect that anyone can rehearse a release without an npm account.

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
   on the root release-it's `before:release` hook for this would fire too late, after the tarball
   was already on npm.) The gate explicitly compiles the parity probe and exports
   `H3_PARITY_REQUIRED`. This guarantees the parity suite runs in strict mode and cannot silently
   skip itself if the probe is missing. The root hook still runs its own
   `H3_PARITY_REQUIRED=1 bun run --cwd packages/react-native-h3 parity` afterwards, relying on
   `H3_PARITY_PROBE` already being exported by the gate; it is a cheap last check that the
   published code still matches h3-js, not a repeat of the full gate.
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

### The Two Jobs of `release.yml`

`Rehearse` runs on `ubuntu-latest`, `Publish` on `macos-latest` (its `after:bump` hook runs
`pod install` for the example app, and CocoaPods only ships on the macOS image). Exactly one of
them runs per dispatch, selected by the `dry_run` input (which defaults to checked).

- **`Rehearse`:** Executes `./scripts/release.sh --dry-run --ci`, which is precisely what the local
  `bun release --dry-run --ci` maps to. It needs no npm identity and no secret beyond the default
  `GITHUB_TOKEN`, so it is green on the private repository today. It additionally runs on every
  pull request that touches `release.yml`, `scripts/release.sh`, the root `package.json` or the
  package `package.json`, which are the four files that can silently break a release.
- **`Publish`:** Dispatch only, and never selected while `dry_run` is checked. Its first step runs
  before anything is checked out and refuses the run if `version` is not a `MAJOR.MINOR.PATCH`
  string, or if the dispatch ref is not `main`. It then checks out the full history (the
  conventional-changelog plugin reads back to the previous tag), commits as `github-actions[bot]`,
  installs Bun 1.3.14 and Node 22, and finally runs `bun release <version> --ci`. The job declares
  `environment: npm`, so a required reviewer can be added on the repository's Environments page
  without editing the workflow.

> **📦 Why Node 22 next to Bun?** Bun runs the gate, but it does not publish; `npm publish` does.
> Trusted publishing needs npm 11.5 or newer, so the job prints `npm --version` and upgrades npm
> when the runner image ships anything older.

### Setting Up Trusted Publishing

Authentication is npm Trusted Publishing. No `NPM_TOKEN` exists anywhere in this repository and
none is needed: the job's `id-token: write` permission is the entire credential. Configure the
counterpart once on npmjs.com:

1. Open the package page for `react-native-h3` and go to **Settings → Publishing access**.
2. Add a **GitHub Actions** trusted publisher.
3. Organization or repository owner: `vgorte`. Repository: `react-native-h3`. Workflow filename:
   `release.yml`. Set the environment field to `npm`, matching the job.

`--provenance` is passed explicitly through `npm.publishArgs` in
`packages/react-native-h3/package.json`, because release-it 21 has no provenance option of its own.
npm skips attestation generation entirely under `--dry-run`, so the flag stays inert during every
rehearsal, local ones included.

> **🥚 First Release (`v0.1.0`):** This is the single exception to the Golden Rule. A trusted
> publisher can only be configured on a package that already exists in the registry, so the very
> first tarball has to come from the maintainer's terminal:
>
> ```sh
> npm login
> bun release 0.1.0 --npm.publishArgs= --npm.allowSameVersion
> ```
>
> `--npm.publishArgs=` drops `--provenance` for this one run, because npm refuses to generate an
> attestation outside a supported CI runner. `--npm.allowSameVersion` is needed because
> `packages/react-native-h3/package.json` already carries `0.1.0`. That first release therefore
> ships without a provenance attestation. Configure the trusted publisher immediately afterwards;
> every release from `v0.1.1` onwards goes through the workflow and is attested.

## 🌅 Post-Launch: The "First Public Release" Checklist

Once the repository is switched from Private to Public, these three tasks must be completed
immediately:

### 1. Verify Assets & Badges

Verify the README renders correctly on both GitHub and npm.

- The logo and the benchmark chart are repository-relative paths (`img/logo.svg`,
  `img/benchmark.svg`). GitHub resolves them against the repository root, and npm rewrites them to
  the repository's raw URL via the `repository` field, which serves them only once the repository
  is public.
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
