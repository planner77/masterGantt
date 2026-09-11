import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const SCRYPT_PARAMETERS = Object.freeze({
  algorithm: "scrypt" as const,
  n: 32_768,
  r: 8,
  p: 3,
  keyLength: 32,
  saltLength: 16,
  maxMemory: 64 * 1_024 * 1_024,
});

export interface PasswordHashRecord {
  algorithm: "scrypt";
  salt: Buffer;
  hash: Buffer;
  n: number;
  r: number;
  p: number;
  keyLength: number;
}

export interface PersistedPasswordRecord {
  algorithm: string;
  salt: Buffer;
  hash: Buffer;
  n: number;
  r: number;
  p: number;
  keyLength: number;
}

export class PasswordHashCapacityError extends Error {
  constructor() {
    super("Password hashing capacity is currently exhausted.");
    this.name = "PasswordHashCapacityError";
  }
}

export class AsyncCapacityLimiter {
  private active = 0;

  constructor(private readonly maximumConcurrent: number) {
    if (maximumConcurrent < 1) {
      throw new Error("Concurrency limit must be positive.");
    }
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.maximumConcurrent) {
      throw new PasswordHashCapacityError();
    }

    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
    }
  }
}

const passwordHashLimiter = new AsyncCapacityLimiter(2);

function deriveKey(
  password: string,
  salt: Buffer,
  parameters: Pick<PersistedPasswordRecord, "n" | "r" | "p" | "keyLength"> = {
    n: SCRYPT_PARAMETERS.n,
    r: SCRYPT_PARAMETERS.r,
    p: SCRYPT_PARAMETERS.p,
    keyLength: SCRYPT_PARAMETERS.keyLength,
  },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      parameters.keyLength,
      {
        N: parameters.n,
        r: parameters.r,
        p: parameters.p,
        maxmem: SCRYPT_PARAMETERS.maxMemory,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

const DUMMY_PASSWORD_RECORD: PersistedPasswordRecord = Object.freeze({
  algorithm: "scrypt",
  salt: Buffer.from("f42dca565e86175b120d347fca6736c5", "hex"),
  hash: Buffer.from(
    "dbf97724e71a0fa3cef2072e029eca510d386438a6df1a349033faf51273099c",
    "hex",
  ),
  n: SCRYPT_PARAMETERS.n,
  r: SCRYPT_PARAMETERS.r,
  p: SCRYPT_PARAMETERS.p,
  keyLength: SCRYPT_PARAMETERS.keyLength,
});

export function isSupportedPasswordRecord(
  record: PersistedPasswordRecord | undefined,
): record is PersistedPasswordRecord {
  return Boolean(
    record &&
    record.algorithm === SCRYPT_PARAMETERS.algorithm &&
    Buffer.isBuffer(record.salt) &&
    record.salt.length === SCRYPT_PARAMETERS.saltLength &&
    Buffer.isBuffer(record.hash) &&
    record.hash.length === SCRYPT_PARAMETERS.keyLength &&
    record.n === SCRYPT_PARAMETERS.n &&
    record.r === SCRYPT_PARAMETERS.r &&
    record.p === SCRYPT_PARAMETERS.p &&
    record.keyLength === SCRYPT_PARAMETERS.keyLength,
  );
}

export async function verifyEditPassword(
  candidate: string,
  persisted: PersistedPasswordRecord | undefined,
): Promise<boolean> {
  const supported = isSupportedPasswordRecord(persisted);
  const record = supported ? persisted : DUMMY_PASSWORD_RECORD;

  return passwordHashLimiter.run(async () => {
    const derived = await deriveKey(candidate, record.salt, record);
    const matches = derived.length === record.hash.length &&
      timingSafeEqual(derived, record.hash);
    return supported && matches;
  });
}

export async function hashEditPassword(
  password: string,
): Promise<PasswordHashRecord> {
  return passwordHashLimiter.run(async () => {
    const salt = randomBytes(SCRYPT_PARAMETERS.saltLength);
    const hash = await deriveKey(password, salt);
    return {
      algorithm: SCRYPT_PARAMETERS.algorithm,
      salt,
      hash,
      n: SCRYPT_PARAMETERS.n,
      r: SCRYPT_PARAMETERS.r,
      p: SCRYPT_PARAMETERS.p,
      keyLength: SCRYPT_PARAMETERS.keyLength,
    };
  });
}
