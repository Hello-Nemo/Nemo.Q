# Data-Agent 产品与技术文档

## 1. 产品概览
Data-Agent 是一个基于语义层的智能问数平台，区别于传统看板和 SQL 模板系统。核心价值在于:
- 自然语言提问
- 语义解析指标与维度
- 动态生成 SQL 并校验
- 提供可信、可解释、多维分析结果
- 支持多轮追问、澄清、归因与可视化

## 2. 产品模块

### 2.1 自然语言接口
- 用户通过 WebUI 或 API 提问
- 支持推荐问题、历史会话、收藏问法
- 可多轮交互

### 2.2 Query Plan 生成
- LLM 将用户问题解析为结构化 Query Plan
- Query Plan 包括指标、维度、时间范围、过滤条件、分析动作
- Query Plan 是 SQL 生成的中间表示

### 2.3 语义层
- 定义指标、维度、实体、关系、规则
- 支持指标计算公式、默认时间字段、可组合维度、权限和口径版本
- 动态解析 Query Plan

### 2.4 SQL 编译与执行
- Query Plan -> SQL AST -> SQL 查询
- 自动推导 join 路径、GROUP BY、WHERE、ORDER BY、LIMIT
- SQL Guard 做安全、权限、成本校验
- 执行查询并返回结构化结果、审计信息、口径说明

### 2.5 澄清与拒答机制
- 对歧义、权限不足、口径不清问题触发 Clarification
- 支持用户选择选项或人工干预
- 保证认证问题 100% 准确，非认证问题静默错答率为 0

### 2.6 可视化与分析
- 支持表格、折线图、柱状图、饼图等
- 支持 Insight Canvas 固定或动态展示分析结果
- 提供归因分析、趋势分析、异常检测

## 3. 技术架构
```
用户问题
  ↓
LLM -> Query Plan 生成
  ↓
语义层解析指标与维度
  ↓
Query Compiler -> SQL AST
  ↓
SQL Guard 校验安全与权限
  ↓
Execution Engine 执行 SQL
  ↓
结果验证与解释 -> 返回用户
```

### 3.1 Query Plan 示例
```json
{
  "intent": "metric_query",
  "metrics": [{"id": "sales_amount"}],
  "dimensions": [{"id": "user_country"}],
  "timeRange": {"type": "preset", "value": "last_month"},
  "filters": [],
  "orderBy": [{"field": "sales_amount", "direction": "desc"}],
  "limit": 100
}
```

### 3.2 语义层核心结构
- Entities: users, products, orders
- Metrics: sales_amount, order_count, average_order_value
- Dimensions: user_country, product_category, order_date
- Relationships: user->orders, product->orders
- Rules: low_stock_warning, high_value_order

### 3.3 SQL 编译器功能
- 根据 Query Plan 和语义层生成 SQL
- 自动处理 join、where、group by、order by、limit
- 生成可参数化 SQL，防止注入
- 返回审计信息、 lineage、执行假设

### 3.4 SQL Guard
- 校验只读、单语句、允许表/字段、时间范围
- 防止越权访问和高成本查询
- 与 executeQuery 工具协同

## 4. 开发与迭代计划
1. Phase 0: 工程收敛与基础测试
2. Phase 1: 认证问题 100% 准确实现
3. Phase 2: 语义层产品化与 Query Plan 扩展
4. Phase 3: 受控探索分析与归因分析增强
5. Phase 4: 企业级治理、权限、多数据源、审计与回归门禁

## 5. 关键设计原则
- 高频问题使用认证原子保证 100% 准确
- 自由探索问题使用 Query Plan + SQL Guard 保证灵活性与安全
- 澄清机制保证非认证问题不静默错答
- SQL 模板仅用于极少数高风险场景，不作为核心能力
- 所有执行均可审计、可追溯、可回归测试