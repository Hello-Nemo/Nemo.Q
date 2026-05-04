import { dataAgent } from '../src/lib/agent';
import dotenv from 'dotenv';
dotenv.config();

async function testPhase2() {
  const questions = [
    "我想看下各个国家的客单价 (AOV) 是多少？",
    "按年龄段 (Age Group) 统计一下最近一个月的订单量。",
    "对比一下最近一个月和上个月的销售额变化。"
  ];

  for (const q of questions) {
    console.log(`\n\n=== Testing: ${q} ===`);
    const { output, steps } = await dataAgent.generate({
      prompt: [{ role: 'user', content: q }],
    });

    steps.forEach((step, idx) => {
      console.log(`\n--- Step ${idx + 1} ---`);
      step.toolCalls?.forEach(call => {
        console.log(`Tool Call: ${call.toolName}`);
        console.log(`Args: ${JSON.stringify((call as any).input || (call as any).args, null, 2)}`);
      });
      step.toolResults?.forEach(result => {
        const res = (result as any).output || (result as any).result;
        if (result.toolName === 'semanticQuery' && res && (res as any).audit) {
          console.log(`Generated SQL: ${(res as any).audit.sql}`);
        }
      });
    });

    console.log(`\nFinal Response:\n${output}`);
  }
}

testPhase2().catch(console.error);
