import { generateText, stepCountIs } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { dbTools } from '../tools/db';
import { chartTools } from '../tools/chart';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function testLLM() {
  console.log('--- Starting LLM Integration Test ---');
  
  const semanticLayer = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src/lib/semantic-layer.json'), 'utf8')
  );
  
  const question = "统计不同品类的订单量，只要 Electronics 品类，按订单量降序排列。显示前5名。";
  console.log(`Question: ${question}`);


  try {
    const response = await generateText({
      model: deepseek('deepseek-chat'),
      tools: { semanticQuery: dbTools.semanticQuery }, // 仅提供 semanticQuery 强制使用
      stopWhen: stepCountIs(5),

      system: `你是一个顶级的数据分析专家。
      
      ### 任务
      请基于语义层定义回答用户问题。
      
      ### 强制规则
      1. **语义优先**：优先检查语义层中的认证指标 (Metrics) 和维度 (Dimensions)。
      2. **禁止直接写 SQL**：如果用户问题可以由语义层覆盖，必须调用 semanticQuery 并生成结构化的 QueryPlan。
      3. **QueryPlan 规范**：必须包含正确的 metric id 和 dimension id。
      
      ### 示例
      问：上个月各国家的销售额是多少？
      答：调用 semanticQuery(plan: { metrics: [{id: "sales_amount"}], dimensions: [{id: "user_country"}], timeRange: {type: "preset", value: "last_month"} })
      
      ### 语义层定义
      ${JSON.stringify(semanticLayer, null, 2)}`,


      prompt: question,
    });

    console.log('\n--- Final Response ---');
    console.log(response.text);
    
    console.log('\n--- Tool Execution Trace ---');
    response.steps.forEach((step, i) => {
      console.log(`\n[Step ${i + 1}]`);
      step.toolCalls.forEach(tc => {
        const input = (tc as any).input;
        console.log(`  Tool: ${tc.toolName}`);
        console.log(`  Args: ${JSON.stringify(input, null, 2)}`);

        // 处理过滤器
        const args = input as any;
        if (args.plan && args.plan.filters) {
          args.plan.filters.forEach((f: any) => {
            const dim = semanticLayer.dimensions[f.field];
            const actualField = dim ? dim.column : f.field;
            console.log(`  Filter Applied: ${actualField} ${f.operator} ${f.value}`);
          });
        }
      });

      
      step.toolResults.forEach(tr => {
        const result = (tr as any).result;
        if (!result) {
          console.log(`  Result: (null/undefined)`);
          return;
        }
        if (result.error) {
          console.log(`  Result Error: ${result.error}`);
        } else if (tr.toolName === 'semanticQuery') {
          console.log(`  Result: Success (${result.rowCount ?? 0} rows)`);
          console.log(`  Compiled SQL: ${result.audit?.sql}`);
        } else {
          const str = JSON.stringify(result);
          console.log(`  Result: ${str.substring(0, 100)}${str.length > 100 ? '...' : ''}`);
        }
      });


    });

  } catch (error: any) {
    console.error('\n[FATAL ERROR]', error.message);
  }
}

testLLM();
