import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { initRedis } from './config/redis.js';
import { seedDatabaseIfEmpty } from './seed/seedData.js';

export let ioServer: SocketIOServer | null = null;

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await initRedis();
  await seedDatabaseIfEmpty();

  const app = createApp();
  const httpServer = http.createServer(app);

  ioServer = new SocketIOServer(httpServer, {
    cors: {
      origin: [env.WEB_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    },
  });

  const auctionsNs = ioServer.of('/auctions');
  auctionsNs.on('connection', (socket) => {
    socket.emit('server_clock', { serverTimeMs: Date.now() });
    socket.on('join_auction', (auctionId: string) => {
      void socket.join(`auction:${auctionId}`);
      socket.emit('server_clock', { serverTimeMs: Date.now() });
    });
    socket.on('leave_auction', (auctionId: string) => {
      void socket.leave(`auction:${auctionId}`);
    });
  });

  const chatNs = ioServer.of('/chat');
  chatNs.on('connection', (socket) => {
    socket.on('join_conversation', (conversationId: string) => {
      void socket.join(`conversation:${conversationId}`);
    });
    socket.on('leave_conversation', (conversationId: string) => {
      void socket.leave(`conversation:${conversationId}`);
    });
    socket.on('typing', (payload: { conversationId: string; userId: string; displayName: string }) => {
      socket.to(`conversation:${payload.conversationId}`).emit('user_typing', payload);
    });
  });

  httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, docs: `http://localhost:${env.PORT}/api/docs` },
      `${env.BRAND_NAME} API server listening on port ${env.PORT}`,
    );
  });
}

if (
  env.NODE_ENV !== 'test' &&
  !process.argv.some((arg) => arg.includes('load-test') || arg.includes('seed'))
) {
  bootstrap().catch((err) => {
    logger.error({ err }, 'Failed to start API server');
    process.exit(1);
  });
}

