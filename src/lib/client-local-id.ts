/**
 * Creates an identifier for browser-local draft rows.
 *
 * This value is only for ephemeral UI identity (for example React keys). It is
 * deliberately not a canonical public ID and must never be used for sessions,
 * authentication, CSRF tokens, password reset links, or other security-sensitive
 * identifiers.
 */
export interface ClientLocalIdCrypto {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint32Array) => Uint32Array;
}

let fallbackSequence = 0;

export function createClientLocalId(
  cryptoSource: ClientLocalIdCrypto | undefined = globalThis.crypto,
): string {
  if (typeof cryptoSource?.randomUUID === "function") {
    return `draft-${cryptoSource.randomUUID()}`;
  }

  if (typeof cryptoSource?.getRandomValues === "function") {
    const values = new Uint32Array(4);
    cryptoSource.getRandomValues(values);
    return `draft-${Array.from(values, (value) => value.toString(36)).join("-")}`;
  }

  fallbackSequence = (fallbackSequence + 1) >>> 0;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2);
  return `draft-${timestamp}-${fallbackSequence.toString(36)}-${random}`;
}
