import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';
import { resetRateLimitCounters } from './redis.js';

let localReplicaProc: ChildProcess | null = null;
let isReplicaSetSupported = false;

const LOCAL_MONGOD_PATHS = [
  'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe',
  'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
  'mongod',
];

function findMongodBinary(): string | null {
  for (const candidate of LOCAL_MONGOD_PATHS) {
    if (candidate === 'mongod' || fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function ensureLocalReplicaSet(port: number, dbName: string): Promise<string> {
  const probeUri = `mongodb://127.0.0.1:${port}/${dbName}?replicaSet=rs0&directConnection=true`;
  try {
    const conn = await mongoose.createConnection(probeUri, { serverSelectionTimeoutMS: 1200 }).asPromise();
    const admin = conn.db?.admin();
    const status = await admin?.command({ replSetGetStatus: 1 }).catch(() => null);
    await conn.close();
    if (status && status.ok === 1) {
      return probeUri;
    }
  } catch {
    // Not running yet on this port, spawn it below
  }

  const bin = findMongodBinary();
  if (!bin) {
    throw new Error('No mongod binary found for local replica set.');
  }

  const dataDir = path.resolve(process.cwd(), '.local-mongo', `rs0-${port}`);
  fs.mkdirSync(dataDir, { recursive: true });

  logger.info({ port, dataDir }, 'Starting local MongoDB replica set node (rs0) for ACID transactions...');
  localReplicaProc = spawn(
    bin,
    ['--replSet', 'rs0', '--port', String(port), '--dbpath', dataDir, '--bind_ip', '127.0.0.1'],
    { stdio: 'ignore', windowsHide: true, detached: true },
  );
  localReplicaProc.unref();

  const directUri = `mongodb://127.0.0.1:${port}/admin?directConnection=true`;
  for (let attempt = 0; attempt < 25; attempt++) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      const conn = await mongoose.createConnection(directUri, { serverSelectionTimeoutMS: 1000 }).asPromise();
      const admin = conn.db?.admin();
      if (admin) {
        try {
          await admin.command({ replSetGetStatus: 1 });
        } catch {
          await admin.command({
            replSetInitiate: {
              _id: 'rs0',
              members: [{ _id: 0, host: `127.0.0.1:${port}` }],
            },
          });
        }
      }
      await conn.close();
      break;
    } catch {
      // Wait for mongod to accept connections
    }
  }

  // Wait briefly for PRIMARY election
  for (let i = 0; i < 20; i++) {
    try {
      const conn = await mongoose.createConnection(probeUri, { serverSelectionTimeoutMS: 1000 }).asPromise();
      const hello = await conn.db?.admin().command({ hello: 1 });
      await conn.close();
      if (hello?.isWritablePrimary) {
        break;
      }
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return probeUri;
}

export async function connectDatabase(customDbName?: string): Promise<void> {
  if (env.NODE_ENV === 'test') {
    resetRateLimitCounters();
  }
  if (mongoose.connection.readyState === 1) return;

  const dbName = customDbName ?? (env.NODE_ENV === 'test' ? `autodey_test_${process.pid}` : 'autodey');

  if (env.USE_LOCAL_EMBEDDED_INFRA) {
    try {
      const port = env.NODE_ENV === 'test' ? 27029 : 27028;
      const rsUri = await ensureLocalReplicaSet(port, dbName);
      await mongoose.connect(rsUri);
      isReplicaSetSupported = true;
      logger.info({ uri: rsUri }, 'Connected to MongoDB Replica Set (transactions enabled)');
      return;
    } catch (err) {
      logger.warn({ err }, 'Fallback to default MONGODB_URI');
    }
  }

  await mongoose.connect(env.MONGODB_URI, { dbName });
  try {
    const hello = await mongoose.connection.db?.admin().command({ hello: 1 });
    isReplicaSetSupported = Boolean(hello?.setName);
  } catch {
    isReplicaSetSupported = false;
  }
  logger.info({ isReplicaSetSupported }, 'Connected to MongoDB');
}

export function supportsTransactions(): boolean {
  return isReplicaSetSupported;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

