/* eslint-disable no-console */
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const dotenv = require('dotenv')

// Load local env files if present (does not override already-set env vars).
dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

function buildPoolConfig(connectionString) {
  const url = new URL(connectionString)
  const config = {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  }

  const sslMode = url.searchParams.get('sslmode')
  if (sslMode && sslMode !== 'disable') {
    config.ssl = { rejectUnauthorized: false }
  }

  return config
}

function readSql(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function getMigrationTableMode(pool) {
  const reg = await pool.query("SELECT to_regclass('public.schema_migrations') as reg")
  if (!reg.rows[0]?.reg) {
    await pool.query(`
      CREATE TABLE schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
  }

  const colsRes = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schema_migrations'
    `
  )
  const cols = new Set(colsRes.rows.map((r) => r.column_name))

  if (cols.has('name')) {
    if (!cols.has('checksum')) await pool.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT')
    if (!cols.has('applied_at')) {
      await pool.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    }
    return { mode: 'v2', keyCol: 'name', timeCol: 'applied_at' }
  }

  if (cols.has('filename')) {
    // Legacy schema: filename (PK) + executed_at.
    if (!cols.has('checksum')) await pool.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT')
    if (!cols.has('executed_at')) {
      await pool.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    }
    return { mode: 'legacy', keyCol: 'filename', timeCol: 'executed_at' }
  }

  throw new Error('schema_migrations exists but has an unknown schema')
}

async function migrate() {
  if (process.env.SKIP_DB_MIGRATIONS === 'true') {
    console.log('⏭️  SKIP_DB_MIGRATIONS=true, skipping migration step')
    return
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set (check .env.local / .env)')
    process.exit(1)
  }

  const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL))
  try {
    const mode = await getMigrationTableMode(pool)

    const tablesResult = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'schema_migrations';
    `)
    const publicTablesCount = tablesResult.rows[0]?.count ?? 0

    if (publicTablesCount === 0) {
      const schemaPath = path.join(process.cwd(), 'src/db/schema.sql')
      if (fs.existsSync(schemaPath)) {
        const schema = readSql(schemaPath)
        await pool.query(schema)
        console.log('✅ Baseline schema applied')
      }
    } else {
      console.log('ℹ️  Schema already initialized, skipping baseline schema.sql')
    }

    const migrationsDir = path.join(process.cwd(), 'migrations')
    if (!fs.existsSync(migrationsDir)) {
      console.log('⏭️  No migrations directory found')
      return
    }

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

    const maxPasses = Number.parseInt(process.env.MIGRATION_MAX_PASSES || '5', 10)
    let pass = 0
    let appliedInAnyPass = false

    while (pass < maxPasses) {
      pass += 1
      let appliedThisPass = false
      const errors = []

      for (const file of files) {
        const sqlPath = path.join(migrationsDir, file)
        const sql = readSql(sqlPath)
        const checksum = sha256(sql)

        const existing = await pool.query(
          `SELECT checksum FROM schema_migrations WHERE ${mode.keyCol} = $1`,
          [file]
        )

        if (existing.rowCount > 0) {
          const appliedChecksum = existing.rows[0]?.checksum
          if (appliedChecksum && appliedChecksum !== checksum) {
            throw new Error('Migration changed after apply: ' + file)
          }
          if (!appliedChecksum) {
            await pool.query(
              `UPDATE schema_migrations SET checksum = $2 WHERE ${mode.keyCol} = $1 AND (checksum IS NULL OR checksum = '')`,
              [file, checksum]
            )
          }
          continue
        }

        try {
          await pool.query('BEGIN')
          await pool.query(sql)
          if (mode.mode === 'legacy') {
            await pool.query(
              'INSERT INTO schema_migrations (filename, executed_at, checksum) VALUES ($1, NOW(), $2)',
              [file, checksum]
            )
          } else {
            await pool.query(
              'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
              [file, checksum]
            )
          }
          await pool.query('COMMIT')
          appliedThisPass = true
          appliedInAnyPass = true
          console.log('✅ Migration applied:', file)
        } catch (err) {
          await pool.query('ROLLBACK')
          errors.push({ file, message: err.message })
        }
      }

      if (!appliedThisPass) {
        if (errors.length > 0) {
          const head = errors
            .slice(0, 5)
            .map((e) => `- ${e.file}: ${e.message}`)
            .join('\n')
          throw new Error(`Unapplied migrations remain after ${pass} pass(es):\n${head}`)
        }
        break
      }
    }

    if (!appliedInAnyPass) {
      console.log('⏭️  No new migrations to apply')
    }

    console.log('✅ All migrations complete')
  } finally {
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error('❌ Critical migration error:', err.message)
  process.exit(1)
})
