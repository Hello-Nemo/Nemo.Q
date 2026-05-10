import pg from 'pg';

export interface TableColumn {
  column: string;
  type: string;
  business_description: string;
}

export interface TableMetadata {
  description: string;
  columns: TableColumn[];
}

export interface SchemaInfo {
  tables: Record<string, TableMetadata>;
  business_metrics?: any;
  common_queries?: any;
  join_paths?: any;
}

export interface QueryResult {
  rowCount: number;
  rows: any[];
  message?: string;
  error?: string;
}

export interface IDataSource {
  getSchema(schema?: string): Promise<SchemaInfo>;
  executeQuery(sql: string): Promise<QueryResult>;
  getTableSamples(tableName: string): Promise<QueryResult>;
  close(): Promise<void>;
}

export class PostgresDataSource implements IDataSource {
  private pool: pg.Pool;
  private semanticLayer: any;

  constructor(connectionString: string, semanticLayer: any = {}) {
    this.pool = new pg.Pool({ 
      connectionString,
      statement_timeout: 30000 // 强制 30s 超时保护
    });
    this.semanticLayer = semanticLayer;
  }

  async getSchema(schema: string = 'public'): Promise<SchemaInfo> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(
        `SELECT table_name, column_name, data_type 
         FROM information_schema.columns 
         WHERE table_schema = $1 
         ORDER BY table_name, ordinal_position`,
        [schema]
      );
      
      const tables: Record<string, TableMetadata> = {};
      res.rows.forEach(row => {
        const tableName = row.table_name;
        if (!tables[tableName]) {
          tables[tableName] = {
            description: this.semanticLayer.tables?.[tableName]?.description || '无表描述',
            columns: []
          };
        }
        
        tables[tableName].columns.push({
          column: row.column_name,
          type: row.data_type,
          business_description: this.semanticLayer.tables?.[tableName]?.columns?.[row.column_name] || '无字段描述'
        });
      });
      
      return { 
        tables,
        business_metrics: this.semanticLayer.metrics,
        common_queries: this.semanticLayer.common_queries,
        join_paths: this.semanticLayer.join_paths
      };
    } finally {
      client.release();
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    // 强制增加 LIMIT 保护（如果 SQL 中没有聚合操作且没有 LIMIT）
    let safeSql = sql.trim();
    const isSelect = safeSql.toLowerCase().startsWith('select');
    const hasLimit = safeSql.toLowerCase().includes('limit');
    const isAggregation = /count\(|sum\(|avg\(|max\(|min\(|group by/i.test(safeSql);

    if (isSelect && !hasLimit && !isAggregation) {
      safeSql = `${safeSql.replace(/;?$/, '')} LIMIT 1000`;
    }

    const client = await this.pool.connect();
    try {
      const res = await client.query(safeSql);
      return { 
        rowCount: res.rowCount || 0,
        rows: res.rows.slice(0, 100),
        message: (res.rowCount ?? 0) > 100 ? '仅显示前 100 条结果（SQL 底层已执行 LIMIT 1000 保护）。' : undefined
      };
    } catch (error: any) {
      return { rowCount: 0, rows: [], error: error.message };
    } finally {
      client.release();
    }
  }

  async getTableSamples(tableName: string): Promise<QueryResult> {
    const client = await this.pool.connect();
    try {
      // 针对大表使用 TABLESAMPLE (Postgres 特有)
      // 先尝试 TABLESAMPLE，如果失败（如表太小或不支持）则回退到普通 LIMIT
      try {
        const res = await client.query(`SELECT * FROM ${tableName} TABLESAMPLE SYSTEM (1) LIMIT 5`);
        const rowCount = res.rowCount ?? 0;
        if (rowCount > 0) {
          return { rowCount, rows: res.rows };
        }
      } catch (e) {
        // 回退逻辑
      }
      
      const res = await client.query(`SELECT * FROM ${tableName} LIMIT 5`);
      return { rowCount: res.rowCount || 0, rows: res.rows };
    } catch (error: any) {
      return { rowCount: 0, rows: [], error: error.message };
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
