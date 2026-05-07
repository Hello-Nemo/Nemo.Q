import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolConnect = vi.fn();

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(function MockPool() {
      return {
        connect: poolConnect,
        end: vi.fn()
      };
    })
  }
}));

describe('PostgresDataSource table sampling safety', () => {
  beforeEach(() => {
    poolConnect.mockReset();
  });

  it('rejects SQL injection table names before sampling', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ table_name: 'users' }], rowCount: 1 };
        }
        return { rows: [{ id: 1 }], rowCount: 1 };
      }),
      release: vi.fn()
    };
    poolConnect.mockResolvedValue(client);
    const { PostgresDataSource } = await import('./db-connector');

    const ds = new PostgresDataSource('postgres://test');
    const result = await ds.getTableSamples('users; DROP TABLE users');

    expect(result).toMatchObject({
      rowCount: 0,
      rows: [],
      error: expect.any(String),
      code: 'INVALID_TABLE_NAME'
    });
    expect(queries.some(sql => sql.includes('DROP TABLE'))).toBe(false);
    expect(poolConnect).not.toHaveBeenCalled();
    expect(client.release).not.toHaveBeenCalled();
  });

  it('returns a structured error for tables outside the schema allowlist', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ table_name: 'users' }], rowCount: 1 };
        }
        return { rows: [{ id: 1 }], rowCount: 1 };
      }),
      release: vi.fn()
    };
    poolConnect.mockResolvedValue(client);
    const { PostgresDataSource } = await import('./db-connector');

    const ds = new PostgresDataSource('postgres://test');
    const result = await ds.getTableSamples('orders');

    expect(result).toMatchObject({
      rowCount: 0,
      rows: [],
      error: expect.any(String),
      code: 'TABLE_NOT_ALLOWED',
      details: {
        tableName: 'orders',
        allowedTables: ['users']
      }
    });
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('samples an allowed table using a quoted PostgreSQL identifier', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ table_name: 'users' }], rowCount: 1 };
        }
        return { rows: [{ id: 1, name: 'Ada' }], rowCount: 1 };
      }),
      release: vi.fn()
    };
    poolConnect.mockResolvedValue(client);
    const { PostgresDataSource } = await import('./db-connector');

    const ds = new PostgresDataSource('postgres://test');
    const result = await ds.getTableSamples('users');

    expect(result).toEqual({
      rowCount: 1,
      rows: [{ id: 1, name: 'Ada' }]
    });
    expect(queries).toContain('SELECT * FROM "users" TABLESAMPLE SYSTEM (1) LIMIT 5');
    expect(queries.some(sql => sql.includes('SELECT * FROM users '))).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
