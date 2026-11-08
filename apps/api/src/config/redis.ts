import { Redis } from 'ioredis';
import crypto from 'node:crypto';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Provides distributed Redis locks (`SET key token NX PX ttl`) and rate-limit counters,
 * with a zero-dependency atomic in-memory fallback when Redis is not running locally.
 */
interface LockEntry {
  token: string;
  expiresAt: number;
}

const inMemoryLocks = new Map<string, LockEntry>();
const inMemoryKeyValues = new Map<string, { value: string; expiresAt: number | null }>();
let redisClient: Redis | null = null;
let redisReady = false;

export async function initRedis(): Promise<void> {
  if (env.USE_LOCAL_EMBEDDED_INFRA && env.NODE_ENV === 'test') {
    redisReady = false;
    return;
  }
  try {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    client.on('error', () => {
      redisReady = false;
    });
    await client.connect();
    redisClient = client;
    redisReady = true;
    logger.info('Connected to Redis server');
  } catch {
    redisReady = false;
    logger.info('Using local atomic in-memory Redis & lock engine (no external Redis server detected)');
  }
}

export function isRedisHealthy(): boolean {
  return redisReady || env.USE_LOCAL_EMBEDDED_INFRA;
}

/**
 * Acquires a lock `lock:auction:{id}` using `SET NX PX ttlMs` with short backoff retries.
 */
export async function acquireDistributedLock(
  lockKey: string,
  ttlMs = 8000,
  maxWaitMs = 15000,
): Promise<{ release: () => Promise<void> }> {
  const token = crypto.randomUUID();
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const now = Date.now();
    if (redisReady && redisClient) {
      const res = await redisClient.set(lockKey, token, 'PX', ttlMs, 'NX');
      if (res === 'OK') {
        return {
          release: async () => {
            const lua = `if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end`;
            await redisClient?.eval(lua, 1, lockKey, token).catch(() => null);
          },
        };
      }
    } else {
      const existing = inMemoryLocks.get(lockKey);
      if (!existing || existing.expiresAt <= now) {
        inMemoryLocks.set(lockKey, { token, expiresAt: now + ttlMs });
        return {
          release: async () => {
            const current = inMemoryLocks.get(lockKey);
            if (current && current.token === token) {
              inMemoryLocks.delete(lockKey);
            }
          },
        };
      }
    }
    // Wait 5-15ms jitter before retry
    await new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 10)));
  }

  throw new Error(`LOCK_TIMEOUT:${lockKey}`);
}

export function resetRateLimitCounters(): void {
  inMemoryKeyValues.clear();
  inMemoryLocks.clear();
}

export async function incrementRateCounter(key: string, windowSeconds: number): Promise<number> {
  const now = Date.now();
  if (redisReady && redisClient) {
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, windowSeconds);
    }
    return count;
  }

  const existing = inMemoryKeyValues.get(key);
  if (!existing || (existing.expiresAt !== null && existing.expiresAt <= now)) {
    inMemoryKeyValues.set(key, { value: '1', expiresAt: now + windowSeconds * 1000 });
    return 1;
  }
  const next = Number(existing.value) + 1;
  existing.value = String(next);
  return next;
}

