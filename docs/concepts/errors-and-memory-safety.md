# 🛡️ Errors and memory safety

> **Audience: package users writing the `catch` block.** Every failure is an `H3Error`, native codes
> survive the boundary, and an optional cell ceiling turns an allocation that would kill the process
> into a catchable error. This page covers both.

## One error type

All package-level errors are represented by `H3Error`.

```ts
import {
  H3Error,
  latLngToCell,
} from 'react-native-nitro-h3'

try {
  latLngToCell(37.7749, -122.4194, 99)
} catch (error) {
  if (error instanceof H3Error) {
    console.log(error.message)
    console.log(error.code)
  }
}
```

Errors originating from H3 preserve the numeric H3 error code. Validation performed by the binding itself uses the same `H3Error` type.

When a failure originates from the native H3 library, the message is pulled directly from C++
(`describeH3Error`) and includes the exact numeric code, matching `h3-js` 1:1.

- **Native codes.** Standard H3 errors append `(code: N)` to the message and expose the `.code`
  property.
- **Binding exceptions.** Errors this package raises itself, before the call reaches the H3 C
  library (argument validation such as a non-integer resolution, or a breach of a configured cell
  ceiling), also throw `H3Error`, but leave the `.code` property `undefined`.
- **Async parity.** Async variants throw the exact same errors and messages as their synchronous
  siblings.

Every deliberate divergence from `h3-js`, including the strict validation this package applies at
the C++ boundary, is listed with the `h3-js` answer beside it and proved by a test in
[h3-js-divergences.md](../h3-js-divergences.md).

## The optional cell ceiling

Cell-producing H3 operations can return very large result sets.

For applications where unexpectedly large allocations should be rejected, configure an optional cell limit:

```ts
import { configure } from 'react-native-nitro-h3'

configure({
  maxCellCount: 4_000_000,
})
```

A request exceeding the configured limit throws a catchable `H3Error` before the result is allocated.

The limit is disabled by default to preserve `h3-js` behavior.

To remove a previously configured limit:

```ts
import { configure } from 'react-native-nitro-h3'

configure({
  maxCellCount: Infinity,
})
```

How the ceiling is sized, what an unbounded request costs on a phone, and how `h3-js` behaves
without one is in [Performance guide](../performance.md#the-cell-ceiling-in-detail).
