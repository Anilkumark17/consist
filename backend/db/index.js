import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error('DATABASE_URL is required');
}

const url = rawUrl.replace(/&?channel_binding=require/g, '');
const sql = neon(url);

export const db = drizzle(sql, { schema });
