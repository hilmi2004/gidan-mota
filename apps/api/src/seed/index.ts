import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from '../config/logger.js';
import { runSeed } from './seedData.js';

async function main(): Promise<void> {
  await connectDatabase();
  const summary = await runSeed();
  logger.info(summary, 'Seed script completed successfully.');
  await disconnectDatabase();
}

main().catch((err) => {
  logger.error({ err }, 'Seed script failed');
  process.exit(1);
});

