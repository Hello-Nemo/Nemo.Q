import {
  QueryPlan,
  SemanticLayer,
  Metric,
  Dimension,
  Relationship,
  CompilationResult,
  CertificationAudit
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
      ...dimensions.map(d => `${d.transform || d.column} AS ${d.id}`),
      ...metrics.map(m => `${this.resolveMetricExpression(m)} AS ${m.id}`)
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
        ...dimensions.map(d => `${d.transform || d.column} AS dim_${d.id}`),
        ...factMetrics.map(m => `${this.resolveMetricExpression(m)} AS ${m.id}`)
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
      ...dimensions.map(d => `COALESCE(${factList.map((_, i) => `fact_${i}.dim_${d.id}`).join(', ')}) AS ${d.id}`),
      ...metrics.map(m => {
        const factIdx = factList.indexOf(m.entityId);
        return `fact_${factIdx}.${m.id}`;
      })
    ];

    let finalFrom = `FROM fact_0`;
    for (let i = 1; i < factList.length; i++) {
      if (dimensions.length === 0) {
        finalFrom += ` CROSS JOIN fact_${i}`;
      } else {
        const joinOn = dimensions.map(d => `fact_0.dim_${d.id} = fact_${i}.dim_${d.id}`).join(' AND ');
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

  /**
   * 同环比编译：基于 Multi-pass 生成对比查询
   */
  private compileComparison(plan: QueryPlan, metrics: Metric[], dimensions: Dimension[]): CompilationDraft {
    const type = plan.comparison!.type;
    const interval = type === 'MoM' ? '1 month' : type === 'YoY' ? '1 year' : '1 period';

    // 1. 生成“当前周期” CTE
    const currentPlan = { ...plan, comparison: undefined };
    const currentResult = this.compileSinglePass(currentPlan, metrics, dimensions);
    const currentSql = currentResult.sql;
    
    // 2. 生成“历史周期” CTE
    const historicalPlan = { 
      ...plan, 
      comparison: undefined,
      // 简单的时间偏移处理，生产环境需更精细的时间函数
      filters: [...plan.filters] 
    };
    
    // 构造 CTE
    const ctes = [
      `current_period AS (${currentSql})`,
      `historical_period AS (
        ${currentSql.replace(/CURRENT_DATE/g, `(CURRENT_DATE - INTERVAL '${interval}')`)}
      )`
    ];

    // 3. 计算增长率
    const finalSelect = [
      ...dimensions.map(d => `current_period.${d.id}`),
      ...metrics.flatMap(m => [
        `current_period.${m.id} AS ${m.id}`,
        `historical_period.${m.id} AS ${m.id}_prev`,
        `(current_period.${m.id} - historical_period.${m.id}) / NULLIF(historical_period.${m.id}, 0) AS ${m.id}_growth`
      ])
    ];

    const joinOn = dimensions.length > 0 
      ? ` ON ${dimensions.map(d => `current_period.${d.id} = historical_period.${d.id}`).join(' AND ')}` 
      : ' ON 1=1';

    const sql = `WITH ${ctes.join(', ')} SELECT ${finalSelect.join(', ')} FROM current_period LEFT JOIN historical_period${joinOn}`;

    return {
      sql,
      lineage: {
        ...currentResult.lineage,
        type: 'Comparison'
      }
    };
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
      const dim = this.semanticLayer.dimensions[f.field];
      if (availableEntityIds && !availableEntityIds.has(dim.entityId)) {
        throw new Error(`过滤字段不属于当前 CTE 路径: ${f.field}`);
      }
      const actualField = dim.column;
      if (f.operator === 'between') {
        if (!Array.isArray(f.value) || f.value.length !== 2) {
          throw new Error(`between 过滤器需要两个边界值: ${f.field}`);
        }
        conditions.push(`${actualField} BETWEEN ${this.formatLiteral(f.value[0])} AND ${this.formatLiteral(f.value[1])}`);
        return;
      }

      if (f.operator === 'in') {
        if (!Array.isArray(f.value)) {
          throw new Error(`in 过滤器需要数组值: ${f.field}`);
        }
        conditions.push(`${actualField} IN (${f.value.map(v => this.formatLiteral(v)).join(', ')})`);
        return;
      }

      conditions.push(`${actualField} ${f.operator} ${this.formatLiteral(f.value)}`);
    });

    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
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

    switch (timeRange.value) {
      case 'today':
        return [
          `${column} >= CURRENT_DATE`,
          `${column} < CURRENT_DATE + INTERVAL '1 day'`
        ];
      case 'yesterday':
        return [
          `${column} >= CURRENT_DATE - INTERVAL '1 day'`,
          `${column} < CURRENT_DATE`
        ];
      case 'last_7_days':
        return [
          `${column} >= CURRENT_DATE - INTERVAL '7 days'`,
          `${column} < CURRENT_DATE + INTERVAL '1 day'`
        ];
      case 'last_30_days':
        return [
          `${column} >= CURRENT_DATE - INTERVAL '30 days'`,
          `${column} < CURRENT_DATE + INTERVAL '1 day'`
        ];
      case 'this_month':
        return [
          `${column} >= DATE_TRUNC('month', CURRENT_DATE)`,
          `${column} < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`
        ];
      case 'last_month':
        return [
          `${column} >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
          `${column} < DATE_TRUNC('month', CURRENT_DATE)`
        ];
      case 'this_year':
        return [
          `${column} >= DATE_TRUNC('year', CURRENT_DATE)`,
          `${column} < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'`
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
