import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import type { PoolConfig } from "pg";

// Explicitly load .env first, then .env.local (higher priority)
// This matches Next.js behavior
const envPath = path.resolve(process.cwd(), ".env");
const envLocalPath = path.resolve(process.cwd(), ".env.local");

// Load .env if exists
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Load .env.local if exists (will override .env values)
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true, quiet: true });
}

// Use a global variable to store the pool in development to avoid connection exhaustion
declare global {
  var db_pool: Pool | undefined;
}

function buildPoolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  const config: PoolConfig = {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };

  const sslMode = url.searchParams.get("sslmode");
  if (sslMode && sslMode !== "disable") {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

function sanitizeParams(params?: any[]): any[] | undefined {
  if (!params) return params;
  return params.map(val => {
    if (typeof val === "string") {
      const parts = val.split(".");
      if (parts.length === 2 && parts[0].length === 36 && parts[1].length === 64) {
        return parts[0];
      }
    }
    return val;
  });
}

const pool =
  global.db_pool ||
  new Pool({
    ...buildPoolConfig(process.env.DATABASE_URL || ""),
    max: 20,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 30000,
  });

pool.on("error", (err) => {
  console.warn("[DB Pool Background Warning]", err.message);
});

// Patch pool.query to automatically sanitize signed session cookies globally and retry on connection drops/timeouts
if (!(pool as any).__isPatched) {
  (pool as any).__isPatched = true;
  const originalPoolQuery = pool.query.bind(pool);
  pool.query = function (this: any, text: any, params?: any[], callback?: any) {
    let newParams = params;
    if (Array.isArray(params)) {
      newParams = sanitizeParams(params);
    }
    let newText = text;
    if (typeof text === 'object' && text !== null && Array.isArray(text.values)) {
      newText = { ...text, values: sanitizeParams(text.values) };
    }
    
    if (typeof callback === 'function') {
      return newParams !== undefined
        ? originalPoolQuery(newText, newParams, callback)
        : originalPoolQuery(newText, callback);
    }

    const executeWithRetry = async (attempts = 3) => {
      for (let i = 0; i < attempts; i++) {
        try {
          return newParams !== undefined
            ? await originalPoolQuery(newText, newParams)
            : await originalPoolQuery(newText);
        } catch (err: any) {
          const isConnectionError = 
            err.message?.includes('terminated') || 
            err.message?.includes('timeout') || 
            err.message?.includes('Connection') ||
            err.message?.includes('ECONNRESET') ||
            err.message?.includes('idleTimeoutMillis');
            
          if (isConnectionError && i < attempts - 1) {
            console.warn(`[DB Pool Query] Attempt ${i + 1}/${attempts} failed: ${err.message}. Retrying in 1s...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            continue;
          }
          throw err;
        }
      }
    };
    
    return executeWithRetry();
  } as any;
}

if (process.env.NODE_ENV !== "production") {
  global.db_pool = pool;
}

export const query = (text: string, params?: any[]) => pool.query(text, params);
export const getPool = () => pool;

export const getClient = async () => {
  let client: any = null;
  for (let i = 0; i < 3; i++) {
    try {
      client = await pool.connect();
      break;
    } catch (err: any) {
      const isConnectionError = 
        err.message?.includes('timeout') || 
        err.message?.includes('Connection') || 
        err.message?.includes('terminated');
      if (isConnectionError && i < 2) {
        console.warn(`[DB Pool Connect] Attempt ${i + 1}/3 failed: ${err.message}. Retrying in 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
  }

  if (!client.__isPatched) {
    client.__isPatched = true;
    const originalQuery = client.query.bind(client);
    client.query = function (this: any, text: any, params?: any[], callback?: any) {
      let newParams = params;
      if (Array.isArray(params)) {
        newParams = sanitizeParams(params);
      }
      let newText = text;
      if (typeof text === 'object' && text !== null && Array.isArray(text.values)) {
        newText = { ...text, values: sanitizeParams(text.values) };
      }

      if (typeof callback === 'function') {
        return newParams !== undefined
          ? originalQuery(newText, newParams, callback)
          : originalQuery(newText, callback);
      }

      const executeWithRetry = async (attempts = 3) => {
        for (let j = 0; j < attempts; j++) {
          try {
            return newParams !== undefined
              ? await originalQuery(newText, newParams)
              : await originalQuery(newText);
          } catch (err: any) {
            const isConnectionError = 
              err.message?.includes('terminated') || 
              err.message?.includes('timeout') || 
              err.message?.includes('Connection');
            if (isConnectionError && j < attempts - 1) {
              console.warn(`[DB Client Query] Attempt ${j + 1}/${attempts} failed: ${err.message}. Retrying in 1s...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            throw err;
          }
        }
      };

      return executeWithRetry();
    } as any;
  }

  return client;
};

export const queryClient = getClient;
export default pool;
