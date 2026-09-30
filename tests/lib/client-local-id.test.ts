import { describe, expect, it, vi } from "vitest";

import { createClientLocalId, type ClientLocalIdCrypto } from "../../src/lib/client-local-id";

describe("createClientLocalId", () => {
  it("uses crypto.randomUUID when available", () => {
    const cryptoSource: ClientLocalIdCrypto = {
      randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
    };

    expect(createClientLocalId(cryptoSource)).toBe("draft-11111111-1111-4111-8111-111111111111");
    expect(cryptoSource.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("falls back to getRandomValues when randomUUID is unavailable", () => {
    const cryptoSource: ClientLocalIdCrypto = {
      getRandomValues: (array) => {
        array.set([1, 2, 3, 4]);
        return array;
      },
    };

    expect(createClientLocalId(cryptoSource)).toBe("draft-1-2-3-4");
  });

  it("keeps consecutive fallback IDs distinct without Web Crypto", () => {
    const first = createClientLocalId(undefined);
    const second = createClientLocalId(undefined);

    expect(first).not.toBe(second);
    expect(first).toMatch(/^draft-/);
    expect(second).toMatch(/^draft-/);
  });
});
