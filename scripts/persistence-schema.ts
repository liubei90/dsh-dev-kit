/**
 * Parse the repository's SQL migration files into a normalized schema.
 *
 * Supported statements: `CREATE TABLE [IF NOT EXISTS]` with column definitions
 * and `PRIMARY KEY`/`UNIQUE`/`FOREIGN KEY` table constraints, `CREATE [UNIQUE]
 * INDEX [IF NOT EXISTS]`, `ALTER TABLE … ADD COLUMN`, `DROP TABLE [IF EXISTS]`,
 * and `DROP INDEX [IF EXISTS]`. `--` line comments and double-quoted,
 * backtick-quoted, or bracket-quoted identifiers are accepted. Every other
 * statement or column constraint fails with the file, line, and statement
 * instead of being skipped, so an unsupported migration cannot silently
 * disappear from the digest.
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Repository-relative directory holding the SQL migration files. */
export const MIGRATIONS_DIRECTORY = 'apps/api/migrations'

/** One column of a table, normalized from an SQL column definition. */
export interface Column {
  /** Column name with any quoting removed. */
  name: string
  /** Declared SQL type as written, e.g. `INTEGER` or `varchar(255)`. */
  type: string
  /** True when the column declares `NOT NULL`. */
  notNull: boolean
  /** True for column-level or table-level `PRIMARY KEY`. */
  primaryKey: boolean
  /** True for column-level or table-level `UNIQUE`. */
  unique: boolean
  /** Normalized `DEFAULT` expression, when declared. */
  defaultValue?: string
  /** Referenced target such as `teams(id)`, when declared. */
  references?: string
}

/** One table with its columns in declaration order and its table constraints. */
export interface Table {
  /** Table name with any quoting removed. */
  name: string
  /** Columns in declaration order. */
  columns: Column[]
  /** Table-level constraint texts in declaration order. */
  constraints: string[]
}

/** One explicit index. */
export interface Index {
  /** Index name with any quoting removed. */
  name: string
  /** Indexed table name. */
  table: string
  /** Indexed columns in declaration order. */
  columns: string[]
  /** True for `CREATE UNIQUE INDEX`. */
  unique: boolean
}

/** Migrations applied in order, reduced to their final tables and indexes. */
export interface Schema {
  /** Tables in creation order; compare with {@link canonicalSchema} for a stable order. */
  tables: Table[]
  /** Indexes in creation order. */
  indexes: Index[]
}

/** One migration file supplied to {@link parseMigrations}. */
export interface MigrationFile {
  /** File name used for ordering and diagnostics, e.g. `0001_init.sql`. */
  name: string
  /** Full SQL source of the migration. */
  sql: string
}

/** Raised when a migration uses SQL outside the supported subset or fails to apply. */
export class PersistenceSchemaError extends Error {
  override name = 'PersistenceSchemaError'
}

/** Render a schema into the canonical text hashed by {@link schemaDigest}. */
export function canonicalSchema(schema: Schema): string {
  const tables = [...schema.tables].sort((left, right) => compareText(left.name, right.name))
  const indexes = [...schema.indexes].sort((left, right) => compareText(left.name, right.name))
  const lines: string[] = []
  for (const table of tables) {
    lines.push(`table ${quoteName(table.name)}`)
    for (const column of table.columns) {
      let line = `  column ${quoteName(column.name)} ${column.type}`
      if (column.notNull) line += ' not null'
      if (column.primaryKey) line += ' primary key'
      if (column.unique) line += ' unique'
      if (column.defaultValue !== undefined) line += ` default ${column.defaultValue}`
      if (column.references !== undefined) line += ` references ${column.references}`
      lines.push(line)
    }
    for (const constraint of table.constraints) lines.push(`  constraint ${constraint}`)
  }
  for (const index of indexes) {
    const columns = index.columns.map(column => quoteName(column)).join(', ')
    lines.push(`index ${quoteName(index.name)} on ${quoteName(index.table)} (${columns})${index.unique ? ' unique' : ''}`)
  }
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`
}

/** Stable content digest of a schema, suitable for change records and the catalog. */
export function schemaDigest(schema: Schema): string {
  return `sha256:${createHash('sha256').update(canonicalSchema(schema), 'utf8').digest('hex')}`
}

/** Read `apps/api/migrations/*.sql` in file name order; a missing directory yields no files. */
export function loadMigrations(root: string): MigrationFile[] {
  const directory = resolve(root, MIGRATIONS_DIRECTORY)
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .filter(name => name.endsWith('.sql'))
    .sort(compareText)
    .map(name => ({ name: `${MIGRATIONS_DIRECTORY}/${name}`, sql: readFileSync(resolve(directory, name), 'utf8') }))
}

/**
 * Apply migration files in file name order.
 * @param files - migration sources; the array order is irrelevant because names sort first.
 * @returns the final tables and indexes after every statement.
 * @throws PersistenceSchemaError when a statement is unsupported or fails to apply.
 */
export function parseMigrations(files: readonly MigrationFile[]): Schema {
  const tables = new Map<string, Table>()
  const indexes = new Map<string, Index>()
  const ordered = [...files].sort((left, right) => compareText(left.name, right.name))
  for (const file of ordered) {
    for (const tokens of splitStatements(tokenize(file.sql, file.name))) {
      applyStatement(new Reader(tokens, file.name, describeStatement(tokens)), tables, indexes)
    }
  }
  return { tables: [...tables.values()], indexes: [...indexes.values()] }
}

/** Compare two strings by code unit so ordering never depends on the host locale. */
function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** Quote a schema identifier in the canonical text. */
function quoteName(name: string): string {
  return JSON.stringify(name)
}

interface Token {
  readonly kind: 'word' | 'identifier' | 'string' | 'number' | 'punctuation'
  readonly text: string
  readonly raw: string
  readonly line: number
}

const WORD_START = /[A-Za-z_\u0080-\uffff]/u
const WORD_PART = /[A-Za-z0-9_$\u0080-\uffff]/u
const NUMBER = /^(?:0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/

const COLUMN_CONSTRAINT_KEYWORDS = new Set([
  'PRIMARY', 'NOT', 'UNIQUE', 'DEFAULT', 'REFERENCES', 'CHECK', 'CONSTRAINT', 'COLLATE', 'GENERATED', 'NULL',
  'AUTOINCREMENT',
])

const TABLE_CONSTRAINT_KEYWORDS = new Set(['CONSTRAINT', 'PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK'])

interface Quoted {
  readonly text: string
  readonly raw: string
  readonly end: number
  readonly line: number
}

/** Read one quoted string or identifier, honoring doubled closing characters. */
function readQuoted(source: string, start: number, line: number, closer: string, file: string, label: string): Quoted {
  let text = ''
  let index = start + 1
  let currentLine = line
  while (index < source.length) {
    const char = source.charAt(index)
    if (char === '\n') {
      currentLine += 1
      text += char
      index += 1
      continue
    }
    if (char === closer) {
      if (source.charAt(index + 1) === closer) {
        text += closer
        index += 2
        continue
      }
      return { text, raw: source.slice(start, index + 1), end: index + 1, line: currentLine }
    }
    text += char
    index += 1
  }
  throw new PersistenceSchemaError(`${file}:${line}: unterminated ${label}`)
}

/** Split SQL into tokens, dropping `--` comments while preserving token line numbers. */
function tokenize(sql: string, file: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  let line = 1
  while (index < sql.length) {
    const char = sql.charAt(index)
    if (char === '\n') {
      line += 1
      index += 1
      continue
    }
    if (char === ' ' || char === '\t' || char === '\r' || char === '\f') {
      index += 1
      continue
    }
    if (char === '-' && sql.charAt(index + 1) === '-') {
      const newline = sql.indexOf('\n', index)
      index = newline === -1 ? sql.length : newline
      continue
    }
    if (char === '/' && sql.charAt(index + 1) === '*') {
      throw new PersistenceSchemaError(`${file}:${line}: block comments are not supported; use -- line comments`)
    }
    if (char === "'") {
      const quoted = readQuoted(sql, index, line, "'", file, 'string literal')
      tokens.push({ kind: 'string', text: quoted.text, raw: quoted.raw, line })
      index = quoted.end
      line = quoted.line
      continue
    }
    if (char === '"' || char === '`' || char === '[') {
      const closer = char === '[' ? ']' : char
      const quoted = readQuoted(sql, index, line, closer, file, 'quoted identifier')
      tokens.push({ kind: 'identifier', text: quoted.text, raw: quoted.raw, line })
      index = quoted.end
      line = quoted.line
      continue
    }
    if (WORD_START.test(char)) {
      let end = index + 1
      while (end < sql.length && WORD_PART.test(sql.charAt(end))) end += 1
      const text = sql.slice(index, end)
      tokens.push({ kind: 'word', text, raw: text, line })
      index = end
      continue
    }
    if (/[0-9]/.test(char)) {
      const match = NUMBER.exec(sql.slice(index))
      const text = match?.[0] ?? char
      tokens.push({ kind: 'number', text, raw: text, line })
      index += text.length
      continue
    }
    tokens.push({ kind: 'punctuation', text: char, raw: char, line })
    index += 1
  }
  return tokens
}

/** Split a token stream on top-level semicolons, discarding empty statements. */
function splitStatements(tokens: readonly Token[]): Token[][] {
  const statements: Token[][] = []
  let current: Token[] = []
  for (const token of tokens) {
    if (token.kind === 'punctuation' && token.text === ';') {
      if (current.length > 0) statements.push(current)
      current = []
      continue
    }
    current.push(token)
  }
  if (current.length > 0) statements.push(current)
  return statements
}

/** Compact one statement into the text shown by diagnostics. */
function describeStatement(tokens: readonly Token[]): string {
  const text = tokens.map(token => token.raw).join(' ')
  return text.length > 120 ? `${text.slice(0, 117)}...` : text
}

/** Build a located, actionable parse failure. */
function failure(file: string, statement: string, token: Token | undefined, message: string): PersistenceSchemaError {
  const location = token === undefined ? 'end of statement' : `line ${token.line} near ${JSON.stringify(token.raw)}`
  return new PersistenceSchemaError(`${file}: ${location} in statement "${statement}": ${message}`)
}

/** Cursor over one statement's tokens with keyword-aware helpers. */
class Reader {
  private index = 0
  private readonly tokens: readonly Token[]
  readonly file: string
  readonly statement: string

  constructor(tokens: readonly Token[], file: string, statement: string) {
    this.tokens = tokens
    this.file = file
    this.statement = statement
  }

  /** Next token without consuming it. */
  peek(): Token | undefined {
    return this.tokens[this.index]
  }

  /** Consume and return the next token, failing at end of statement. */
  next(): Token {
    const token = this.tokens[this.index]
    if (token === undefined) throw failure(this.file, this.statement, undefined, 'unexpected end of statement')
    this.index += 1
    return token
  }

  /** Whether the next token is an unquoted keyword. */
  matchesWord(word: string): boolean {
    const token = this.peek()
    return token !== undefined && token.kind === 'word' && token.text.toUpperCase() === word
  }

  /** Consume one unquoted keyword. */
  expectWord(word: string): void {
    if (!this.matchesWord(word)) {
      throw failure(this.file, this.statement, this.peek(), `expected ${word}`)
    }
    this.next()
  }

  /** Whether the next token is the given punctuation character. */
  matchesPunctuation(character: string): boolean {
    const token = this.peek()
    return token !== undefined && token.kind === 'punctuation' && token.text === character
  }

  /** Consume one punctuation character. */
  expectPunctuation(character: string): void {
    if (!this.matchesPunctuation(character)) {
      throw failure(this.file, this.statement, this.peek(), `expected "${character}"`)
    }
    this.next()
  }

  /** Consume an unquoted or quoted identifier. */
  readIdentifier(role: string): string {
    const token = this.next()
    if (token.kind !== 'word' && token.kind !== 'identifier') {
      throw failure(this.file, this.statement, token, `expected ${role}, got ${JSON.stringify(token.raw)}`)
    }
    const after = this.peek()
    if (after !== undefined && after.kind === 'punctuation' && after.text === '.') {
      throw failure(this.file, this.statement, after, 'schema-qualified names are not supported')
    }
    return token.text
  }

  /** Fail when tokens remain after a complete statement. */
  expectEnd(): void {
    const token = this.peek()
    if (token !== undefined) {
      throw failure(this.file, this.statement, token, `unexpected token ${JSON.stringify(token.raw)} after a complete statement`)
    }
  }

  /** Whether every token has been consumed. */
  atEnd(): boolean {
    return this.index >= this.tokens.length
  }
}

/** Whether a token starts a column constraint or an unsupported constraint keyword. */
function startsColumnConstraint(token: Token | undefined): boolean {
  return token !== undefined && token.kind === 'word' && COLUMN_CONSTRAINT_KEYWORDS.has(token.text.toUpperCase())
}

/** Render tokens with SQL-like spacing: no spaces around parentheses, dots, or unary signs. */
function renderTokens(tokens: readonly Token[]): string {
  let out = ''
  for (const token of tokens) {
    const text = token.raw
    if (out === '') {
      out = text
      continue
    }
    const previous = out.charAt(out.length - 1)
    if (text === '(' || text === ')' || text === ',' || text === '.') {
      out += text
      continue
    }
    if (previous === '(' || previous === '.' || previous === '-' || previous === '+') {
      out += text
      continue
    }
    if ((text === '-' || text === '+') && (previous === '(' || previous === ',')) {
      out += text
      continue
    }
    out += ` ${text}`
  }
  return out
}

/** Read a parenthesized comma-separated list into element token groups. */
function readParenthesizedGroups(reader: Reader): Token[][] {
  reader.expectPunctuation('(')
  const groups: Token[][] = []
  let current: Token[] = []
  let depth = 1
  while (depth > 0) {
    const token = reader.next()
    if (token.kind === 'punctuation' && token.text === '(') {
      depth += 1
      current.push(token)
      continue
    }
    if (token.kind === 'punctuation' && token.text === ')') {
      depth -= 1
      if (depth === 0) break
      current.push(token)
      continue
    }
    if (depth === 1 && token.kind === 'punctuation' && token.text === ',') {
      if (current.length === 0) throw failure(reader.file, reader.statement, token, 'empty list element')
      groups.push(current)
      current = []
      continue
    }
    current.push(token)
  }
  if (current.length > 0) groups.push(current)
  return groups
}

/** Read `(column, …)` and require at least one column. */
function readColumnList(reader: Reader): string[] {
  reader.expectPunctuation('(')
  const names: string[] = []
  if (reader.matchesPunctuation(')')) {
    throw failure(reader.file, reader.statement, reader.peek(), 'a column list must name at least one column')
  }
  while (true) {
    names.push(reader.readIdentifier('column name'))
    if (!reader.matchesPunctuation(',')) break
    reader.next()
  }
  reader.expectPunctuation(')')
  return names
}

/** Read an optional `(column, …)` list. */
function readOptionalColumnList(reader: Reader): string[] | null {
  return reader.matchesPunctuation('(') ? readColumnList(reader) : null
}

/** Render a column reference, e.g. `teams` or `teams(id)`. */
function formatReference(table: string, columns: readonly string[] | null): string {
  return columns === null ? table : `${table}(${columns.join(', ')})`
}

/** Find declared columns by name and set one boolean flag. */
function markColumns(columns: readonly Column[], names: readonly string[], flag: 'primaryKey' | 'unique', reader: Reader): void {
  for (const name of names) {
    const column = columns.find(candidate => candidate.name === name)
    if (column === undefined) {
      throw failure(reader.file, reader.statement, reader.peek(), `table constraint references unknown column "${name}"`)
    }
    column[flag] = true
  }
}

/** Read a column definition from the current position to the end of the element. */
function readColumnDefinition(reader: Reader): Column {
  const name = reader.readIdentifier('column name')
  const typeTokens: Token[] = []
  while (!reader.atEnd() && !startsColumnConstraint(reader.peek())) typeTokens.push(reader.next())
  if (typeTokens.length === 0) {
    throw failure(reader.file, reader.statement, reader.peek(), `column "${name}" is missing a type`)
  }
  const column: Column = { name, type: renderTokens(typeTokens), notNull: false, primaryKey: false, unique: false }
  while (!reader.atEnd()) {
    const token = reader.next()
    const keyword = token.kind === 'word' ? token.text.toUpperCase() : ''
    if (keyword === 'PRIMARY') {
      reader.expectWord('KEY')
      column.primaryKey = true
      continue
    }
    if (keyword === 'NOT') {
      reader.expectWord('NULL')
      column.notNull = true
      continue
    }
    if (keyword === 'UNIQUE') {
      column.unique = true
      continue
    }
    if (keyword === 'DEFAULT') {
      column.defaultValue = renderTokens(readDefaultValue(reader))
      continue
    }
    if (keyword === 'REFERENCES') {
      column.references = readColumnReference(reader)
      continue
    }
    throw failure(
      reader.file,
      reader.statement,
      token,
      `unsupported column constraint ${JSON.stringify(token.raw)}; supported: PRIMARY KEY, NOT NULL, UNIQUE, DEFAULT, REFERENCES`,
    )
  }
  return column
}

/** Read the value of a `DEFAULT` clause, stopping at the next column constraint. */
function readDefaultValue(reader: Reader): Token[] {
  const values: Token[] = []
  let depth = 0
  while (!reader.atEnd()) {
    const token = reader.peek()
    if (token === undefined) break
    const first = values.length === 0
    const literalNull = token.kind === 'word' && token.text.toUpperCase() === 'NULL'
    if (depth === 0 && startsColumnConstraint(token) && !(first && literalNull)) break
    if (token.kind === 'punctuation' && token.text === '(') depth += 1
    if (token.kind === 'punctuation' && token.text === ')') depth -= 1
    values.push(reader.next())
  }
  if (values.length === 0) throw failure(reader.file, reader.statement, reader.peek(), 'DEFAULT requires a value')
  return values
}

/** Read `REFERENCES table [(column)]` for a column-level foreign key. */
function readColumnReference(reader: Reader): string {
  const table = reader.readIdentifier('referenced table')
  return formatReference(table, readOptionalColumnList(reader))
}

/** Read one table element: either a column definition or a table constraint. */
function readTableElement(reader: Reader, columns: Column[], constraints: string[]): void {
  const first = reader.peek()
  if (first !== undefined && first.kind === 'word' && TABLE_CONSTRAINT_KEYWORDS.has(first.text.toUpperCase())) {
    readTableConstraint(reader, columns, constraints)
    return
  }
  const column = readColumnDefinition(reader)
  if (columns.some(candidate => candidate.name === column.name)) {
    throw failure(reader.file, reader.statement, first, `column "${column.name}" is declared twice`)
  }
  columns.push(column)
}

/** Read one `PRIMARY KEY`, `UNIQUE`, or `FOREIGN KEY` table constraint. */
function readTableConstraint(reader: Reader, columns: Column[], constraints: string[]): void {
  let name: string | undefined
  if (reader.matchesWord('CONSTRAINT')) {
    reader.next()
    name = reader.readIdentifier('constraint name')
  }
  const prefix = name === undefined ? '' : `CONSTRAINT ${name} `
  if (reader.matchesWord('PRIMARY')) {
    reader.expectWord('PRIMARY')
    reader.expectWord('KEY')
    const names = readColumnList(reader)
    reader.expectEnd()
    markColumns(columns, names, 'primaryKey', reader)
    constraints.push(`${prefix}PRIMARY KEY (${names.join(', ')})`)
    return
  }
  if (reader.matchesWord('UNIQUE')) {
    reader.next()
    const names = readColumnList(reader)
    reader.expectEnd()
    markColumns(columns, names, 'unique', reader)
    constraints.push(`${prefix}UNIQUE (${names.join(', ')})`)
    return
  }
  if (reader.matchesWord('FOREIGN')) {
    reader.expectWord('FOREIGN')
    reader.expectWord('KEY')
    const names = readColumnList(reader)
    reader.expectWord('REFERENCES')
    const target = reader.readIdentifier('referenced table')
    const targetColumns = readColumnList(reader)
    reader.expectEnd()
    if (names.length === 1) {
      const [columnName] = names
      const column = columnName === undefined ? undefined : columns.find(candidate => candidate.name === columnName)
      if (column === undefined) {
        throw failure(reader.file, reader.statement, reader.peek(), `foreign key references unknown column "${columnName ?? ''}"`)
      }
      column.references = formatReference(target, targetColumns)
    }
    constraints.push(`${prefix}FOREIGN KEY (${names.join(', ')}) REFERENCES ${target} (${targetColumns.join(', ')})`)
    return
  }
  throw failure(
    reader.file,
    reader.statement,
    reader.peek(),
    'expected a column definition or a PRIMARY KEY, UNIQUE, or FOREIGN KEY table constraint',
  )
}

/** Consume optional `IF NOT EXISTS`. */
function readIfNotExists(reader: Reader): boolean {
  if (!reader.matchesWord('IF')) return false
  reader.next()
  reader.expectWord('NOT')
  reader.expectWord('EXISTS')
  return true
}

/** Consume optional `IF EXISTS`. */
function readIfExists(reader: Reader): boolean {
  if (!reader.matchesWord('IF')) return false
  reader.next()
  reader.expectWord('EXISTS')
  return true
}

/** Apply one statement to the schema being built. */
function applyStatement(reader: Reader, tables: Map<string, Table>, indexes: Map<string, Index>): void {
  if (reader.matchesWord('CREATE')) {
    applyCreate(reader, tables, indexes)
    return
  }
  if (reader.matchesWord('ALTER')) {
    applyAlter(reader, tables)
    return
  }
  if (reader.matchesWord('DROP')) {
    applyDrop(reader, tables, indexes)
    return
  }
  throw failure(
    reader.file,
    reader.statement,
    reader.peek(),
    'unsupported statement; supported: CREATE TABLE, CREATE [UNIQUE] INDEX, ALTER TABLE ... ADD COLUMN, DROP TABLE, DROP INDEX',
  )
}

/** Apply a `CREATE TABLE` or `CREATE [UNIQUE] INDEX` statement. */
function applyCreate(reader: Reader, tables: Map<string, Table>, indexes: Map<string, Index>): void {
  reader.expectWord('CREATE')
  let unique = false
  if (reader.matchesWord('UNIQUE')) {
    reader.next()
    unique = true
  }
  if (reader.matchesWord('TABLE')) {
    if (unique) throw failure(reader.file, reader.statement, reader.peek(), 'CREATE UNIQUE TABLE is not supported')
    applyCreateTable(reader, tables)
    return
  }
  if (reader.matchesWord('INDEX')) {
    applyCreateIndex(reader, tables, indexes, unique)
    return
  }
  throw failure(reader.file, reader.statement, reader.peek(), 'expected TABLE or INDEX after CREATE')
}

/** Apply one `CREATE TABLE` statement. */
function applyCreateTable(reader: Reader, tables: Map<string, Table>): void {
  reader.expectWord('TABLE')
  const ifNotExists = readIfNotExists(reader)
  const name = reader.readIdentifier('table name')
  const groups = readParenthesizedGroups(reader)
  if (groups.length === 0) throw failure(reader.file, reader.statement, undefined, 'CREATE TABLE must declare at least one column')
  const columns: Column[] = []
  const constraints: string[] = []
  for (const group of groups) {
    readTableElement(new Reader(group, reader.file, reader.statement), columns, constraints)
  }
  reader.expectEnd()
  if (tables.has(name)) {
    if (ifNotExists) return
    throw failure(reader.file, reader.statement, undefined, `table "${name}" is already defined; add IF NOT EXISTS or a new migration`)
  }
  tables.set(name, { name, columns, constraints })
}

/** Apply one `CREATE [UNIQUE] INDEX` statement. */
function applyCreateIndex(reader: Reader, tables: Map<string, Table>, indexes: Map<string, Index>, unique: boolean): void {
  reader.expectWord('INDEX')
  const ifNotExists = readIfNotExists(reader)
  const name = reader.readIdentifier('index name')
  reader.expectWord('ON')
  const table = reader.readIdentifier('table name')
  const groups = readParenthesizedGroups(reader)
  if (groups.length === 0) throw failure(reader.file, reader.statement, undefined, 'CREATE INDEX must name at least one column')
  const columns = groups.map(group => singleIndexColumn(group, reader))
  reader.expectEnd()
  if (!tables.has(table)) {
    throw failure(reader.file, reader.statement, undefined, `table "${table}" is not defined; create it before indexing it`)
  }
  if (indexes.has(name)) {
    if (ifNotExists) return
    throw failure(reader.file, reader.statement, undefined, `index "${name}" is already defined; add IF NOT EXISTS or a new migration`)
  }
  indexes.set(name, { name, table, columns, unique })
}

/** Read exactly one plain column name from an index element. */
function singleIndexColumn(group: readonly Token[], reader: Reader): string {
  if (group.length !== 1) {
    throw failure(reader.file, reader.statement, group[0], 'index expressions are not supported; index plain column names')
  }
  const [token] = group
  if (token === undefined || (token.kind !== 'word' && token.kind !== 'identifier')) {
    throw failure(reader.file, reader.statement, token, 'expected an index column name')
  }
  return token.text
}

/** Apply one `ALTER TABLE … ADD COLUMN` statement. */
function applyAlter(reader: Reader, tables: Map<string, Table>): void {
  reader.expectWord('ALTER')
  reader.expectWord('TABLE')
  const name = reader.readIdentifier('table name')
  reader.expectWord('ADD')
  reader.expectWord('COLUMN')
  const column = readColumnDefinition(reader)
  reader.expectEnd()
  const table = tables.get(name)
  if (table === undefined) throw failure(reader.file, reader.statement, undefined, `table "${name}" is not defined`)
  if (table.columns.some(candidate => candidate.name === column.name)) {
    throw failure(reader.file, reader.statement, undefined, `column "${column.name}" already exists on table "${name}"`)
  }
  table.columns.push(column)
}

/** Apply one `DROP TABLE` or `DROP INDEX` statement. */
function applyDrop(reader: Reader, tables: Map<string, Table>, indexes: Map<string, Index>): void {
  reader.expectWord('DROP')
  if (reader.matchesWord('TABLE')) {
    reader.next()
    const ifExists = readIfExists(reader)
    const name = reader.readIdentifier('table name')
    reader.expectEnd()
    if (!tables.has(name)) {
      if (ifExists) return
      throw failure(reader.file, reader.statement, undefined, `table "${name}" is not defined`)
    }
    tables.delete(name)
    for (const [indexName, index] of indexes) {
      if (index.table === name) indexes.delete(indexName)
    }
    return
  }
  if (reader.matchesWord('INDEX')) {
    reader.next()
    const ifExists = readIfExists(reader)
    const name = reader.readIdentifier('index name')
    reader.expectEnd()
    if (!indexes.has(name)) {
      if (ifExists) return
      throw failure(reader.file, reader.statement, undefined, `index "${name}" is not defined`)
    }
    indexes.delete(name)
    return
  }
  throw failure(reader.file, reader.statement, reader.peek(), 'expected TABLE or INDEX after DROP')
}
