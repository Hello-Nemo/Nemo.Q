import { QueryPlan, SemanticLayer, Metric, Dimension, Entity, Relationship } from './types';

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
 * 工业级 SQL 编译器：支持 Dijkstra 路径发现与 Multi-pass 编译
 */
export class SQLCompiler {
  private semanticLayer: SemanticLayer;
  private pathFinder: PathFinder;

  constructor(semanticLayer: SemanticLayer) {
    this.semanticLayer = semanticLayer;
    this.pathFinder = new PathFinder(semanticLayer);
  }

  compile(plan: QueryPlan): string {
    const metrics = plan.metrics.map(m => this.semanticLayer.metrics[m.id]).filter(Boolean);
    const dimensions = plan.dimensions.map(d => this.semanticLayer.dimensions[d.id]).filter(Boolean);

    // 检查是否涉及多个事实表 (Chasm Trap 识别)
    const factEntities = new Set<string>();
    metrics.forEach(m => {
      if (this.semanticLayer.entities[m.entityId].type === 'fact') {
        factEntities.add(m.entityId);
      }
    });

    if (factEntities.size > 1) {
      return this.compileMultiPass(plan, metrics, dimensions, factEntities);
    } else {
      return this.compileSinglePass(plan, metrics, dimensions);
    }
  }

  /**
   * 单阶段编译：标准 Join 逻辑
   */
  private compileSinglePass(plan: QueryPlan, metrics: Metric[], dimensions: Dimension[]): string {
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
      ...dimensions.map(d => `${d.column} AS ${d.id}`),
      ...metrics.map(m => `${m.expression} AS ${m.id}`)
    ];

    const whereClause = this.buildWhereClause(plan, metrics);
    const groupByClause = dimensions.length > 0 && metrics.length > 0 
      ? ` GROUP BY ${dimensions.map((_, i) => i + 1).join(', ')}` 
      : '';
    const orderByClause = plan.orderBy?.length 
      ? ` ORDER BY ${plan.orderBy.map(o => `${o.field} ${o.direction}`).join(', ')}` 
      : '';
    const limitClause = plan.limit ? ` LIMIT ${plan.limit}` : '';

    return `SELECT ${selectItems.join(', ')} ${fromClause}${whereClause}${groupByClause}${orderByClause}${limitClause}`;
  }

  /**
   * 多阶段编译 (Multi-pass)：应对 Chasm Trap，保证指标聚合准确性
   */
  private compileMultiPass(plan: QueryPlan, metrics: Metric[], dimensions: Dimension[], factEntities: Set<string>): string {
    const ctes: string[] = [];
    const factList = Array.from(factEntities);

    // 1. 为每个事实表生成独立的局部聚合 CTE
    factList.forEach((factId, index) => {
      const factMetrics = metrics.filter(m => m.entityId === factId);
      const factEntitiesRequired = new Set<string>([factId, ...dimensions.map(d => d.entityId)]);
      const path = this.pathFinder.findBestPath(factEntitiesRequired);
      
      const selectItems = [
        ...dimensions.map(d => `${d.column} AS dim_${d.id}`),
        ...factMetrics.map(m => `${m.expression} AS ${m.id}`)
      ];
      
      const joins = this.buildJoinClause(path);
      const groupBy = ` GROUP BY ${dimensions.map((_, i) => i + 1).join(', ')}`;
      
      ctes.push(`fact_${index} AS (SELECT ${selectItems.join(', ')} ${joins}${groupBy})`);
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
      const joinOn = dimensions.map(d => `fact_0.dim_${d.id} = fact_${i}.dim_${d.id}`).join(' AND ');
      finalFrom += ` FULL OUTER JOIN fact_${i} ON ${joinOn}`;
    }

    const orderBy = plan.orderBy?.length 
      ? ` ORDER BY ${plan.orderBy.map(o => `${o.field} ${o.direction}`).join(', ')}` 
      : '';
    const limit = plan.limit ? ` LIMIT ${plan.limit}` : '';

    return `WITH ${ctes.join(', ')} SELECT ${finalSelect.join(', ')} ${finalFrom}${orderBy}${limit}`;
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

  private buildWhereClause(plan: QueryPlan, metrics: Metric[]): string {
    const conditions: string[] = [];
    
    if (plan.timeRange) {
      const col = plan.timeRange.column || (metrics[0]?.entityId === 'orders' ? 'orders.order_date' : null);
      if (col) {
        if (plan.timeRange.value === 'last_month') {
          conditions.push(`${col} >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`);
          conditions.push(`${col} < DATE_TRUNC('month', CURRENT_DATE)`);
        }
      }
    }

    plan.filters.forEach(f => {
      const dim = this.semanticLayer.dimensions[f.field];
      const actualField = dim ? dim.column : f.field;
      let val = f.value;
      if (f.operator === 'in' && Array.isArray(f.value)) {
        val = `(${f.value.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ')})`;
      } else if (typeof f.value === 'string') {
        val = `'${f.value}'`;
      }
      conditions.push(`${actualField} ${f.operator} ${val}`);
    });

    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  }
}
