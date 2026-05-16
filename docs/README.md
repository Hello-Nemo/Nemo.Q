# Data Agent 文档中心

本目录用于沉淀当前项目已经落地的产品、架构与演进资料。

## 文档索引

| 文档 | 说明 |
| --- | --- |
| [产品与技术概览](./data-agent-product-and-technical-docs.md) | 当前智能问数能力、模块划分与阶段性路线。 |
| [语义查询编译器](./semantic-query-compiler.md) | 从自然语言到 Query Plan，再到动态 SQL 编译的核心技术方案。 |
| [品牌规范](./brand-identity.md) | Nemo.Q 的命名、视觉与语调约束。 |
| [实施计划](./plans/2026-05-16-super-agent-runtime-implementation-plan.md) | Super Agent Runtime 第一阶段实施方案。 |

## 核心共识

`data-agent` 不应演进为“SQL 模板问答系统”，也不应让大模型裸写 SQL。目标架构是：

```text
自然语言问题
  ↓
Intent Planner
  ↓
Query Plan IR
  ↓
Semantic Resolver
  ↓
SQL Compiler
  ↓
SQL Guard
  ↓
Execution Engine
  ↓
Result Verifier
  ↓
Insight Generator
```

核心原则：

1. **智能体负责理解与规划，不直接承担最终 SQL 正确性。**
2. **语义层负责定义可组合的数据原子，包括指标、维度、实体、关系和规则。**
3. **动态 SQL 由确定性编译器生成，不由模型直接拼接。**
4. **高频标准问题追求 100% 正确，方式不是模板化，而是认证语义原子 + 编译验证。**
5. **非认证探索问题允许动态分析，但必须经过权限、安全、成本和结果校验。**
6. **无法确认口径的问题必须澄清、降级或拒答，禁止静默错答。**

## 当前工程基础

当前仓库已有以下基础能力：

- Next.js + React 前端工作台；
- Vercel AI SDK Agent 调用链路；
- PostgreSQL 数据源连接；
- `getSchema`、`getTableSamples`、`searchTables`、`executeQuery`、`askClarification`、`semanticQuery` 工具；
- **工业级 SQL 编译器**：支持 Dijkstra 最优路径发现与 Multi-pass (CTE) 聚合缝合，彻底解决 Chasm Trap 和 Fan-out 陷阱；
- SQL Audit 前端展示；
- Clarification Flow 前端交互；
- Insight Canvas 图表画布；
- 结构化 `semantic-layer.json` (支持 Fact/Dimension 实体类型)；
- 初版评测样例与报告：`tests/eval/dataset.json`、`tests/eval/report.json`。


后续演进重点是将这些能力从 Demo 链路升级为可验证、可治理、可评测的智能问数产品内核。
