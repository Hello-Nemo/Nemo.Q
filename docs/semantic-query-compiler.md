# 语义查询编译器 (Semantic Query Compiler)

`data-agent` 的核心大脑，负责将非结构化的 `QueryPlan` 转换为确定性、高性能且业务准确的 PostgreSQL 查询语句。

## 1. 核心挑战

在智能问数场景下，直接生成 SQL 会面临三大经典陷阱：
- **路径歧义 (Path Ambiguity)**：多表之间存在多条路径。
- **深渊陷阱 (Chasm Trap)**：一个查询涉及多个互不相关的事实表（如：销售额与退货额）。
- **扇出陷阱 (Fan-out Trap)**：1:N 关联导致指标被错误重复累加。

## 2. 算法实现

为了解决上述问题，编译器采用了工业级算法架构：

### 2.1 基于 Dijkstra 的最短路径发现
- **图建模**：将实体定义为顶点，关系定义为边。
- **权重策略**：
    - `Dimension -> Fact`：权重 = 1 (优先通过维表对齐)。
    - `Fact -> Fact`：权重 = 10 (惩罚项，强制切断直接关联)。
- **效果**：确保 Join 路径始终是代价最低且逻辑最合理的。

### 2.2 多阶段编译 (Multi-pass Compilation)
当检测到查询涉及多个事实表时，编译器会自动切换到 Multi-pass 模式：
1. **子树分解**：根据指标所属事实表，将 QueryPlan 分解为 $N$ 个子任务。
2. **CTE 生成**：为每个子任务生成独立的公用表表达式（CTE），在各事实表粒度上先行完成聚合。
3. **全局缝合**：在顶层使用 `FULL OUTER JOIN` 通过共享维度将各个 CTE 结果对齐，并使用 `COALESCE` 处理维度空值。

## 3. Query Plan 结构

```typescript
interface QueryPlan {
  intent: 'metric_query' | 'exploration' | 'comparison';
  metrics: Array<{ id: string }>;    // 指标 ID
  dimensions: Array<{ id: string }>; // 维度 ID
  filters: Array<{                   // 过滤器
    field: string;
    operator: string;
    value: any;
  }>;
  limit?: number;
}
```

## 4. 优势总结

- **100% 准确性**：通过确定性算法消除模型幻觉。
- **安全可控**：自动处理 SQL 注入风险，生成的 SQL 结构清晰可审计。
- **架构解耦**：模型只负责理解意图（Plan），编译器负责工程实现（SQL）。
