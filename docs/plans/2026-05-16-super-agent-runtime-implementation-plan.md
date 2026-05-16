# Super Agent Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve the current Pi-based chat agent into a single-orchestrator Super Agent runtime that can classify requests, select capabilities, produce explicit plans, track execution state, and expose traces without creating a parallel architecture beside the existing codebase.

**Architecture:** Keep `src/lib/agent` as the application boundary and treat the Pi engine as the lower-level execution substrate. Add a small orchestration layer inside that boundary, reuse the existing skill system and reasoning UI, and defer memory, multi-agent delegation, generic discovery automation, and durable trace storage until there is evidence that the first runtime loop works.

**Tech Stack:** Next.js 16, React 19, TypeScript, AI SDK UI streams, Pi Coding Agent, Zod, existing local `skills/` runtime.

---

## Engineering Principles

1. **Extend the current agent boundary instead of creating a second one.**
   - Use `src/lib/agent/orchestrator/*`, not a new top-level `src/lib/super-agent/*`.
   - Keep `PiCodingAgentEngine` as the transport/execution adapter while orchestration policy lives above it.

2. **Introduce only the abstractions needed for Phase 1.**
   - Add `registry`, `planner`, `runtime`, and shared `types`.
   - Do not add separate `intent-analyzer`, `trace-store`, `synthesizer`, or `memory` modules yet.
   - Intent analysis belongs in the planner for now; traces remain in-memory/UI-stream scoped.

3. **Reuse before adding.**
   - Reuse `AgentReasoningPipeline` by generalizing it into the first run timeline surface.
   - Reuse the existing tool/skill bridge instead of adding a second execution path.

4. **Prefer explicit seams over broad rewrites.**
   - First wrap the current execution flow.
   - Only move ownership out of `PiCodingAgentEngine` after the runtime model proves useful.

5. **Keep Phase 1 measurable.**
   - A successful milestone means the agent can show: recognized intent, chosen capability, explicit plan, current run state, and final outcome on representative tasks.

## Deliberate Non-Goals for Phase 1

- No multi-agent roles yet.
- No long-term memory yet.
- No automatic file-system-wide skill discovery yet.
- No durable database-backed trace persistence yet.
- No large new UI area or separate dashboard yet.
- No attempt to make every skill dynamic before a second real skill is integrated.

## Current Baseline

- `pnpm build` passes.
- `pnpm test` passes.
- `pnpm run test:integration` currently fails because integration tests still import removed paths such as `@/lib/semantic/compiler` and `@/lib/tools/db`.
- `docs/README.md` references missing documents that no longer exist.
- `AgentReasoningPipeline.tsx` exists but is not yet wired into the active chat flow.

## Target Shape After Phase 1

```text
src/lib/agent/
  adapter/
  orchestrator/
    types.ts
    registry.ts
    planner.ts
    runtime.ts
  factory.ts
  pi-coding-agent-engine.ts
  types.ts

src/components/
  AgentReasoningPipeline.tsx   # generalized and reused
```

## Task 0: Repair the Engineering Baseline

**Why first:** Super Agent work will be hard to reason about if the repository already has stale contracts and failing integration coverage.

**Files:**
- Modify: `tests/integration/semantic-compiler.test.ts`
- Modify: `tests/integration/agent-llm.test.ts`
- Modify: `docs/README.md`
- Possibly modify: `package.json`

**Steps:**
1. Update integration imports to the current `skills/nemo-q/lib/*` locations or introduce a single supported public export module and point tests there.
2. Run `pnpm run test:integration` and confirm the alias/path failure is gone.
3. Remove or replace dead documentation links in `docs/README.md` so docs describe what actually exists today.
4. Run `pnpm test`, `pnpm run test:integration`, and `pnpm build`.
5. Commit the baseline cleanup separately from Super Agent feature work.

**Acceptance:**
- All current test commands are meaningful again.
- The next phase starts from a repo whose architecture description matches reality.

## Task 1: Define the Minimal Orchestration Contract

**Files:**
- Create: `src/lib/agent/orchestrator/types.ts`
- Test: `tests/unit/orchestrator-types.test.ts`

**Implement:**
- `CapabilityDefinition`
- `AgentPlan`
- `AgentPlanStep`
- `AgentRunState`
- `AgentTraceEvent`

**Design constraints:**
- Keep types serializable.
- Keep `status` enums small.
- Represent capability selection and run lifecycle explicitly.
- Avoid premature fields for memory, retries, parallel branches, or multi-agent ownership.

**Steps:**
1. Write failing tests that assert the narrow type contract can represent:
   - one user goal
   - one selected capability
   - one plan with ordered steps
   - one active run status
   - one trace event sequence
2. Add the minimum TypeScript types.
3. Run the unit test.
4. Commit.

**Acceptance:**
- The project has one shared language for plans and runs before any runtime code is added.

## Task 2: Add a Small Capability Registry, Not a Framework

**Files:**
- Create: `src/lib/agent/orchestrator/registry.ts`
- Test: `tests/unit/capability-registry.test.ts`

**Implement:**
- A hand-authored `nemo-q` capability adapter that maps the existing skill to `CapabilityDefinition`.
- Functions:
  - `listCapabilities()`
  - `findCapabilitiesForIntent(intent)`
  - `getCapabilityById(id)`

**Design constraints:**
- Do not build generic SKILL.md parsing yet.
- Do not scan the filesystem on every request.
- Treat this as the stable in-code contract that later automated discovery must satisfy.

**Steps:**
1. Write tests for listing capabilities and matching `data-analysis` tasks to `nemo-q`.
2. Implement the registry with one real capability.
3. Add a short comment explaining why discovery is intentionally deferred.
4. Run tests.
5. Commit.

**Acceptance:**
- The Orchestrator can reason about available abilities through data, not only prompt prose.

## Task 3: Add a Planner That Owns Intent Analysis for Now

**Files:**
- Create: `src/lib/agent/orchestrator/planner.ts`
- Test: `tests/unit/agent-planner.test.ts`

**Implement:**
- `createPlan(request, capabilities)` returning:
  - `primaryIntent`
  - `complexity`
  - `selectedCapabilityIds`
  - ordered `steps`
  - `needsClarification`

**Design constraints:**
- Keep Phase 1 planner rule-based or model-assisted but deterministic at the interface boundary.
- Do not split out a separate intent analyzer until it has at least two callers or meaningfully different lifecycle needs.
- Support three representative categories first:
  - simple answer
  - data-analysis task handled by `nemo-q`
  - ambiguous task that should ask for clarification

**Steps:**
1. Write failing tests for the three representative categories.
2. Implement the minimum planner behavior.
3. Run tests.
4. Commit.

**Acceptance:**
- A user request can become an explicit run plan before the agent starts acting.

## Task 4: Introduce the Runtime as a Thin Coordinator

**Files:**
- Create: `src/lib/agent/orchestrator/runtime.ts`
- Modify: `src/lib/agent/pi-coding-agent-engine.ts`
- Possibly modify: `src/lib/agent/types.ts`
- Test: `tests/unit/agent-runtime.test.ts`

**Implement:**
- `startRun(request, runtimeContext)`
- `recordEvent(...)`
- `advanceStep(...)`
- `completeRun(...)`
- Runtime assembly that:
  - requests a plan
  - initializes state
  - exposes a prompt/runtime payload for the Pi engine
  - emits normalized trace events

**Design constraints:**
- The runtime should not replace Pi session execution in Phase 1.
- It should wrap and annotate the existing flow so ownership boundaries become visible.
- Keep the runtime synchronous/in-memory initially; no persistence layer.

**Steps:**
1. Write failing tests for state transitions:
   - `received -> planned -> executing -> completed`
   - `received -> planned -> waiting_user`
2. Implement the thin runtime.
3. Integrate `PiCodingAgentEngine` so it requests a run envelope before prompting the model.
4. Run tests.
5. Commit.

**Acceptance:**
- The app has a real run model without rewriting the existing engine.

## Task 5: Stream Trace Data Through the Existing Chat Channel

**Files:**
- Modify: `src/lib/agent/pi-coding-agent-engine.ts`
- Modify: `src/lib/agent/adapter/stream-protocol-adapter.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/unit/stream-protocol-adapter.test.ts`

**Implement:**
- Add structured `data-agent-run` / trace payloads to the UI stream.
- Emit at least:
  - run created
  - plan created
  - capability selected
  - step started
  - run completed

**Design constraints:**
- Reuse the existing UI message transport.
- Do not add a second WebSocket/SSE channel.
- Keep user-visible prose separate from machine-readable run events.

**Steps:**
1. Write failing adapter tests for normalized run events.
2. Extend the adapter/engine with new event writes.
3. Run unit tests.
4. Commit.

**Acceptance:**
- The UI can render the run lifecycle from the same stream it already consumes.

## Task 6: Reuse the Existing Reasoning Pipeline as the First Trace UI

**Files:**
- Modify: `src/components/AgentReasoningPipeline.tsx`
- Modify: `src/components/chat/MessagePart.tsx`
- Possibly modify: `src/app/page.tsx`
- Test: add or extend relevant unit tests if helper extraction is needed

**Implement:**
- Generalize the pipeline from hardcoded Nemo.Q labels to `AgentPlanStep[]`.
- Render a run summary and current step from streamed trace data.
- Keep the first UI embedded in the chat flow; do not create a separate dashboard yet.

**Design constraints:**
- Reuse the existing component rather than adding a parallel `AgentTracePanel`.
- Keep the first version compact: goal, selected capability, step timeline, final status.
- Defer advanced visualizations such as token cost, branch graphs, and retry trees.

**Steps:**
1. Refactor `AgentReasoningPipeline` to accept runtime steps.
2. Wire streamed run data into message rendering.
3. Verify no regression in clarification and preview flows.
4. Run `pnpm test`.
5. Commit.

**Acceptance:**
- A user can see the Orchestrator plan and current step without leaving the normal chat experience.

## Task 7: Add the First Super Agent Eval Set

**Files:**
- Create: `tests/eval/super-agent-dataset.json`
- Create or modify: `scripts/run-agent-eval.ts`
- Modify: `package.json`

**Dataset should cover:**
- simple direct answer
- single-skill data query
- multi-step data analysis
- ambiguous request requiring clarification
- unsupported request with graceful refusal

**Metrics should include:**
- correct intent class
- expected capability selection
- plan step count within acceptable bounds
- clarification triggered when required
- no skill call for simple direct-answer tasks

**Steps:**
1. Define five seed cases.
2. Add an eval runner that captures runtime outputs, not just final answers.
3. Add a package script such as `test:agent-eval`.
4. Run the eval manually and record the baseline.
5. Commit.

**Acceptance:**
- The project can now measure whether it is becoming a better Super Agent, not merely a more verbose chatbot.

## Recommended Commit Sequence

1. `chore: repair integration baseline and docs`
2. `feat: add orchestration contracts`
3. `feat: add capability registry`
4. `feat: add task planner`
5. `feat: add thin orchestrator runtime`
6. `feat: stream agent run traces`
7. `feat: reuse reasoning pipeline for run timeline`
8. `test: add super agent evaluation dataset`

## Exit Criteria for Phase 1

Phase 1 is complete when:

1. The repository baseline is clean enough that current tests and docs are trustworthy.
2. One user request produces:
   - recognized intent
   - selected capability
   - explicit plan
   - visible runtime steps
   - completed/blocked outcome
3. The codebase still has one coherent agent architecture, not a second parallel system.
4. The eval suite can distinguish:
   - simple answer
   - delegated skill work
   - ambiguous task
   - unsupported task

## Deferred Until Phase 2

- Automatic discovery from `SKILL.md`
- Capability ranking by cost / reliability
- Reflection and recovery policies
- Persistent run storage
- Long-term memory
- Multi-agent delegation

