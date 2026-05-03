import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { PostgresDataSource } from '../src/lib/db-connector';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const projectName = process.argv[2] || 'default';
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('错误: 未设置 DATABASE_URL 环境变量');
    process.exit(1);
  }

  console.log(`🚀 开始为项目 [${projectName}] 构建业务语义层...`);

  const ds = new PostgresDataSource(dbUrl);
  
  try {
    // 1. 获取基础 Schema
    console.log('   - 正在扫描物理 Schema...');
    const schemaInfo = await ds.getSchema();
    const tables = Object.keys(schemaInfo.tables);

    const tablesWithSamples: any[] = [];

    // 2. 采样数据
    for (const table of tables) {
      console.log(`   - 正在采样表: ${table}...`);
      const samples = await ds.getTableSamples(table);
      tablesWithSamples.push({
        tableName: table,
        columns: schemaInfo.tables[table].columns,
        samples: samples.rows
      });
    }

    // 3. 调用 LLM 生成描述
    console.log('   - 正在调用 LLM 进行语义推导 (DeepSeek)...');
    const { text } = await generateText({
      model: deepseek('deepseek-v4-flash'),
      system: `你是一个资深的数据仓库专家。
你的任务是根据数据库的物理结构和真实采样数据，为用户生成一份高质量的“业务语义层”配置文件 (JSON)。

你需要：
1. 为每个表和字段生成准确的中文业务描述。
2. 识别表之间的潜在关联关系 (Join Paths)。
3. 根据数据内容建议合理的业务指标和预警阈值。
4. 编写 2-3 个典型的 Few-shot SQL 示例。

输出必须是一个纯 JSON 对象，格式如下：
{
  "tables": { "table_name": { "description": "...", "columns": { "col_name": "业务含义" } } },
  "metrics": { "指标名": "口径定义" },
  "common_queries": [ { "question": "...", "sql": "...", "explanation": "..." } ],
  "join_paths": [ { "tables": ["a", "b"], "on": "a.id = b.a_id", "description": "..." } ]
}`,
      prompt: `以下是数据库的结构和采样数据：
${JSON.stringify(tablesWithSamples, null, 2)}

请基于以上信息生成语义层 JSON。请注意：
- **深度语义推导**：即使数据库缺乏注释（Comment），你也必须通过字段名（如 \`joined_at\`）和采样数据（如 \`2024-05-01\`）推断其真实的业务含义。
- **枚举值识别**：如果字段包含 'status', 'type' 或数字编码，请根据采样数据推断其可能的业务枚举含义（例如：1代表已支付，0代表待支付）。
- **关联关系猜测**：基于命名约定（如 id 与 xxx_id）和采样数据的一致性，识别表与表之间的逻辑外键。`,
    });

    // 4. 清洗并保存结果
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const outputPath = path.join(process.cwd(), `src/lib/semantic/${projectName}.json`);
    
    if (!fs.existsSync(path.join(process.cwd(), 'src/lib/semantic'))) {
      fs.mkdirSync(path.join(process.cwd(), 'src/lib/semantic'), { recursive: true });
    }

    fs.writeFileSync(outputPath, jsonStr);
    console.log(`✅ 语义层构建完成！文件已保存至: ${outputPath}`);

  } catch (error) {
    console.error('❌ 构建过程中发生错误:', error);
  } finally {
    await ds.close();
  }
}

bootstrap();
