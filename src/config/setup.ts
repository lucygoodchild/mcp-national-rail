import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

const result = dotenv.config({ path: join(rootDir, '.env') });

if (result.error) {
    throw new Error('Failed to load .env file');
}