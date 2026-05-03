import readline from 'readline';
import { dataAgent } from '../src/lib/agent';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  console.log('--- 智能问数 Agent (DeepSeek + PostgreSQL) ---');
  console.log('输入你的问题 (输入 "exit" 退出):');

  const askQuestion = () => {
    rl.question('> ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      try {
        console.log('\nAgent 正在思考并执行任务...\n');
        
        const { output, steps } = await dataAgent.generate({
          prompt: [{ role: 'user', content: input }],
        });

        // 打印执行步骤（可选，用于调试或展示过程）
        steps.forEach((step, index) => {
          console.log(`[步骤 ${index + 1}]`);
          if (step.toolCalls) {
            step.toolCalls.forEach(call => {
              console.log(`  - 调用工具: ${call.toolName}`);
              console.log(`    参数: ${JSON.stringify((call as any).args)}`);
            });
          }
          if (step.toolResults) {
             step.toolResults.forEach(result => {
               console.log(`  - 工具结果: ${result.toolName} 已完成`);
             });
          }
        });

        console.log('\n--- 回答 ---');
        console.log(output);
        console.log('------------\n');

      } catch (error) {
        console.error('发生错误:', error);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error);
