import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  const root = path.resolve(__dirname, '../..');
  const parsed = dotenv.config({ path: path.join(root, '.env.test'), quiet: true }).parsed ?? {};
  execSync('npx prisma migrate deploy', {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, ...parsed, DATABASE_URL: process.env.TEST_DATABASE_URL ?? parsed.DATABASE_URL },
  });
}
