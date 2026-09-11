import { randomBytes, scrypt } from "node:crypto";

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

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_PARAMETERS.keyLength,
      {
        N: SCRYPT_PARAMETERS.n,
        r: SCRYPT_PARAMETERS.r,
        p: SCRYPT_PARAMETERS.p,
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
