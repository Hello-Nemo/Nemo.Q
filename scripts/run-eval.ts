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
  expectedBehavior?: 'sql' | 'semantic_gap' | 'semantic_required' | 'direct_sql_allowed';
  expectedTools?: string[];
  forbiddenTools?: string[];
  sqlContains?: string[];
}

async function runEval() {
  const datasetPath = path.join(process.cwd(), 'src/lib/eval/dataset.json');
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
      let usedExecuteQuery = false;
      let usedSemanticQuery = false;
      let usedAnalysisQuery = false;
      let usedClarification = false;
      let usedSemanticAtoms = false;
      let hasSemanticGap = false;
      let semanticCoverageBlocked = false;
      let usedPreviewQueryPlan = false;
      const stepSummary: string[] = [];

      steps.forEach((step, idx) => {
        const toolNames = step.toolCalls?.map(c => c.toolName).join(', ') || '无工具调用';
        stepSummary.push(`Step ${idx + 1}: ${toolNames}`);

        step.toolCalls?.forEach(call => {
          const args = (call as any).input || (call as any).args;
          console.log(`[DEBUG] Tool called: ${call.toolName}`, JSON.stringify(args, null, 2));
          if (call.toolName === 'executeQuery') {
            if (args && (!generatedSql || !usedSemanticQuery)) generatedSql = args.sql;
            executedSql = true;
            usedExecuteQuery = true;
          }
          if (call.toolName === 'semanticQuery' || call.toolName === 'previewQueryPlan' || call.toolName === 'analysisQuery') {
            if (call.toolName === 'semanticQuery') usedSemanticQuery = true;
            if (call.toolName === 'previewQueryPlan') usedPreviewQueryPlan = true;
            if (call.toolName === 'analysisQuery') usedAnalysisQuery = true;
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
          if (result.toolName === 'semanticQuery') usedSemanticQuery = true;
          if (result.toolName === 'previewQueryPlan') usedPreviewQueryPlan = true;
          if (result.toolName === 'analysisQuery') usedAnalysisQuery = true;

          // 尝试从审计信息或直接结果中提取生成的 SQL 用于校验
          if ((result.toolName === 'semanticQuery' || result.toolName === 'previewQueryPlan' || result.toolName === 'analysisQuery') && res) {
            if ((res as any).audit && (res as any).audit.sql) {
              generatedSql = (res as any).audit.sql;
              executedSql = result.toolName === 'semanticQuery' || result.toolName === 'analysisQuery' || executedSql;
            } else if ((res as any).sql) {
              generatedSql = (res as any).sql;
            }
            if (
              (res as any).code === 'SEMANTIC_COMPILATION_FAILED' ||
              (res as any).code === 'ANALYSIS_COMPILATION_FAILED' ||
              /未知(指标|维度|过滤字段)|语义层未覆盖/.test(JSON.stringify(res))
            ) {
              hasSemanticGap = true;
            }
          }

          if (res && (res as any).error) {
            stepSummary[idx] += ` (Error: ${(res as any).error})`;
            if ((res as any).code === 'SEMANTIC_COVERAGE_REQUIRED') {
              semanticCoverageBlocked = true;
            }
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
      const queryPath = usedSemanticQuery
        ? 'semantic'
        : usedAnalysisQuery
          ? 'analysis_template'
        : usedPreviewQueryPlan
          ? 'semantic_preview'
        : semanticCoverageBlocked
          ? 'blocked_direct_sql'
        : usedExecuteQuery
          ? 'direct_sql'
          : 'none';
      const evaluationText = [
        generatedSql,
        semanticTrace,
        queryPath,
        usedSemanticQuery ? 'semanticQuery' : '',
        usedPreviewQueryPlan ? 'previewQueryPlan semanticQuery' : '', // 补齐关键字
        stepSummary.join(' '),
        outputText
      ].join(' ');
      
      const criteriaParts = testCase.criteria.split('|');
      const matchesCriteria = criteriaParts.every(part => {
        // 如果 part 包含 / 则视为可选 (OR)
        const subParts = part.split('/');
        return subParts.some(sp => evaluationText.toLowerCase().includes(sp.toLowerCase()));
      });

      // 1. 基础行为验证 (50分)
      if (expectedBehavior === 'semantic_required') {
        if ((usedSemanticQuery || usedPreviewQueryPlan) && !usedExecuteQuery) {
          score += 30;
          reasons.push('使用语义工具');
        } else if (semanticCoverageBlocked) {
          score += 20;
          reasons.push('直连 SQL 被语义拦截');
        }
        if (usedSemanticAtoms || usedSemanticQuery || usedPreviewQueryPlan || semanticCoverageBlocked) {
          score += 20;
          reasons.push('触发语义路径');
        }
      } else if (expectedBehavior === 'direct_sql_allowed') {
        if (usedExecuteQuery && !semanticCoverageBlocked && !hasError) {
          score += 30;
          reasons.push('允许 executeQuery');
        }
        if (!usedSemanticQuery) {
          score += 20;
          reasons.push('未强制转语义');
        }
      } else if (expectedBehavior === 'semantic_gap') {
        if (!executedSql) {
          score += 25;
          reasons.push('未执行 SQL');
        }
        if (hasSemanticGap || usedClarification || /语义层未覆盖|未知指标|澄清|不存在|未定义/.test(outputText)) {
          score += 25;
          reasons.push('触发缺口处理');
        }
      } else {
        if (generatedSql) {
          score += 30;
          reasons.push('生成 SQL');
        }
        if (generatedSql && !hasError) {
          score += 20;
          reasons.push('执行成功');
        }
      }

      // 2. 关键口径匹配 (20分)
      if (matchesCriteria) {
        score += 20;
        reasons.push('口径匹配');
      } else {
        reasons.push('口径缺失');
      }

      // 3. 工具使用验证 (15分)
      const allCalledTools = steps.flatMap(s => s.toolCalls?.map(c => c.toolName) || []);
      if (testCase.expectedTools) {
        const metExpected = testCase.expectedTools.every(t => {
          if (t === 'semanticQuery') {
            return allCalledTools.includes('semanticQuery') || allCalledTools.includes('previewQueryPlan');
          }
          return allCalledTools.includes(t);
        });
        if (metExpected) {
          score += 10;
          reasons.push('预期工具已调用');
        } else {
          reasons.push('缺失预期工具');
        }
      } else {
        score += 10; // 默认给分
      }

      if (testCase.forbiddenTools) {
        const usedForbidden = testCase.forbiddenTools.some(t => allCalledTools.includes(t));
        if (!usedForbidden) {
          score += 5;
          reasons.push('无违禁工具');
        } else {
          reasons.push('使用了违禁工具');
        }
      } else {
        score += 5; // 默认给分
      }

      // 4. SQL 内容深度验证 (15分)
      if (testCase.sqlContains) {
        const containsAll = testCase.sqlContains.every(snippet => 
          generatedSql.toLowerCase().includes(snippet.toLowerCase())
        );
        if (containsAll) {
          score += 15;
          reasons.push('SQL 内容验证通过');
        } else {
          reasons.push('SQL 内容缺失关键片段');
        }
      } else {
        score += 15; // 默认给分
      }

      if (usedSampling) {
        score += 5; // 额外奖励
        reasons.push('主动采样');
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
        hasSemanticGap,
        usedExecuteQuery,
        usedSemanticQuery,
        usedAnalysisQuery,
        semanticCoverageBlocked,
        queryPath
      });

      console.log(`   - 步骤: ${stepSummary.join(' -> ')}`);
      console.log(`   - 回答: ${outputText.substring(0, 100).replace(/\n/g, ' ')}...`);
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
  const reportPath = path.join(process.cwd(), 'src/lib/eval/report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    averageScore: finalScore,
    results
  }, null, 2));
  console.log(`报告已保存至: ${reportPath}`);

  // 质量门禁 (Quality Gate)
  const THRESHOLD = 85;
  if (finalScore < THRESHOLD) {
    console.error(`❌ 质量门禁未通过: 平均分 ${finalScore.toFixed(2)} 低于阈值 ${THRESHOLD}`);
    process.exit(1);
  } else {
    console.log(`🎉 质量门禁通过！平均分 ${finalScore.toFixed(2)} >= ${THRESHOLD}`);
  }
}

runEval().catch((err) => {
  console.error(err);
  process.exit(1);
});
