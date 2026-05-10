import { dbTools } from './lib/db';
import { QueryPlan } from './lib/semantic/types';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const paramsStr = args[1] || '{}';
  const isJson = args.includes('--json');

  const output = (data: any, ok: boolean = true, error?: string) => {
    const result = {
      ok,
      schema_version: "1",
      data: ok ? data : undefined,
      error: ok ? undefined : { message: error || 'Unknown error' }
    };
    console.log(JSON.stringify(result, null, 2));
  };

  try {
    let params: any = {};
    try {
      // 尝试解析 JSON 参数，如果不是 JSON 则视为第一个非 flag 参数
      if (paramsStr.startsWith('{')) {
        params = JSON.parse(paramsStr);
      }
    } catch (e) {
      // 忽略解析错误
    }

    switch (command) {
      case 'schema': {
        const schema = params.schema || 'public';
        const result = await dbTools.getSchema.execute({ schema });
        output(result);
        break;
      }
      case 'atoms': {
        const result = await dbTools.listSemanticAtoms.execute({
          type: params.type || 'all',
          keyword: params.keyword,
          limit: params.limit || 20,
          offset: params.offset || 0
        });
        output(result);
        break;
      }
      case 'query': {
        if (!params.plan || !params.explanation) {
          throw new Error('Missing required params: plan, explanation');
        }
        const result = await dbTools.semanticQuery.execute({
          plan: params.plan as QueryPlan,
          explanation: params.explanation
        });
        output(result);
        break;
      }
      case 'sql': {
        if (!params.sql || !params.explanation || !params.assumptions) {
          throw new Error('Missing required params: sql, explanation, assumptions');
        }
        const result = await dbTools.executeQuery.execute({
          sql: params.sql,
          explanation: params.explanation,
          assumptions: params.assumptions
        });
        output(result);
        break;
      }
      case 'samples': {
        if (!params.tableName) {
          throw new Error('Missing required param: tableName');
        }
        const result = await dbTools.getTableSamples.execute({
          tableName: params.tableName
        });
        output(result);
        break;
      }
      case 'preview': {
        if (!params.plan || !params.explanation) {
          throw new Error('Missing required params: plan, explanation');
        }
        const result = await dbTools.previewQueryPlan.execute({
          plan: params.plan as QueryPlan,
          explanation: params.explanation
        });
        output(result);
        break;
      }
      case 'help':
      default: {
        console.log(`
Nemo.Q CLI - Professional Data Agent Skill

Usage:
  tsx cli.ts <command> <json_params> [--json]

Commands:
  schema    Get database schema info. Params: { "schema": "public" }
  atoms     List semantic atoms. Params: { "type": "metrics"|"dimensions"|"all", "keyword": "...", "limit": 20 }
  query     Execute semantic query. Params: { "explanation": "...", "plan": { ... } }
  sql       Execute raw SQL with audit. Params: { "explanation": "...", "assumptions": [...], "sql": "..." }
  samples   Get table samples. Params: { "tableName": "..." }
  preview   Preview query plan logic. Params: { "explanation": "...", "plan": { ... } }

Example:
  tsx cli.ts schema '{"schema":"public"}' --json
        `);
        break;
      }
    }
  } catch (error: any) {
    output(null, false, error.message);
  }
}

main();
