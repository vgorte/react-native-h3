# Contributing

The repository is a bun workspace: the package lives in `packages/react-native-nitro-h3`, the app that
exercises it in `apps/example`.

```sh
bun install
bun run lint
bun run typecheck
bun run build
bun test
```

The host C++ tests and the h3-js parity suite build outside the app and are not run by `bun test`:

```sh
cmake -S packages/react-native-nitro-h3/cpp/test -B build/host -DCMAKE_BUILD_TYPE=Release
cmake --build build/host --target tests -j
./build/host/tests

cmake -S packages/react-native-nitro-h3/cpp/test -B build/parity -DCMAKE_BUILD_TYPE=Release
cmake --build build/parity --target parity_probe -j
H3_PARITY_PROBE="$PWD/build/parity/parity_probe" bun run --cwd packages/react-native-nitro-h3 parity
```

The parity suite drives a host executable over the same Nitro-free operations layer the app calls,
and compares it against h3-js 4.5.0 over every resolution 0 cell, all sixteen resolutions, all 192
pentagons, the poles and the antimeridian. A difference it finds is a difference in what ships.

The example app runs on the iOS simulator and on the Android emulator:

```sh
bun run example:ios
bun run example:android -- --deviceId emulator-5554
```

Benchmark figures come from the app's Benchmark screen in a Release build, never from a Debug build.
[docs/benchmark.md](https://github.com/vgorte/react-native-nitro-h3/blob/main/docs/benchmark.md) holds the
method and the reproduction steps. The release process is in
[docs/releasing.md](https://github.com/vgorte/react-native-nitro-h3/blob/main/docs/releasing.md).

## Adding an operation

Every operation crosses seven places, in this order. Each one has a reason to exist, and skipping any
of them fails a gate rather than merely leaving a gap.

1. **`cpp/ops/<Domain>.{hpp,cpp}`** holds the computation as a plain C++ function. Nothing in
   `cpp/ops/`, `cpp/core/` or `cpp/shapes/` may include a Nitro header: that is what lets the
   operation be tested on the host under AddressSanitizer, and what makes it safe to run on a worker
   thread. Validation belongs here, once, at the boundary.
2. **`cpp/test/<Domain>OpsTest.cpp`**, registered in `cpp/test/CMakeLists.txt` under `TEST_SOURCES`
   so both the `tests` and `tests_asan` targets pick it up.
3. **`src/specs/H3.nitro.ts`** declares the method, then `bun run specs` regenerates
   `nitrogen/generated/**`, which is committed.
4. **`cpp/HybridH3.{hpp,cpp}`** implements the generated pure virtual: convert the Nitro arguments,
   call the `h3ops::` function, convert the result back. No computation here.
5. **`src/<domain>.ts`** wraps the call with its JSDoc and `rethrowAsH3Error`, and `src/index.ts`
   re-exports it in alphabetical order.
6. **`__tests__/exports.test.ts`** asserts the exported surface exactly, name by name and by count,
   against `docs/h3-function-table.md`. Both files gain the new name.
7. **`parity/corpus.ts`** and `cpp/test/ParityProbe.cpp` add the operation to the h3-js comparison,
   unless it has no h3-js counterpart, in which case
   `packages/react-native-nitro-h3/docs/h3-js-divergences.md` says why.

## Conventions

Code and comments are in English. Commit messages follow the conventional format. Work on a branch
and open a pull request; `bun run lint` and `bun run typecheck` have to pass before review.
