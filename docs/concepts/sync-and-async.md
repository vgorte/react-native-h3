# 🧵 Sync and async

> **Audience: package users deciding whether a call belongs on the main thread.** Almost every
> function is synchronous on purpose. Four are heavy enough to earn an async variant, and this page
> says which, what the variant guarantees, and what the thread hop costs.

## Synchronous by default

Most H3 operations are intentionally synchronous.

For small native calls, the cost of moving work to another thread can exceed the cost of the H3 operation itself.

## The four async variants

Four expensive operations provide async variants:

```ts
import { polygonToCellsAsync, type Ring } from 'react-native-nitro-h3'

const sanFrancisco: Ring[] = [
  [
    [37.8133, -122.409],
    [37.7198, -122.3545],
    [37.7076, -122.5123],
  ],
]

const cells = await polygonToCellsAsync(sanFrancisco, 12)
```

Available async functions:

* `polygonToCellsAsync`
* `cellsToMultiPolygonAsync`
* `polygonToCellsExperimentalAsync`
* `uncompactCellsAsync`

Those are the only operations heavy enough to cross Nitro's 50 ms rule of thumb, where a call
starts costing visible frames.

Everything else is synchronous by design. A thread hop (context switch) often costs more time than
the H3 C library call it was meant to move off the main thread.

## Guarantees

**Buffer safety.** An async variant copies any input cell set before work starts on the background
thread. The buffer you pass in is yours to reuse the moment the function returns, and the result is
identical to the one its synchronous sibling produces.

**Error parity.** Async variants throw the same errors, with the same messages and the same numeric
codes, as their synchronous siblings.

## What the hop costs

On the iPhone XS, `polygonToCellsAsync` adds about 11 ms to the 234 ms
`polygonToCells` call, while `uncompactCellsAsync` is indistinguishable from its synchronous sibling
at 3.8 ms. On the Galaxy S23 the same hop costs about 68 ms on a 176 ms call, and 1.4 ms on a 3.5 ms
one. The rows are `W3` and `W8` in [benchmark.md](../benchmark.md).
