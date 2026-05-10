---
name: nemo-q
description: 拥有“金融级严谨”分析能力的专业数据智能体。使用 nemo-q CLI 进行所有数据库和语义层操作。
author: Nemo
version: "1.0.0"
tags:
  - data-analysis
  - sql
  - semantic-layer
  - postgres
---

**Binary:** `tsx skills/nemo-q/cli.ts`

> **AI Agent Tip:** Always use your command execution tool (e.g., `run_command`) to invoke the `nemo-q` CLI. Use `--json` for structured output.

**Protocols:** SSOR Workflow, SQL_AUDIT, SELF_HEALING

## 核心思维架构：SSOR 工作流

在执行分析任务前，你必须遵循以下标准化作业程序 (SOP)：

1. **SCAN (扫描)**：通过 `nemo-q schema` 和 `nemo-q atoms` 了解当前数据库结构。严禁基于记忆假设字段。
2. **DIAGNOSE (诊断)**：识别核心指标与维度。
   - 若口径存在歧义，调用 `nemo-q clarify` 提供备选项。
   - 调用后必须立即停止所有后续输出，等待用户动作。
3. **OPERATE (意图查询)**：
   - **先口径，后时间**：确认口径后再解析时间。
   - **优先使用语义查询**：调用 `nemo-q query`。
   - **PREVIEW 强制触发**：多表关联或同比/环比时，先调用 `nemo-q preview`。
4. **REPORT (报告)**：输出真相洞察。使用 `render_chart` 可视化。

## 指令参考 (Command Reference)

| Command   | Description                   | Example                                                              |
| --------- | ----------------------------- | -------------------------------------------------------------------- |
| `schema`  | 获取数据库表结构              | `nemo-q schema '{"schema":"public"}'`                                |
| `atoms`   | 检索语义资产 (指标/维度)      | `nemo-q atoms '{"keyword":"收入"}'`                                  |
| `query`   | 执行标准语义查询              | `nemo-q query '{"explanation":"...","plan":{...}}'`                  |
| `sql`     | 执行原生 SQL (需符合审计协议) | `nemo-q sql '{"sql":"...","explanation":"...","assumptions":[...]}'` |
| `samples` | 获取表随机样本                | `nemo-q samples '{"tableName":"orders"}'`                            |
| `preview` | 预览查询逻辑 (不执行)         | `nemo-q preview '{"explanation":"...","plan":{...}}'`                |
| `preview` | 预览查询逻辑 (不执行)         | `nemo-q preview '{"explanation":"...","plan":{...}}'`                |

## 核心协议 (Critical Protocols)

### <SYSTEM_CRITICAL_INSTRUCTION>

在处理任何取数请求前，必须先执行【口径对齐】。
若用户提及“收入”、“GMV”、“利润”、“用户数”等敏感口径，但其表述与语义层 ID 不存在 100% 精确匹配，必须进行口径对齐
</SYSTEM_CRITICAL_INSTRUCTION>

### <SQL_AUDIT> 协议

调用 `sql` 命令时，必须提供高水准的 `explanation` 和 `assumptions`。严禁使用占位符。

### <SELF_HEALING_PROTOCOL>

若命令返回 SQL 错误，必须分析错误原因并结合 `schema` 修正后重试 **一次**。

### <PRECISION_INSIGHTS_PROTOCOL>

输出结果后，必须提供 `[核心发现]`, `[异常诊断]`, `[行动建议]`。
