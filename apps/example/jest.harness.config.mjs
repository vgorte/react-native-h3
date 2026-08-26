export default {
  preset: 'react-native-harness',
  // Without this, Jest's default patterns would also claim non-harness files under `__tests__`.
  testMatch: ['<rootDir>/**/__tests__/**/*.harness.[jt]s?(x)'],
}
