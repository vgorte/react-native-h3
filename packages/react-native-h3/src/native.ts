import { NitroModules } from 'react-native-nitro-modules'
import type { H3 } from './specs/H3.nitro'

// Not exported: the HybridObject is an internal implementation detail.
export const native = NitroModules.createHybridObject<H3>('H3')
