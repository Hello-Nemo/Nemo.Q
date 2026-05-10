import fs from 'fs';
import path from 'path';
import { dataAgent } from '../src/lib/agent';

interface TestCase {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  gold_sql: string;
  criteria: string;
  expectedBehavior?: 'sql' | 'semantic_gap';
}

async function runEval() {
  const datasetPath = path.join(process.cwd(), 'tests/eval/dataset.json');
  const dataset: TestCase[] = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  console.log(`\n🚀 开始评测：共 ${dataset.length} 个测试用例\n`);

  let totalScore = 0;
  const results = [];

  for (const testCase of dataset) {
    console.log(`[${testCase.id}] 正在测试: ${testCase.question} (${testCase.difficulty})`);
    
    try {
      const { output, steps } = await dataAgent.generate({
        prompt: [{ role: 'user', content: testCase.question }],
      });

      // 提取生成的 SQL
      let generatedSql = '';
      let semanticTrace = '';
      let hasError = false;
      let usedSampling = false;
      let executedSql = false;
      let usedClarification = false;
      let usedSemanticAtoms = false;
      let hasSemanticGap = false;
      const stepSummary: string[] = [];

      steps.forEach((step, idx) => {
        const toolNames = step.toolCalls?.map(c => c.toolName).join(', ') || '无工具调用';
        stepSummary.push(`Step ${idx + 1}: ${toolNames}`);

        step.toolCalls?.forEach(call => {
          const args = (call as any).input || (call as any).args;
          console.log(`[DEBUG] Tool called: ${call.toolName}`, JSON.stringify(args, null, 2));
          if (call.toolName === 'executeQuery') {
            if (args) generatedSql = args.sql;
            executedSql = true;
          }
          if (call.toolName === 'semanticQuery' || call.toolName === 'previewQueryPlan') {
            if (args && args.plan) {
              // 标记使用了语义查询，但不要把 QueryPlan 当成已生成/已执行 SQL。
              semanticTrace += ` [${call.toolName}: ${JSON.stringify(args.plan)}]`;
            }
          }
          if (call.toolName === 'askClarification') usedClarification = true;
          if (call.toolName === 'listSemanticAtoms') usedSemanticAtoms = true;
          if (call.toolName === 'getTableSamples') {
            usedSampling = true;
          }
        });

        step.toolResults?.forEach(result => {
          const res = (result as any).output || (result as any).result;
          if (result.toolName === 'askClarification') usedClarification = true;
          if (result.toolName === 'listSemanticAtoms') usedSemanticAtoms = true;

          // 尝试从审计信息或直接结果中提取生成的 SQL 用于校验
          if ((result.toolName === 'semanticQuery' || result.toolName === 'previewQueryPlan') && res) {
            if ((res as any).audit && (res as any).audit.sql) {
              generatedSql = (res as any).audit.sql;
              executedSql = result.toolName === 'semanticQuery' || executedSql;
            } else if ((res as any).sql) {
              generatedSql = (res as any).sql;
            }
            if (
              (res as any).code === 'SEMANTIC_COMPILATION_FAILED' ||
              /未知(指标|维度|过滤字段)|语义层未覆盖/.test(JSON.stringify(res))
            ) {
              hasSemanticGap = true;
            }
          }

          if (res && (res as any).error) {
            stepSummary[idx] += ` (Error: ${(res as any).error})`;
            if (result.toolName === 'executeQuery' || result.toolName === 'semanticQuery') {
              hasError = true;
            }
          }
        });
      });

      // 评分逻辑 (简单启发式)
      let score = 0;
      const reasons = [];
      const expectedBehavior = testCase.expectedBehavior || 'sql';
      const outputText = String(output || '');
      const evaluationText = [
        generatedSql,
        semanticTrace,
        stepSummary.join(' '),
        outputText
      ].join(' ');
      const criteriaParts = testCase.criteria.split('|');
      const matchesCriteria = criteriaParts.every(part => {
        // 如果 part 包含 / 则视为可选 (OR)
        const subParts = part.split('/');
        return subParts.some(sp => evaluationText.toLowerCase().includes(sp.toLowerCase()));
      });

      if (expectedBehavior === 'semantic_gap') {
        if (!executedSql) {
          score += 40;
          reasons.push('未执行 SQL');
        } else {
          reasons.push('错误执行了 SQL');
        }

        if (
          hasSemanticGap ||
          usedClarification ||
          /语义层未覆盖|未知指标|澄清|不存在|未定义/.test(outputText)
        ) {
          score += 40;
          reasons.push('触发语义层缺口处理');
        } else {
          reasons.push('未触发语义层缺口处理');
        }

        if (matchesCriteria) {
          score += 20;
          reasons.push('负向口径匹配');
        } else {
          reasons.push('负向口径缺失');
        }
      } else {
        if (generatedSql) {
          score += 40;
          reasons.push('成功生成 SQL');
        } else {
          reasons.push('未生成 SQL');
        }

        if (generatedSql && !hasError) {
          score += 30;
          reasons.push('SQL 执行成功');
        } else if (hasError) {
          reasons.push('SQL 执行报错');
        }

        // 关键字匹配校验
        if (evaluationText.trim()) {
          if (matchesCriteria) {
            score += 30;
            reasons.push('关键口径匹配');
          } else {
            reasons.push('关键口径缺失');
          }
        }
      }

      if (usedSampling) {
        score += 5; // 奖励分：主动使用了采样工具
        reasons.push('主动进行了数据采样');
      }

      score = Math.min(score, 100);
      totalScore += score;
      results.push({
        id: testCase.id,
        question: testCase.question,
        score,
        reasons,
        generatedSql,
        semanticTrace,
        executedSql,
        usedClarification,
        usedSemanticAtoms,
        hasSemanticGap
      });

      console.log(`   - 步骤: ${stepSummary.join(' -> ')}`);
      console.log(`   - 回答: ${(output as any).substring(0, 100)}...`);
      console.log(`   - 评分: ${score}/100 | ${reasons.join(', ')}`);

    } catch (e: any) {
      console.error(`   - 失败: ${e.message}`);
      results.push({ id: testCase.id, question: testCase.question, score: 0, error: e.message });
    }
    console.log('--------------------------------------------------');
  }

  const finalScore = totalScore / dataset.length;
  console.log(`\n✅ 评测完成！平均分: ${finalScore.toFixed(2)} / 100\n`);

  // 输出报告文件
  const reportPath = path.join(process.cwd(), 'tests/eval/report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    averageScore: finalScore,
    results
  }, null, 2));
  console.log(`报告已保存至: ${reportPath}`);
}

runEval().catch(console.error);
