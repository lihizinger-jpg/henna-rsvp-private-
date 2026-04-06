// Type declarations for Node 22+ built-in sqlite module (experimental)
declare module 'node:sqlite' {
  export interface StatementResultingChanges {
    changes: number
    lastInsertRowid: number | bigint
  }

  export interface StatementSync {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): Record<string, unknown> | undefined
    run(...params: unknown[]): StatementResultingChanges
  }

  export class DatabaseSync {
    constructor(location: string, options?: { open?: boolean })
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
}
