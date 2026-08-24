import 'server-only';
import { neon } from '@neondatabase/serverless';

let client;

export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurada');
  }
  if (!client) {
    const sql = neon(process.env.DATABASE_URL);
    const originalUnsafe = typeof sql.unsafe === 'function' ? sql.unsafe.bind(sql) : null;
    if (originalUnsafe) {
      sql.unsafe = (query, params) => {
        if (Array.isArray(params)) return sql.query(query, params);
        return originalUnsafe(query);
      };
    }
    client = sql;
  }
  return client;
}
