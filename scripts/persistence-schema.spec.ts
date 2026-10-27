import { describe, expect, it } from 'vitest'
import { canonicalSchema, parseMigrations, schemaDigest, type Schema } from './persistence-schema.ts'

function schemaOf(sql: string): Schema {
  return parseMigrations([{ name: '0001_init.sql', sql }])
}

describe('parseMigrations', () => {
  it('parses column definitions with every supported attribute', () => {
    const schema = schemaOf(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        nickname TEXT DEFAULT 'anon',
        team_id INTEGER REFERENCES teams (id)
      );
    `)
    expect(schema.tables).toHaveLength(1)
    const table = schema.tables[0]
    expect(table?.name).toBe('users')
    expect(table?.columns).toEqual([
      { name: 'id', type: 'INTEGER', notNull: false, primaryKey: true, unique: false },
      { name: 'email', type: 'TEXT', notNull: true, primaryKey: false, unique: true },
      { name: 'nickname', type: 'TEXT', notNull: false, primaryKey: false, unique: false, defaultValue: "'anon'" },
      { name: 'team_id', type: 'INTEGER', notNull: false, primaryKey: false, unique: false, references: 'teams(id)' },
    ])
    expect(table?.constraints).toEqual([])
  })

  it('parses table-level constraints and marks their columns', () => {
    const schema = schemaOf(`
      CREATE TABLE memberships (
        user_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        PRIMARY KEY (user_id, team_id),
        UNIQUE (user_id),
        FOREIGN KEY (team_id) REFERENCES teams (id)
      );
    `)
    const table = schema.tables[0]
    expect(table?.constraints).toEqual([
      'PRIMARY KEY (user_id, team_id)',
      'UNIQUE (user_id)',
      'FOREIGN KEY (team_id) REFERENCES teams (id)',
    ])
    expect(table?.columns.map(column => [column.name, column.primaryKey, column.unique, column.references])).toEqual([
      ['user_id', true, true, undefined],
      ['team_id', true, false, 'teams(id)'],
      ['role', false, false, undefined],
    ])
  })

  it('parses named table constraints and composite foreign keys', () => {
    const schema = schemaOf(`
      CREATE TABLE child (
        parent_a INTEGER NOT NULL,
        parent_b INTEGER NOT NULL,
        CONSTRAINT child_pk PRIMARY KEY (parent_a, parent_b),
        CONSTRAINT child_parent FOREIGN KEY (parent_a, parent_b) REFERENCES parent (a, b)
      );
    `)
    const table = schema.tables[0]
    expect(table?.constraints).toEqual([
      'CONSTRAINT child_pk PRIMARY KEY (parent_a, parent_b)',
      'CONSTRAINT child_parent FOREIGN KEY (parent_a, parent_b) REFERENCES parent (a, b)',
    ])
    expect(table?.columns.every(column => column.primaryKey && column.references === undefined)).toBe(true)
  })

  it('parses quoted identifiers and unique indexes', () => {
    const schema = schemaOf(`
      CREATE TABLE "Order Items" ([id] INTEGER, \`name\` TEXT, "user id" INTEGER);
      CREATE UNIQUE INDEX IF NOT EXISTS "idx order items name" ON [Order Items] (\`name\`, [user id]);
    `)
    expect(schema.tables[0]?.name).toBe('Order Items')
    expect(schema.tables[0]?.columns.map(column => column.name)).toEqual(['id', 'name', 'user id'])
    expect(schema.indexes).toEqual([
      { name: 'idx order items name', table: 'Order Items', columns: ['name', 'user id'], unique: true },
    ])
  })

  it('applies migrations in file name order', () => {
    const schema = parseMigrations([
      {
        name: '0002_add_email.sql',
        sql: 'ALTER TABLE users ADD COLUMN email TEXT NOT NULL; CREATE INDEX idx_users_email ON users (email);',
      },
      { name: '0001_init.sql', sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY);' },
    ])
    expect(schema.tables[0]?.columns.map(column => column.name)).toEqual(['id', 'email'])
    expect(schema.tables[0]?.columns[1]?.notNull).toBe(true)
    expect(schema.indexes[0]?.name).toBe('idx_users_email')
  })

  it('drops tables with their indexes and drops indexes directly', () => {
    const dropped = schemaOf(`
      CREATE TABLE audit (id INTEGER);
      CREATE INDEX idx_audit_id ON audit (id);
      DROP TABLE audit;
    `)
    expect(dropped.tables).toEqual([])
    expect(dropped.indexes).toEqual([])
    const droppedIndex = schemaOf(`
      CREATE TABLE audit (id INTEGER);
      CREATE INDEX idx_audit_id ON audit (id);
      DROP INDEX idx_audit_id;
    `)
    expect(droppedIndex.indexes).toEqual([])
  })

  it('ignores line comments that contain SQL punctuation', () => {
    const schema = schemaOf(`
      -- CREATE TABLE ignored (id INTEGER);
      CREATE TABLE audit (id INTEGER);
      -- trailing comment with ; and ( and ) and 'quotes'
    `)
    expect(schema.tables.map(table => table.name)).toEqual(['audit'])
  })

  it('honors IF NOT EXISTS and IF EXISTS', () => {
    const schema = schemaOf(`
      CREATE TABLE users (id INTEGER);
      CREATE TABLE IF NOT EXISTS users (id TEXT);
      CREATE INDEX idx_users_id ON users (id);
      CREATE INDEX IF NOT EXISTS idx_users_id ON users (id);
      DROP TABLE IF EXISTS missing;
      DROP INDEX IF EXISTS missing;
    `)
    expect(schema.tables[0]?.columns[0]?.type).toBe('INTEGER')
    expect(schema.indexes).toHaveLength(1)
  })

  it('renders function, literal, and negative default values', () => {
    const schema = schemaOf(`
      CREATE TABLE settings (
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT now(),
        retries INTEGER DEFAULT -1,
        enabled INTEGER DEFAULT NULL
      );
    `)
    expect(schema.tables[0]?.columns.map(column => column.defaultValue)).toEqual([
      'CURRENT_TIMESTAMP',
      'now()',
      '-1',
      'NULL',
    ])
  })

  it('rejects unsupported statements with file and statement context', () => {
    expect(() => parseMigrations([{ name: '0001_view.sql', sql: 'CREATE VIEW active AS SELECT 1;' }]))
      .toThrow(/0001_view\.sql: .*CREATE VIEW active AS SELECT 1.*expected TABLE or INDEX after CREATE/)
  })

  it('rejects unsupported column and table constraints', () => {
    expect(() => schemaOf('CREATE TABLE t (id INTEGER CHECK (id > 0));'))
      .toThrow(/unsupported column constraint "CHECK"/)
    expect(() => schemaOf('CREATE TABLE t (id INTEGER, CHECK (id > 0));'))
      .toThrow(/expected a column definition or a PRIMARY KEY, UNIQUE, or FOREIGN KEY table constraint/)
  })

  it('rejects block comments and unterminated strings', () => {
    expect(() => schemaOf('/* note */ CREATE TABLE t (id INTEGER);'))
      .toThrow(/block comments are not supported/)
    expect(() => schemaOf("CREATE TABLE t (name TEXT DEFAULT 'oops);"))
      .toThrow(/unterminated string literal/)
  })

  it('rejects duplicate and unknown schema objects', () => {
    expect(() => schemaOf('CREATE TABLE t (id INTEGER); CREATE TABLE t (id INTEGER);'))
      .toThrow(/table "t" is already defined/)
    expect(() => schemaOf('CREATE TABLE t (id INTEGER, id TEXT);'))
      .toThrow(/column "id" is declared twice/)
    expect(() => schemaOf('ALTER TABLE missing ADD COLUMN id INTEGER;'))
      .toThrow(/table "missing" is not defined/)
    expect(() => schemaOf('CREATE INDEX idx ON missing (id);'))
      .toThrow(/table "missing" is not defined/)
    expect(() => schemaOf('CREATE TABLE t (id INTEGER); CREATE INDEX idx ON t (id); CREATE INDEX idx ON t (id);'))
      .toThrow(/index "idx" is already defined/)
  })

  it('reports the failing file and line', () => {
    expect(() => parseMigrations([
      { name: '0003_bad.sql', sql: 'CREATE TABLE good (id INTEGER);\nCREATE TABLE bad (id INTEGER CHECK (id > 0));' },
    ])).toThrow(/0003_bad\.sql: line 2/)
  })
})

describe('canonicalSchema', () => {
  it('sorts tables and indexes but keeps column and constraint order', () => {
    const alpha: Schema['tables'][number] = {
      name: 'alpha',
      columns: [
        { name: 'z', type: 'TEXT', notNull: false, primaryKey: false, unique: false },
        { name: 'id', type: 'INTEGER', notNull: true, primaryKey: true, unique: false },
      ],
      constraints: ['UNIQUE (z)', 'PRIMARY KEY (id)'],
    }
    const zeta: Schema['tables'][number] = {
      name: 'zeta',
      columns: [{ name: 'b', type: 'TEXT', notNull: true, primaryKey: false, unique: false }],
      constraints: [],
    }
    const forward: Schema = {
      tables: [zeta, alpha],
      indexes: [
        { name: 'idx_zeta', table: 'zeta', columns: ['b'], unique: false },
        { name: 'idx_alpha', table: 'alpha', columns: ['id'], unique: true },
      ],
    }
    const reversed: Schema = {
      tables: [alpha, zeta],
      indexes: [
        { name: 'idx_alpha', table: 'alpha', columns: ['id'], unique: true },
        { name: 'idx_zeta', table: 'zeta', columns: ['b'], unique: false },
      ],
    }
    const canonical = canonicalSchema(forward)
    expect(canonical).toBe(canonicalSchema(reversed))
    expect(canonical.indexOf('table "alpha"')).toBeLessThan(canonical.indexOf('table "zeta"'))
    expect(canonical.indexOf('index "idx_alpha"')).toBeLessThan(canonical.indexOf('index "idx_zeta"'))
    expect(canonical.indexOf('column "z"')).toBeLessThan(canonical.indexOf('column "id"'))
    expect(canonical.indexOf('constraint UNIQUE (z)')).toBeLessThan(canonical.indexOf('constraint PRIMARY KEY (id)'))
  })

  it('produces a stable schema digest', () => {
    const schema: Schema = {
      tables: [{
        name: 'users',
        columns: [{ name: 'id', type: 'INTEGER', notNull: true, primaryKey: true, unique: false }],
        constraints: [],
      }],
      indexes: [],
    }
    expect(schemaDigest(schema)).toMatch(/^sha256:[0-9a-f]{64}$/u)
    expect(schemaDigest(schema)).toBe(schemaDigest(structuredClone(schema)))
  })

  it('hashes the empty schema to the sha256 of an empty string', () => {
    expect(canonicalSchema({ tables: [], indexes: [] })).toBe('')
    expect(parseMigrations([])).toEqual({ tables: [], indexes: [] })
    expect(schemaDigest({ tables: [], indexes: [] }))
      .toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})
