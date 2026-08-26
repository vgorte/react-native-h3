# react-native-h3

Fast H3 geospatial indexing for React Native, powered by [Nitro Modules](https://nitro.margelo.com).
The H3 C library is vendored at v4.5.0 and compiled into the app, so calls run natively on iOS and
Android without a JavaScript port. Apache-2.0, like H3 itself.

## Install

```sh
bun add react-native-h3 react-native-nitro-modules
```

## Usage

```ts
import { gridDisk, H3Error, latLngToCell } from 'react-native-h3'

const cell = latLngToCell(37.7749, -122.4194, 9)
const neighbours = gridDisk(cell, 1)
try {
  latLngToCell(37.7749, -122.4194, 42)
} catch (error) {
  if (error instanceof H3Error) console.warn(error.message)
}
```

The full documentation follows with the first release.
