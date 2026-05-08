import {
  AnalysisAudit,
  AnalysisEvent,
  AnalysisPlan,
  QueryPlan,
  QueryFilter,
  SemanticLayer,
  Metric,
  Dimension,
  Relationship,
  CompilationResult,
  CertificationAudit,
  TimeRange
} from './types';

type CompilationDraft = Omit<CompilationResult, 'certification'>;

/**
 * 路径发现器：使用 Dijkstra 算法在语义图中寻找最优 Join 路径
 */
class PathFinder {
  private layer: SemanticLayer;

  constructor(layer: SemanticLayer) {
    this.layer = layer;
  }

  /**
   * 寻找覆盖所有目标实体的最小路径（启发式 Steiner Tree 近似）
   */
  findBestPath(targetEntityIds: Set<string>): string[] {
    const targetIds = Array.from(targetEntityIds);
    if (targetIds.length <= 1) return targetIds;

    // 以第一个实体为起点
    let currentTree = new Set<string>([targetIds[0]]);
    const remaining = new Set<string>(targetIds.slice(1));

    while (remaining.size > 0) {
      let shortestPath: string[] | null = null;
      let closestTarget: string | null = null;

      // 寻找距离当前树最近的下一个目标节点
      for (const targetId of Array.from(remaining)) {
        const path = this.dijkstraSearch(currentTree, targetId);
        if (path && (!shortestPath || path.length < shortestPath.length)) {
          shortestPath = path;
          closestTarget = targetId;
        }
      }

      if (!shortestPath) {
        throw new Error(`无法找到路径连接实体: ${Array.from(remaining).join(', ')}`);
      }

      // 将路径上的所有节点加入当前树
      shortestPath.forEach(id => currentTree.add(id));
      remaining.delete(closestTarget!);
    }

    return Array.from(currentTree);
  }

  private dijkstraSearch(startNodes: Set<string>, targetId: string): string[] | null {
    const distances: Record<string, number> = {};
    const previous: Record<string, string | null> = {};
    const queue = new Set<string>();

    Object.keys(this.layer.entities).forEach(id => {
      distances[id] = startNodes.has(id) ? 0 : Infinity;
      previous[id] = null;
      queue.add(id);
    });

    while (queue.size > 0) {
      let u = Array.from(queue).reduce((min, node) => 
        distances[node] < distances[min] ? node : min
      );

      if (distances[u] === Infinity) break;
      if (u === targetId) {
        const path = [];
        let curr: string | null = u;
        while (curr) {
          path.unshift(curr);
          curr = previous[curr];
        }
        return path;
      }

      queue.delete(u);

      // 获取邻居
      const neighbors = this.getNeighbors(u);
      for (const v of neighbors) {
        if (!queue.has(v)) continue;
        
        // 算法权重调优：维表到事实表的权重设为 1，事实表到事实表设为 10（避开 Chasm Trap）
        const weight = this.layer.entities[v].type === 'fact' ? 10 : 1;
        const alt = distances[u] + weight;
        
        if (alt < distances[v]) {
          distances[v] = alt;
          previous[v] = u;
        }
      }
    }
    return null;
  }

  private getNeighbors(entityId: string): string[] {
    const neighbors: string[] = [];
    for (const rel of this.layer.relationships) {
      if (rel.fromEntityId === entityId) neighbors.push(rel.toEntityId);
      if (rel.toEntityId === entityId) neighbors.push(rel.fromEntityId);
    }
    return neighbors;
  }
}

/**
 * 工业级 SQL 编译器：支持 Dijkstra 路径发现、Multi-pass 编译、计算指标与时间智能
 */
export class SQLCompiler {
  private semanticLayer: SemanticLayer;
  private pathFinder: PathFinder;

  constructor(semanticLayer: SemanticLayer) {
    this.semanticLayer = semanticLayer;
    this.pathFinder = new PathFinder(semanticLayer);
  }

  compile(plan: QueryPlan): CompilationResult {
    const metrics = this.resolveMetrics(plan);
    const dimensions = this.resolveDimensions(plan);
    this.validateFilters(plan);

    let result: CompilationDraft;

    // 1. 处理时间智能（同环比对比）
    if (plan.comparison && plan.timeRange) {
      result = this.compileComparison(plan, metrics, dimensions);
    } else {
      // 2. 检查是否涉及多个事实表 (Chasm Trap 识别)
      const factEntities = new Set<string>();
      metrics.forEach(m => {
        const ent = this.semanticLayer.entities[m.entityId];
        if (ent && ent.type === 'fact') {
          factEntities.add(m.entityId);
        }
      });

      result = factEntities.size > 1
        ? this.compileMultiPass(plan, metrics, dimensions, factEntities)
        : this.compileSinglePass(plan, metrics, dimensions);
    }

    return this.attachCertification(result, metrics, dimensions);
  }

  compileAnalysis(plan: AnalysisPlan): CompilationResult {
    this.validateAnalysisEntity(plan.entity.id);

    let result: CompilationDraft;
    switch (plan.template) {
      case 'retention':
        result = this.compileRetentionAnalysis(plan);
        break;
      case 'funnel':
        result = this.compileFunnelAnalysis(plan);
        break;
      case 'cohort':
        result = this.compileCohortAnalysis(plan);
        break;
      case 'path_sequence':
        result = this.compilePathSequenceAnalysis(plan);
        break;
      default: {
        const unreachable: never = plan;
        throw new Error(`不支持的分析模板: ${(unreachable as AnalysisPlan).template}`);
      }
    }

    return this.attachAnalysisCertification(result, plan);
  }

  private compileRetentionAnalysis(
    plan: Extract<AnalysisPlan, { template: 'retention' }>
  ): CompilationDraft {
    const grain = plan.grain ?? 'day';
    const interval = this.formatAnalysisInterval(plan.retentionWindow);
    const cohortSource = this.buildAnalysisEventSource(plan.cohortEvent);
    const returnSource = this.buildAnalysisEventSource(plan.returnEvent);
    const cohortWhere = this.buildAnalysisEventWhere(
      plan.cohortEvent,
      plan.timeRange,
      new Set(cohortSource.path)
    );
    const returnWhere = this.buildAnalysisEventWhere(
      plan.returnEvent,
      undefined,
      new Set(returnSource.path)
    );

    const ctes = [
      `cohort AS (SELECT ${plan.cohortEvent.actorColumn} AS entity_id, DATE_TRUNC('${grain}', ${plan.cohortEvent.timestampColumn})::date AS cohort_start ${cohortSource.fromClause}${cohortWhere})`,
      `return_events AS (SELECT ${plan.returnEvent.actorColumn} AS entity_id, ${plan.returnEvent.timestampColumn} AS event_at ${returnSource.fromClause}${returnWhere})`,
      `retention AS (SELECT cohort.cohort_start, COUNT(DISTINCT cohort.entity_id) AS cohort_size, COUNT(DISTINCT return_events.entity_id) AS retained_entities FROM cohort LEFT JOIN return_events ON return_events.entity_id = cohort.entity_id AND return_events.event_at > cohort.cohort_start AND return_events.event_at <= cohort.cohort_start + INTERVAL '${interval}' GROUP BY 1)`
    ];
    const sql = `WITH ${ctes.join(', ')} SELECT cohort_start, cohort_size, retained_entities, retained_entities::decimal / NULLIF(cohort_size, 0) AS retention_rate FROM retention ORDER BY cohort_start`;

    const events = [plan.cohortEvent, plan.returnEvent];
    return {
      sql,
      lineage: this.buildAnalysisLineage(plan, events),
      analysis: this.buildAnalysisAudit(plan, events, {
        retentionWindow: interval,
        grain
      })
    };
  }

  private compileFunnelAnalysis(
    plan: Extract<AnalysisPlan, { template: 'funnel' }>
  ): CompilationDraft {
    const ctes: string[] = [];
    const interval = plan.conversionWindow
      ? this.formatAnalysisInterval(plan.conversionWindow)
      : undefined;

    plan.steps.forEach((step, index) => {
      const stepNumber = index + 1;
      const source = this.buildAnalysisEventSource(step);
      const where = this.buildAnalysisEventWhere(
        step,
        index === 0 ? plan.timeRange : undefined,
        new Set(source.path)
      );

      ctes.push(
        `step_${stepNumber}_events AS (SELECT ${step.actorColumn} AS entity_id, ${step.timestampColumn} AS event_at ${source.fromClause}${where})`
      );

      if (index === 0) {
        ctes.push(
          `step_1 AS (SELECT entity_id, MIN(event_at) AS step_1_at FROM step_1_events GROUP BY 1)`
        );
        return;
      }

      const previousStep = stepNumber - 1;
      const windowCondition = interval
        ? ` AND step_${stepNumber}_events.event_at <= step_1_at + INTERVAL '${interval}'`
        : '';
      ctes.push(
        `step_${stepNumber} AS (SELECT step_${previousStep}.entity_id, step_${previousStep}.step_1_at, MIN(step_${stepNumber}_events.event_at) AS step_${stepNumber}_at FROM step_${previousStep} JOIN step_${stepNumber}_events ON step_${stepNumber}_events.entity_id = step_${previousStep}.entity_id AND step_${stepNumber}_events.event_at >= step_${previousStep}.step_${previousStep}_at${windowCondition} GROUP BY 1, 2)`
      );
    });

    const finalSelect = plan.steps
      .map((step, index) =>
        `SELECT ${index + 1} AS step_index, '${this.escapeSqlString(step.name)}' AS step_name, COUNT(*) AS entity_count FROM step_${index + 1}`
      )
      .join(' UNION ALL ');

    return {
      sql: `WITH ${ctes.join(', ')} ${finalSelect}`,
      lineage: this.buildAnalysisLineage(plan, plan.steps),
      analysis: this.buildAnalysisAudit(plan, plan.steps, {
        conversionWindow: interval ?? 'unbounded',
        stepCount: plan.steps.length
      })
    };
  }

  private compileCohortAnalysis(
    plan: Extract<AnalysisPlan, { template: 'cohort' }>
  ): CompilationDraft {
    const grain = plan.grain ?? 'month';
    const source = this.buildAnalysisEventSource(plan.cohortEvent);
    const where = this.buildAnalysisEventWhere(
      plan.cohortEvent,
      plan.timeRange,
      new Set(source.path)
    );
    const sql = `SELECT DATE_TRUNC('${grain}', ${plan.cohortEvent.timestampColumn})::date AS cohort_start, COUNT(DISTINCT ${plan.cohortEvent.actorColumn}) AS entity_count ${source.fromClause}${where} GROUP BY 1 ORDER BY cohort_start`;

    return {
      sql,
      lineage: this.buildAnalysisLineage(plan, [plan.cohortEvent]),
      analysis: this.buildAnalysisAudit(plan, [plan.cohortEvent], {
        grain
      })
    };
  }

  private compilePathSequenceAnalysis(
    plan: Extract<AnalysisPlan, { template: 'path_sequence' }>
  ): CompilationDraft {
    const eventSelects = plan.events.map(event => {
      const source = this.buildAnalysisEventSource(event);
      const where = this.buildAnalysisEventWhere(event, plan.timeRange, new Set(source.path));
      return `SELECT ${event.actorColumn} AS entity_id, ${event.timestampColumn} AS event_at, '${this.escapeSqlString(event.name)}' AS event_name ${source.fromClause}${where}`;
    });
    const limitClause = plan.limit ? ` LIMIT ${plan.limit}` : '';
    const sql = `WITH events AS (${eventSelects.join(' UNION ALL ')}), sequenced AS (SELECT entity_id, event_name, event_at, LEAD(event_name) OVER (PARTITION BY entity_id ORDER BY event_at, event_name) AS next_event FROM events) SELECT event_name, next_event, COUNT(*) AS transition_count FROM sequenced WHERE next_event IS NOT NULL GROUP BY 1, 2 ORDER BY transition_count DESC${limitClause}`;

    return {
      sql,
      lineage: this.buildAnalysisLineage(plan, plan.events),
      analysis: this.buildAnalysisAudit(plan, plan.events, {
        eventCount: plan.events.length,
        limit: plan.limit ?? 'none'
      })
    };
  }

  private resolveMetrics(plan: QueryPlan): Metric[] {
    return plan.metrics.map(m => {
      const metric = this.semanticLayer.metrics[m.id];
      if (!metric) {
        throw new Error(`未知指标: ${m.id}`);
      }
      return metric;
    });
  }

  private resolveDimensions(plan: QueryPlan): Dimension[] {
    return plan.dimensions.map(d => {
      const dimension = this.semanticLayer.dimensions[d.id];
      if (!dimension) {
        throw new Error(`未知维度: ${d.id}`);
      }
      return dimension;
    });
  }

  private validateFilters(plan: QueryPlan): void {
    plan.filters.forEach(f => {
      if (!this.semanticLayer.dimensions[f.field]) {
        throw new Error(`未知过滤字段: ${f.field}`);
      }
    });
  }

  /**
   * 解析指标表达式（递归解析计算指标 formula）
   */
  private resolveMetricExpression(metric: Metric): string {
    if (!metric.formula) return metric.expression;

    let resolved = metric.formula;
    const matches = resolved.match(/{{(.*?)}}/g);
    if (matches) {
      for (const match of matches) {
        const refId = match.slice(2, -2);
        const refMetric = this.semanticLayer.metrics[refId];
        if (refMetric) {
          resolved = resolved.replace(match, `(${this.resolveMetricExpression(refMetric)})`);
        }
      }
    }
    return resolved;
  }

  /**
   * 单阶段编译：标准 Join 逻辑
   */
  private compileSinglePass(plan: QueryPlan, metrics: Metric[], dimensions: Dimension[]): CompilationDraft {
    const requiredEntityIds = new Set<string>();
    metrics.forEach(m => requiredEntityIds.add(m.entityId));
    dimensions.forEach(d => requiredEntityIds.add(d.entityId));
    plan.filters.forEach(f => {
      const dim = this.semanticLayer.dimensions[f.field];
      if (dim) requiredEntityIds.add(dim.entityId);
    });

    const path = this.pathFinder.findBestPath(requiredEntityIds);
    const fromClause = this.buildJoinClause(path);

    const selectItems = [
      ...dimensions.map(d => `${d.transform || d.column} AS "${d.id}"`),
      ...metrics.map(m => `${this.resolveMetricExpression(m)} AS "${m.id}"`)
    ];

    const whereClause = this.buildWhereClause(plan, metrics);
    const groupByClause = dimensions.length > 0 && metrics.length > 0 
      ? ` GROUP BY ${dimensions.map((_, i) => i + 1).join(', ')}` 
      : '';
    const orderByClause = plan.orderBy?.length 
      ? ` ORDER BY ${plan.orderBy.map(o => `${o.field} ${o.direction}`).join(', ')}` 
      : '';
    const limitClause = plan.limit ? ` LIMIT ${plan.limit}` : '';

    const sql = `SELECT ${selectItems.join(', ')} ${fromClause}${whereClause}${groupByClause}${orderByClause}${limitClause}`;
    
    return {
      sql,
      lineage: {
        path,
        entities: Array.from(requiredEntityIds),
        metrics: metrics.map(m => m.id),
        dimensions: dimensions.map(d => d.id),
        isMultiPass: false,
        type: 'SinglePass'
      }
    };
  }

  /**
   * 多阶段编译 (Multi-pass)：应对 Chasm Trap，保证指标聚合准确性
   */
  private compileMultiPass(plan: QueryPlan, metrics: Metric[], dimensions: Dimension[], factEntities: Set<string>): CompilationDraft {
    const ctes: string[] = [];
    const factList = Array.from(factEntities);
    const allRequiredEntities = new Set<string>(factList);
    dimensions.forEach(d => allRequiredEntities.add(d.entityId));
    const filterDimensions = plan.filters.map(f => this.semanticLayer.dimensions[f.field]);
    filterDimensions.forEach(d => allRequiredEntities.add(d.entityId));
    
    const combinedPath: string[] = [];

    // 1. 为每个事实表生成独立的局部聚合 CTE
    factList.forEach((factId, index) => {
      const factMetrics = metrics.filter(m => m.entityId === factId);
      const factEntitiesRequired = new Set<string>([
        factId,
        ...dimensions.map(d => d.entityId),
        ...filterDimensions.map(d => d.entityId)
      ]);
      const path = this.findFactScopedPath(factId, factEntitiesRequired, dimensions, plan.filters);
      const pathEntityIds = new Set(path);
      
      // 合并路径用于 Lineage
      path.forEach(p => { if (!combinedPath.includes(p)) combinedPath.push(p); });

      const selectItems = [
        ...dimensions.map(d => `${d.transform || d.column} AS "dim_${d.id}"`),
        ...factMetrics.map(m => `${this.resolveMetricExpression(m)} AS "${m.id}"`)
      ];
      
      const joins = this.buildJoinClause(path);
      const whereClause = this.buildWhereClause(plan, factMetrics, pathEntityIds);
      const groupBy = dimensions.length > 0
        ? ` GROUP BY ${dimensions.map((_, i) => i + 1).join(', ')}`
        : '';
      
      ctes.push(`fact_${index} AS (SELECT ${selectItems.join(', ')} ${joins}${whereClause}${groupBy})`);
    });

    // 2. 将各个事实表的结果基于维度进行对齐缝合
    const finalSelect = [
      ...dimensions.map(d => `COALESCE(${factList.map((_, i) => `fact_${i}."dim_${d.id}"`).join(', ')}) AS "${d.id}"`),
      ...metrics.map(m => {
        const factIdx = factList.indexOf(m.entityId);
        return `fact_${factIdx}."${m.id}"`;
      })
    ];

    let finalFrom = `FROM fact_0`;
    for (let i = 1; i < factList.length; i++) {
      if (dimensions.length === 0) {
        finalFrom += ` CROSS JOIN fact_${i}`;
      } else {
        // 关键修复：使用之前所有事实表的 COALESCE 维度进行对齐，防止第一个事实表数据缺失导致的对齐失败
        const joinOn = dimensions.map(d => {
          const prevFacts = Array.from({ length: i }, (_, idx) => `fact_${idx}."dim_${d.id}"`);
          const prevCoalesce = prevFacts.length > 1 ? `COALESCE(${prevFacts.join(', ')})` : prevFacts[0];
          return `${prevCoalesce} = fact_${i}."dim_${d.id}"`;
        }).join(' AND ');
        finalFrom += ` FULL OUTER JOIN fact_${i} ON ${joinOn}`;
      }
    }

    const orderBy = plan.orderBy?.length 
      ? ` ORDER BY ${plan.orderBy.map(o => `${o.field} ${o.direction}`).join(', ')}` 
      : '';
    const limit = plan.limit ? ` LIMIT ${plan.limit}` : '';

    const sql = `WITH ${ctes.join(', ')} SELECT ${finalSelect.join(', ')} ${finalFrom}${orderBy}${limit}`;

    return {
      sql,
      lineage: {
        path: combinedPath,
        entities: Array.from(allRequiredEntities),
        metrics: metrics.map(m => m.id),
        dimensions: dimensions.map(d => d.id),
        isMultiPass: true,
        type: 'MultiPass'
      }
    };
  }

  private findFactScopedPath(
    factId: string,
    requiredEntityIds: Set<string>,
    dimensions: Dimension[],
    filters: QueryPlan['filters']
  ): string[] {
    const path = this.pathFinder.findBestPath(requiredEntityIds);
    const crossingFacts = this.getOtherFactIds(path, factId);
    if (crossingFacts.length === 0) return path;

    for (const filter of filters) {
      const dimension = this.semanticLayer.dimensions[filter.field];
      const filterPath = this.pathFinder.findBestPath(new Set([factId, dimension.entityId]));
      const filterCrossingFacts = this.getOtherFactIds(filterPath, factId);
      if (filterCrossingFacts.length > 0) {
        throw new Error(
          `过滤字段不适用于当前 multi-pass CTE: ${filter.field} 无法应用于 fact ${factId}，否则会跨事实表 ${filterCrossingFacts.join(', ')}。`
        );
      }
    }

    for (const dimension of dimensions) {
      const dimensionPath = this.pathFinder.findBestPath(new Set([factId, dimension.entityId]));
      const dimensionCrossingFacts = this.getOtherFactIds(dimensionPath, factId);
      if (dimensionCrossingFacts.length > 0) {
        throw new Error(
          `维度不适用于当前 multi-pass CTE: ${dimension.id} 无法应用于 fact ${factId}，否则会跨事实表 ${dimensionCrossingFacts.join(', ')}。`
        );
      }
    }

    throw new Error(
      `无法为 fact ${factId} 生成不跨事实表的 multi-pass CTE 路径: ${path.join(' -> ')}`
    );
  }

  private getOtherFactIds(path: string[], factId: string): string[] {
    return path.filter(entityId => {
      const entity = this.semanticLayer.entities[entityId];
      return entityId !== factId && entity?.type === 'fact';
    });
  }

  private compileComparison(plan: QueryPlan, metrics: Metric[], dimensions: Dimension[]): CompilationDraft {
    const type = plan.comparison!.type;
    const interval = type === 'MoM' ? '1 month' : type === 'YoY' ? '1 year' : '1 period';

    // 1. 生成“当前周期”数据计划
    const currentPlan = { ...plan, comparison: undefined };
    const currentResult = this.compileSinglePass(currentPlan, metrics, dimensions);
    
    // 2. 构造“历史周期”数据计划：深度克隆并进行时间偏移
    const historicalTimeRange = this.shiftTimeRange(plan.timeRange!, interval);
    const historicalPlan = { 
      ...plan, 
      comparison: undefined,
      timeRange: historicalTimeRange
    };
    const historicalResult = this.compileSinglePass(historicalPlan, metrics, dimensions);

    // 3. 构造 CTE
    const ctes = [
      `current_period AS (${currentResult.sql})`,
      `historical_period AS (${historicalResult.sql})`
    ];

    // 4. 计算增长率
    const finalSelect = [
      ...dimensions.map(d => {
        const currentDimension = `current_period."${d.id}"`;
        const historicalDimension = `historical_period."${d.id}"`;
        const alignedHistoricalDimension = this.isTemporalDimension(d)
          ? `(${historicalDimension} + INTERVAL '${interval}')`
          : historicalDimension;

        return `COALESCE(${currentDimension}, ${alignedHistoricalDimension}) AS "${d.id}"`;
      }),
      ...metrics.flatMap(m => [
        `current_period."${m.id}" AS "${m.id}"`,
        `historical_period."${m.id}" AS "${m.id}_prev"`,
        `(current_period."${m.id}" - historical_period."${m.id}") / NULLIF(historical_period."${m.id}", 0) AS "${m.id}_growth"`
      ])
    ];

    const joinOn = dimensions.length > 0 
      ? ` ON ${dimensions.map(d => this.buildComparisonDimensionJoin(d, interval)).join(' AND ')}` 
      : ' ON 1=1';

    const sql = `WITH ${ctes.join(', ')} SELECT ${finalSelect.join(', ')} FROM current_period FULL OUTER JOIN historical_period${joinOn}`;

    return {
      sql,
      lineage: {
        ...currentResult.lineage,
        type: 'Comparison'
      }
    };
  }

  private buildComparisonDimensionJoin(dimension: Dimension, interval: string): string {
    const currentDimension = `current_period."${dimension.id}"`;
    const historicalDimension = `historical_period."${dimension.id}"`;

    if (this.isTemporalDimension(dimension)) {
      return `${currentDimension} = ${historicalDimension} + INTERVAL '${interval}'`;
    }

    return `${currentDimension} = ${historicalDimension}`;
  }

  private isTemporalDimension(dimension: Dimension): boolean {
    if (dimension.timeGrain) return true;

    const expression = `${dimension.id} ${dimension.column} ${dimension.transform || ''}`;
    return /\b(date|joined_at|created_at|_at)\b/i.test(expression) || /DATE_TRUNC/i.test(expression);
  }

  /**
   * 时间平移逻辑：支持相对时间与绝对时间
   */
  private shiftTimeRange(range: TimeRange, interval: string): TimeRange {
    if (range.type === 'absolute') {
      return {
        ...range,
        start: range.start ? `DATE '${range.start}' - INTERVAL '${interval}'` : undefined,
        end: range.end ? `DATE '${range.end}' - INTERVAL '${interval}'` : undefined
      } as any; // 这里使用 SQL 表达式作为日期字符串，compileSinglePass 中的 buildTimeRangeConditions 会处理
    }

    // 相对时间直接在 SQL 层面处理偏移
    return {
      ...range,
      _shiftInterval: interval // 内部标记位，用于 buildTimeRangeConditions
    } as any;
  }

  private buildAnalysisEventSource(event: AnalysisEvent): { fromClause: string; path: string[] } {
    this.validateAnalysisEvent(event);
    const requiredEntityIds = new Set<string>([event.entityId]);

    (event.filters ?? []).forEach(filter => {
      const dimension = this.semanticLayer.dimensions[filter.field];
      if (!dimension) {
        throw new Error(`未知分析过滤字段: ${filter.field}`);
      }
      requiredEntityIds.add(dimension.entityId);
    });

    const path = this.pathFinder.findBestPath(requiredEntityIds);
    return {
      fromClause: this.buildJoinClause(path),
      path
    };
  }

  private buildAnalysisEventWhere(
    event: AnalysisEvent,
    timeRange: TimeRange | undefined,
    availableEntityIds: Set<string>
  ): string {
    const conditions: string[] = [];

    if (timeRange) {
      conditions.push(...this.buildTimeRangeConditions(event.timestampColumn, timeRange));
    }

    (event.filters ?? []).forEach(filter => {
      conditions.push(this.buildFilterCondition(filter, availableEntityIds, '分析过滤字段'));
    });

    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  }

  private buildAnalysisLineage(plan: AnalysisPlan, events: AnalysisEvent[]): CompilationDraft['lineage'] {
    const requiredEntityIds = this.collectAnalysisEntityIds(plan, events);
    const path = this.pathFinder.findBestPath(requiredEntityIds);

    return {
      path,
      entities: path,
      metrics: [],
      dimensions: this.collectAnalysisFilterDimensions(events).map(dimension => dimension.id),
      isMultiPass: false,
      type: 'Analysis'
    };
  }

  private buildAnalysisAudit(
    plan: AnalysisPlan,
    events: AnalysisEvent[],
    parameters: Record<string, string | number | boolean | undefined>
  ): AnalysisAudit {
    const cleanParameters = Object.entries(parameters).reduce<Record<string, string | number | boolean>>(
      (acc, [key, value]) => {
        if (value !== undefined) acc[key] = value;
        return acc;
      },
      {}
    );

    return {
      template: plan.template,
      entity: plan.entity,
      timeWindow: plan.timeRange,
      parameters: cleanParameters,
      events: events.map(event => ({
        id: event.id,
        name: event.name,
        entityId: event.entityId,
        actorColumn: event.actorColumn,
        timestampColumn: event.timestampColumn,
        ...(event.filters?.length ? { filters: event.filters } : {})
      }))
    };
  }

  private collectAnalysisEntityIds(plan: AnalysisPlan, events: AnalysisEvent[]): Set<string> {
    const requiredEntityIds = new Set<string>([plan.entity.id]);

    events.forEach(event => {
      this.validateAnalysisEvent(event);
      requiredEntityIds.add(event.entityId);
      (event.filters ?? []).forEach(filter => {
        const dimension = this.semanticLayer.dimensions[filter.field];
        if (!dimension) {
          throw new Error(`未知分析过滤字段: ${filter.field}`);
        }
        requiredEntityIds.add(dimension.entityId);
      });
    });

    return requiredEntityIds;
  }

  private collectAnalysisFilterDimensions(events: AnalysisEvent[]): Dimension[] {
    const dimensions = new Map<string, Dimension>();

    events.forEach(event => {
      (event.filters ?? []).forEach(filter => {
        const dimension = this.semanticLayer.dimensions[filter.field];
        if (!dimension) {
          throw new Error(`未知分析过滤字段: ${filter.field}`);
        }
        dimensions.set(dimension.id, dimension);
      });
    });

    return Array.from(dimensions.values());
  }

  private validateAnalysisEntity(entityId: string): void {
    if (!this.semanticLayer.entities[entityId]) {
      throw new Error(`未知分析实体: ${entityId}`);
    }
  }

  private validateAnalysisEvent(event: AnalysisEvent): void {
    this.validateAnalysisEntity(event.entityId);
  }

  private formatAnalysisInterval(window: { value: number; unit: 'day' | 'week' | 'month' }): string {
    const unit = window.value === 1 ? window.unit : `${window.unit}s`;
    return `${window.value} ${unit}`;
  }

  private buildJoinClause(path: string[]): string {
    if (path.length === 0) return '';
    const baseEntity = this.semanticLayer.entities[path[0]];
    let clause = `FROM ${baseEntity.table}`;
    const joined = new Set<string>([path[0]]);

    // 按照路径顺序进行 Join
    for (let i = 1; i < path.length; i++) {
      const nextId = path[i];
      const rel = this.semanticLayer.relationships.find(r => 
        (joined.has(r.fromEntityId) && r.toEntityId === nextId) ||
        (joined.has(r.toEntityId) && r.fromEntityId === nextId)
      );
      
      if (rel) {
        const toEntity = this.semanticLayer.entities[nextId];
        clause += ` JOIN ${toEntity.table} ON ${rel.joinOn}`;
        joined.add(nextId);
      }
    }
    return clause;
  }

  private attachCertification(
    result: CompilationDraft,
    metrics: Metric[],
    dimensions: Dimension[]
  ): CompilationResult {
    const relationships = this.resolveRelationshipsForPath(result.lineage.path);
    const metricAudit = metrics.map(metric => {
      const entity = this.semanticLayer.entities[metric.entityId];
      return {
        id: metric.id,
        name: metric.name,
        certified: metric.certified === true,
        timeColumn: metric.timeColumn || entity?.defaultTimeColumn,
        businessDefinition: metric.businessDefinition,
        allowDetailDrilldown: metric.allowDetailDrilldown
      };
    });
    const dimensionAudit = dimensions.map(dimension => ({
      id: dimension.id,
      name: dimension.name,
      certified: dimension.certified === true
    }));
    const relationshipAudit = relationships.map(relationship => ({
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      type: relationship.type,
      joinOn: relationship.joinOn,
      certified: relationship.certified === true
    }));

    const reasons = [
      ...metricAudit
        .filter(metric => !metric.certified)
        .map(metric => `metric ${metric.id} is not certified`),
      ...dimensionAudit
        .filter(dimension => !dimension.certified)
        .map(dimension => `dimension ${dimension.id} is not certified`),
      ...relationshipAudit
        .filter(relationship => !relationship.certified)
        .map(relationship => `relationship ${relationship.fromEntityId}->${relationship.toEntityId} is not certified`)
    ];
    const isCertified = reasons.length === 0;
    const certification: CertificationAudit = {
      isCertified,
      certificationLevel: isCertified ? 'certified_plan' : 'semantic_compiled',
      status: isCertified ? 'certified' : 'exploratory',
      reasons,
      metrics: metricAudit,
      dimensions: dimensionAudit,
      relationships: relationshipAudit
    };

    return { ...result, certification };
  }

  private attachAnalysisCertification(
    result: CompilationDraft,
    plan: AnalysisPlan
  ): CompilationResult {
    const events = this.getAnalysisEvents(plan);
    const dimensions = this.collectAnalysisFilterDimensions(events);
    const relationships = this.resolveRelationshipsForPath(result.lineage.path);
    const dimensionAudit = dimensions.map(dimension => ({
      id: dimension.id,
      name: dimension.name,
      certified: dimension.certified === true
    }));
    const relationshipAudit = relationships.map(relationship => ({
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      type: relationship.type,
      joinOn: relationship.joinOn,
      certified: relationship.certified === true
    }));
    const reasons = [
      ...dimensionAudit
        .filter(dimension => !dimension.certified)
        .map(dimension => `dimension ${dimension.id} is not certified`),
      ...relationshipAudit
        .filter(relationship => !relationship.certified)
        .map(relationship => `relationship ${relationship.fromEntityId}->${relationship.toEntityId} is not certified`)
    ];
    const isCertified = reasons.length === 0;
    const certification: CertificationAudit = {
      isCertified,
      certificationLevel: isCertified ? 'certified_plan' : 'semantic_compiled',
      status: isCertified ? 'certified' : 'exploratory',
      reasons,
      metrics: [],
      dimensions: dimensionAudit,
      relationships: relationshipAudit
    };

    return { ...result, certification };
  }

  private getAnalysisEvents(plan: AnalysisPlan): AnalysisEvent[] {
    switch (plan.template) {
      case 'retention':
        return [plan.cohortEvent, plan.returnEvent];
      case 'funnel':
        return plan.steps;
      case 'cohort':
        return [plan.cohortEvent];
      case 'path_sequence':
        return plan.events;
      default: {
        const unreachable: never = plan;
        throw new Error(`不支持的分析模板: ${(unreachable as AnalysisPlan).template}`);
      }
    }
  }

  private resolveRelationshipsForPath(path: string[]): Relationship[] {
    if (path.length <= 1) return [];

    const relationships: Relationship[] = [];
    const joined = new Set<string>([path[0]]);

    for (let i = 1; i < path.length; i++) {
      const nextId = path[i];
      const rel = this.semanticLayer.relationships.find(r =>
        (joined.has(r.fromEntityId) && r.toEntityId === nextId) ||
        (joined.has(r.toEntityId) && r.fromEntityId === nextId)
      );

      if (rel) {
        relationships.push(rel);
        joined.add(nextId);
      }
    }

    return relationships;
  }

  private buildWhereClause(plan: QueryPlan, metrics: Metric[], availableEntityIds?: Set<string>): string {
    const conditions: string[] = [];
    
    if (plan.timeRange) {
      const col = this.resolveTimeColumn(plan, metrics);
      conditions.push(...this.buildTimeRangeConditions(col, plan.timeRange));
    }

    plan.filters.forEach(f => {
      const cond = this.buildFilterCondition(f, availableEntityIds);
      if (cond) conditions.push(cond);
    });

    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  }

  private buildFilterCondition(
    filter: QueryFilter,
    availableEntityIds?: Set<string>,
    fieldLabel = '过滤字段'
  ): string {
    const dim = this.semanticLayer.dimensions[filter.field];
    if (!dim) {
      throw new Error(`未知${fieldLabel}: ${filter.field}`);
    }

    if (availableEntityIds && !availableEntityIds.has(dim.entityId)) {
      // 关键修复：多阶段编译中，如果过滤器不适用于当前路径，则跳过（由其他阶段或最终阶段处理）
      return '';
    }

    const actualField = dim.column;
    if (filter.operator === 'between') {
      if (!Array.isArray(filter.value) || filter.value.length !== 2) {
        throw new Error(`between 过滤器需要两个边界值: ${filter.field}`);
      }
      return `${actualField} BETWEEN ${this.formatLiteral(filter.value[0])} AND ${this.formatLiteral(filter.value[1])}`;
    }

    if (filter.operator === 'in') {
      if (!Array.isArray(filter.value)) {
        throw new Error(`in 过滤器需要数组值: ${filter.field}`);
      }
      return `${actualField} IN (${filter.value.map(v => this.formatLiteral(v)).join(', ')})`;
    }

    return `${actualField} ${filter.operator} ${this.formatLiteral(filter.value)}`;
  }

  private resolveTimeColumn(plan: QueryPlan, metrics: Metric[]): string {
    if (!plan.timeRange) {
      throw new Error('缺少 timeRange，无法解析时间字段');
    }

    if (plan.timeRange.column) {
      const dimension = this.semanticLayer.dimensions[plan.timeRange.column];
      return dimension?.column || plan.timeRange.column;
    }

    const candidateColumns = metrics
      .map(metric => {
        const entity = this.semanticLayer.entities[metric.entityId];
        return metric.timeColumn || entity?.defaultTimeColumn;
      })
      .filter((column): column is string => Boolean(column));

    const uniqueColumns = Array.from(new Set(candidateColumns));

    if (uniqueColumns.length === 1) {
      return uniqueColumns[0];
    }

    if (uniqueColumns.length > 1) {
      throw new Error(
        `无法确定 timeRange 时间字段: 涉及多个候选字段 ${uniqueColumns.join(', ')}，请在 plan.timeRange.column 中指定。`
      );
    }

    throw new Error(
      '无法确定 timeRange 时间字段: 请在 plan.timeRange.column、metric.timeColumn 或 entity.defaultTimeColumn 中指定。'
    );
  }

  private buildTimeRangeConditions(
    column: string,
    timeRange: NonNullable<QueryPlan['timeRange']>
  ): string[] {
    if (timeRange.type === 'absolute') {
      if (timeRange.start && timeRange.end) {
        return [`${column} BETWEEN ${this.formatDateLiteral(timeRange.start)} AND ${this.formatDateLiteral(timeRange.end)}`];
      }
      if (timeRange.start) {
        return [`${column} >= ${this.formatDateLiteral(timeRange.start)}`];
      }
      if (timeRange.end) {
        return [`${column} <= ${this.formatDateLiteral(timeRange.end)}`];
      }
      throw new Error('absolute timeRange 需要提供 start 或 end');
    }

    const shift = (timeRange as any)._shiftInterval ? ` - INTERVAL '${(timeRange as any)._shiftInterval}'` : '';

    switch (timeRange.value) {
      case 'today':
        return [
          `${column} >= CURRENT_DATE${shift}`,
          `${column} < CURRENT_DATE${shift} + INTERVAL '1 day'`
        ];
      case 'yesterday':
        return [
          `${column} >= CURRENT_DATE${shift} - INTERVAL '1 day'`,
          `${column} < CURRENT_DATE${shift}`
        ];
      case 'last_7_days':
        return [
          `${column} >= CURRENT_DATE${shift} - INTERVAL '7 days'`,
          `${column} < CURRENT_DATE${shift} + INTERVAL '1 day'`
        ];
      case 'last_30_days':
        return [
          `${column} >= CURRENT_DATE${shift} - INTERVAL '30 days'`,
          `${column} < CURRENT_DATE${shift} + INTERVAL '1 day'`
        ];
      case 'this_month':
        return [
          `${column} >= DATE_TRUNC('month', CURRENT_DATE${shift})`,
          `${column} < DATE_TRUNC('month', CURRENT_DATE${shift}) + INTERVAL '1 month'`
        ];
      case 'last_month':
        return [
          `${column} >= DATE_TRUNC('month', CURRENT_DATE${shift} - INTERVAL '1 month')`,
          `${column} < DATE_TRUNC('month', CURRENT_DATE${shift})`
        ];
      case 'this_year':
        return [
          `${column} >= DATE_TRUNC('year', CURRENT_DATE${shift})`,
          `${column} < DATE_TRUNC('year', CURRENT_DATE${shift}) + INTERVAL '1 year'`
        ];
      default:
        throw new Error(`不支持的 timeRange preset: ${timeRange.value || '(empty)'}`);
    }
  }

  private formatDateLiteral(value: string): string {
    return `DATE '${this.escapeSqlString(value)}'`;
  }

  private formatLiteral(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    return `'${this.escapeSqlString(String(value))}'`;
  }

  private escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
  }
}
