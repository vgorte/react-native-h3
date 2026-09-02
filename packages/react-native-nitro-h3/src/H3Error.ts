/**
 * Represents a failure raised by any function in this package.
 *
 * {@linkcode H3Error.code} is the stable half of the contract and the message is informational: the
 * wording comes from H3's own `describeH3Error` and may change when the vendored H3 version changes.
 */
export class H3Error extends Error {
  /**
   * Holds H3's numeric error code, or `undefined` when this package refused the input before H3 saw
   * it. Branch on this rather than on the message text.
   */
  readonly code: number | undefined

  constructor(message: string, code?: number) {
    super(message)
    this.name = 'H3Error'
    this.code = code
  }
}

// Nitro prefixes synchronous throws with "H3.<method>(...): "; promise rejections carry no prefix.
const NITRO_PREFIX = /^H3\.[A-Za-z0-9_]+\(\.\.\.\):\s*/

// H3 failures end in the suffix h3-js appends; this package's own wording does not.
const CODE_SUFFIX = / \(code: (\d+)\)$/

/**
 * Converts whatever crossed the bridge into an {@linkcode H3Error} and throws it.
 *
 * Strips Nitro's method prefix from the message, then reads the trailing error code without
 * removing it, because h3-js keeps the suffix in `message` too.
 */
export function rethrowAsH3Error(error: unknown): never {
  if (error instanceof Error) {
    const message = error.message.replace(NITRO_PREFIX, '')
    const match = CODE_SUFFIX.exec(message)
    throw new H3Error(message, match ? Number(match[1]) : undefined)
  }
  throw new H3Error(String(error))
}
