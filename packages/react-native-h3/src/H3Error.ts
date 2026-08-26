/**
 * Represents a failure raised by any function in this package.
 *
 * It carries only a message, because Nitro erases every other property when an exception
 * crosses from C++ to JavaScript. The wording comes from H3's own `describeH3Error`, so it
 * matches upstream documentation exactly.
 */
export class H3Error extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'H3Error'
  }
}

// Nitro prefixes synchronous throws with "H3.<method>(...): "; promise rejections carry no prefix.
const NITRO_PREFIX = /^H3\.[A-Za-z0-9_]+\(\.\.\.\):\s*/

/**
 * Converts whatever crossed the bridge into an {@linkcode H3Error} and throws it.
 *
 * Strips Nitro's method prefix from the message first, so the resulting `H3Error` reads
 * exactly as upstream H3 worded it.
 */
export function rethrowAsH3Error(error: unknown): never {
  if (error instanceof Error) {
    throw new H3Error(error.message.replace(NITRO_PREFIX, ''))
  }
  throw new H3Error(String(error))
}
