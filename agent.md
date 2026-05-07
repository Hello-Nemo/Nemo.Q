# Nemo.Q Phase 6 Agent Guide

本文档给后续 Codex / coding agent 执行 Phase 6 平台化任务使用。它不是产品宣传文档，而是本仓库的实施约束、工程边界和 issue 执行规则。

## 当前仓库事实

- 应用：Next.js App Router + React，入口包含 `src/app/page.tsx` 和 `src/app/api/chat/route.ts`。
- Agent：`src/lib/agent.ts` 使用 AI SDK `ToolLoopAgent`，当前模型由 `@ai-sdk/deepseek` 驱动。
- Tool 主链路：`src/lib/tools/db.ts` 暴露 `getSchema`、`getTableSamples`、`searchTables`、`executeQuery`、`askClarification`、`semanticQuery`、`previewQueryPlan`、`confirmQueryPlan`、`cancelQueryPlan`、`listSemanticAtoms`。
- 语义层：`src/lib/semantic-layer.json` 和 `src/lib/semantic/*`，核心编译器是 `src/lib/semantic/compiler.ts`。
- SQL 安全：`src/lib/sql-guard/guard.ts` 已做 SELECT / WITH SELECT、allowlist、字段校验、默认 limit 等治理。
- 前端工作台：`src/app/page.tsx`、`src/components/*`，现有 Ask UI 包含推理流、SQL 审计、Clarification Flow、Insight Canvas、QueryPlan preview / confirm。
- 测试：`package.json` 当前 `pnpm test` 聚合 Vitest、semantic compiler、SQL Guard、query plan confirmation、analysis query、query plan UI 等测试。
- 当前仓库还没有 Prisma schema、BullMQ worker、MinIO ArtifactStore、Project Runtime 和平台后台目录。

## 固定技术决策

- Migration / ORM：Prisma
- Database：PostgreSQL
- Queue Backend：Redis
- Queue System：BullMQ
- Object Storage：MinIO，S3-compatible
- API Validation：Zod
- API Response：统一 envelope
- Package Manager：pnpm
- UI：沿用当前 Next.js App Router / React 组件体系

## Phase 6 基础约定

Prisma 约定：

- Schema：`prisma/schema.prisma`
- Migrations：`prisma/migrations/*`
- Client：`src/lib/db/prisma.ts`
- Seed：`prisma/seed.ts`

必须补充的脚本：

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  }
}
```

统一 API response：

```ts
export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

统一错误码：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `PERMISSION_DENIED`
- `PROJECT_NOT_FOUND`
- `DATA_SOURCE_NOT_FOUND`
- `CONTRACT_NOT_FOUND`
- `JOB_NOT_FOUND`
- `ARTIFACT_NOT_FOUND`
- `QUEUE_ERROR`
- `STORAGE_ERROR`
- `DATABASE_ERROR`

## 必须保留的主链路边界

- 不要新建一套平行 chat runtime。Project Runtime 必须接入 `src/app/api/chat/route.ts`、`src/lib/agent.ts`、`src/lib/tools/db.ts` 和 `src/lib/semantic/*`。
- 不要让 LLM 直接承担最终 SQL 正确性。标准指标查询必须优先走 `semanticQuery` / SQLCompiler。
- 不要绕过 `SQL Guard`。探索性 `executeQuery` 必须继续通过服务端 guard、allowlist、审计和语义覆盖检测。
- 不要用 Phase 6 DB 表替代当前 compiler。Prisma 管元数据、版本、审计、artifact 和平台状态；SQL 生成仍由确定性语义编译器负责。
- 不要记录 plaintext secrets。env、data source connection、job payload、logs、artifact metadata 都必须做 secret redaction。
- 不要把大对象塞进 PostgreSQL。完整 schema snapshot、join validation report、audit trace、briefing、export、eval report 等写 MinIO，数据库只存 metadata 和 artifactId。

## 推荐目录规划

Phase 6 新增代码优先放在这些目录：

```text
prisma/schema.prisma
prisma/seed.ts
src/lib/env.ts
src/lib/errors.ts
src/lib/logger.ts
src/lib/ids.ts
src/lib/time.ts
src/lib/validation.ts
src/lib/api/response.ts
src/lib/db/prisma.ts
src/lib/db/repositories/*
src/lib/runtime/*
src/lib/queue/*
src/lib/storage/*
src/lib/onboarding/*
src/lib/security/*
src/lib/observability/*
src/workers/index.ts
src/workers/jobs/*
src/app/api/*
src/app/admin/*
src/app/projects/*
```

## API 规则

- 所有新 API 使用 Zod 校验 request input。
- 所有新 API 返回统一 envelope。
- 错误 response 不泄露 connection string、API key、SQL credential、Redis URL、MinIO secret、LLM token。
- API route 要按 `src/app/api/.../route.ts` 实现。
- 新 API 的测试至少覆盖 validation error、happy path、关键失败路径。

## Queue 规则

基础队列名称：

- `schema.scan`
- `semantic.generateDraft`
- `semantic.validateJoinGraph`
- `semantic.publishContract`
- `insight.run`
- `briefing.run`
- `dataQuality.run`
- `eval.run`
- `feedback.classify`
- `export.generate`

所有 BullMQ job 必须：

- 使用 Zod 校验 payload。
- payload 带 `projectId`，除非是明确的全局维护任务。
- 创建 / 更新 `JobRun`。
- `attempts=3`。
- 使用 exponential backoff。
- 不记录 plaintext secrets。
- 失败时记录 redacted error。

## Artifact 规则

`ArtifactStore` 放在 `src/lib/storage/artifact-store.ts`，MinIO client 放在 `src/lib/storage/minio-client.ts`。

目标 API：

```ts
putJson(projectId, category, object, metadata)
putBuffer(projectId, category, buffer, metadata)
getSignedUrl(artifactId, expiresInSeconds)
getMetadata(artifactId)
```

Object key 格式：

```text
projects/{projectId}/{category}/{artifactId}.{ext}
```

Artifact metadata 存 PostgreSQL `ArtifactObject`，实际内容存 MinIO。

## UI 规则

- 沿用当前工作台气质，优先做可用的后台与项目工作流，不做营销页。
- 新后台页面建议从 `/admin/infrastructure`、`/admin/jobs`、`/admin/artifacts` 开始。
- 项目级页面统一放在 `/projects/[projectId]/...`。
- UI 必须覆盖 loading、empty、error、failed、retrying、missing artifact 等状态。
- Ask UI 升级必须保留现有 Reasoning、Audit、Clarification、Insight Canvas 和 QueryPlan confirmation 体验。

## 测试与命令

通用命令：

```bash
pnpm install
pnpm prisma generate
pnpm typecheck
pnpm lint
pnpm test
```

注意：当前 `package.json` 尚未定义 `typecheck` / `lint`，Phase 6 conventions issue 应补齐或明确替代命令。

每个 PR 必须在 issue 中声明：

- Scope
- Out of Scope
- Files likely to change
- Tests
- Commands
- Manual Verification

## Phase 6 推荐执行顺序

第一批平台最小闭环：

1. Phase 6 #13：Implementation Conventions
2. Phase 6 #14：Platform Infrastructure
3. Phase 6 #15：Project Runtime
4. Phase 6 #16：Semantic Onboarding Studio
5. Phase 6 #17：Join Graph Validator
6. Phase 6 #19：RBAC
7. Phase 6 #21：Observability
8. Phase 6 #31：Ask UI Upgrade

之后再做：

- Phase 6 #20：PII / Sensitivity
- Phase 6 #22：Insight Engine
- Phase 6 #23：Metric Decomposition
- Phase 6 #24：Scheduled Briefing
- Phase 6 #25：Data Quality
- Phase 6 #26：Feedback Loop
- Phase 6 #27：Query API
- Phase 6 #28：SDK / Embed
- Phase 6 #29：Export Pipeline
- Phase 6 #30：Eval Batch Runner

## Codex PR 切片建议

不要一次实现 #13 到 #31。优先按薄切片执行：

```text
#13A Phase 6 conventions: env/api/prisma/logger
#14A docker compose + health
#14B Prisma ArtifactObject / JobRun + repositories
#14C Redis + BullMQ queue registry + test job
#14D MinIO ArtifactStore
#14E Admin jobs/artifacts UI

#15A Project/DataSource/Settings Prisma models
#15B Project repository + API
#15C Project Switcher UI
#15D Project Runtime integration into chat route

#16A DataSource form + connection test
#16B Schema scan job + snapshot MinIO
#16C Semantic draft generator
#16D Draft review UI

#17A Join graph validator core
#17B Validation job + report artifact
#17C Join graph UI

#18A Contract version models + publish API
#18B Diff artifact + rollback API
#18C Contract versions UI

#19A RBAC models + policy engine
#19B Policy-aware schema / semantic filter
#19C RBAC UI

#21A QueryRun / ToolCallRun / GuardEvent recorder
#21B Query run detail page
#21C Observability dashboard

#31A Ask UI runtime badges
#31B Audit drawer / query run link
#31C Feedback + export buttons
```

## Issue 执行模板

```md
Implement Phase 6 #14C: Redis + BullMQ queue registry + test job.

Context:
The project uses Prisma for migrations, PostgreSQL for metadata, Redis for BullMQ, BullMQ for async jobs, and MinIO for artifacts.

Scope:
- Add Redis client.
- Add BullMQ queue registry.
- Add a test queue and test worker.
- Record job_runs using Prisma.
- Add POST /api/admin/jobs/test.
- Add tests.

Out of Scope:
- Do not implement schema scan.
- Do not implement onboarding.
- Do not implement project runtime.
- Do not change chat route.

Files likely to change:
- src/lib/queue/redis.ts
- src/lib/queue/bullmq.ts
- src/lib/queue/queues.ts
- src/lib/queue/job-run-recorder.ts
- src/workers/index.ts
- src/app/api/admin/jobs/test/route.ts
- prisma/schema.prisma if needed

Commands:
- pnpm prisma generate
- pnpm typecheck
- pnpm test

Acceptance:
- Test job can be enqueued.
- Worker consumes it.
- job_runs row is created and updated.
- Failed job records error safely.
```

## Done Definition

一个 Phase 6 PR 完成时至少满足：

- 只修改该 issue 范围内的文件。
- 新 API 使用 envelope、Zod 和统一错误码。
- 新 DB 结构使用 Prisma migration。
- 新异步任务有 queue payload schema、JobRun 记录和失败 redaction。
- 新 artifact 只把 metadata 存 DB，文件内容进 MinIO。
- 新 UI 有 loading / empty / error 状态。
- 已运行 issue 要求的命令；无法运行时在 PR 描述中说明阻塞原因。
- 不回退或覆盖用户已有改动。
