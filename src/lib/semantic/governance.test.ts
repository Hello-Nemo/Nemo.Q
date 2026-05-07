import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SQLCompiler } from './compiler';
import type { QueryPlan, SemanticLayer } from './types';

const poolConnect = vi.fn();

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(function MockPool() {
      return {
        connect: poolConnect,
        end: vi.fn()
      };
    })
  }
}));

function loadSemanticLayer(): SemanticLayer {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src/lib/semantic-layer.json'), 'utf8')
  );
}

const certifiedSalesByCountryPlan: QueryPlan = {
  intent: 'metric_query',
  metrics: [{ id: 'sales_amount' }],
  dimensions: [{ id: 'user_country' }],
  filters: []
};

describe('semantic governance contract', () => {
  beforeEach(() => {
    poolConnect.mockReset();
  });

  it('declares governance metadata for metrics, dimensions, relationships, and entity time fields', () => {
    const layer = loadSemanticLayer();

    for (const metric of Object.values(layer.metrics)) {
      expect(metric.certified, `${metric.id} certified`).toEqual(expect.any(Boolean));
      expect(metric.timeColumn, `${metric.id} timeColumn`).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(metric.businessDefinition, `${metric.id} businessDefinition`).toEqual(expect.any(String));
      expect(metric.businessDefinition?.length, `${metric.id} businessDefinition length`).toBeGreaterThan(8);
      expect(metric.allowDetailDrilldown, `${metric.id} allowDetailDrilldown`).toEqual(expect.any(Boolean));
    }

    for (const dimension of Object.values(layer.dimensions)) {
      expect(dimension.certified, `${dimension.id} certified`).toEqual(expect.any(Boolean));
    }

    for (const relationship of layer.relationships) {
      expect(
        relationship.certified,
        `${relationship.fromEntityId}->${relationship.toEntityId} certified`
      ).toEqual(expect.any(Boolean));
    }

    for (const entity of Object.values(layer.entities)) {
      expect(entity.defaultTimeColumn, `${entity.id} defaultTimeColumn`).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('returns certified audit metadata for a fully certified semantic plan', () => {
    const result = new SQLCompiler(loadSemanticLayer()).compile(certifiedSalesByCountryPlan);

    expect(result.certification).toMatchObject({
      isCertified: true,
      certificationLevel: 'certified_plan',
      status: 'certified'
    });
    expect(result.certification.metrics).toEqual([
      expect.objectContaining({
        id: 'sales_amount',
        certified: true,
        timeColumn: 'orders.order_date',
        businessDefinition: expect.any(String),
        allowDetailDrilldown: expect.any(Boolean)
      })
    ]);
    expect(result.certification.dimensions).toEqual([
      expect.objectContaining({ id: 'user_country', certified: true })
    ]);
    expect(result.certification.relationships).toEqual([
      expect.objectContaining({
        fromEntityId: 'users',
        toEntityId: 'orders',
        certified: true
      })
    ]);
  });

  it('marks plans as exploratory when an uncertified relationship participates', () => {
    const layer = loadSemanticLayer();
    const exploratoryLayer: SemanticLayer = {
      ...layer,
      relationships: layer.relationships.map((relationship) =>
        relationship.fromEntityId === 'users' && relationship.toEntityId === 'orders'
          ? { ...relationship, certified: false }
          : relationship
      )
    };

    const result = new SQLCompiler(exploratoryLayer).compile(certifiedSalesByCountryPlan);

    expect(result.certification).toMatchObject({
      isCertified: false,
      certificationLevel: 'semantic_compiled',
      status: 'exploratory'
    });
    expect(result.certification.reasons).toContain(
      'relationship users->orders is not certified'
    );
  });

  it('semanticQuery audit mirrors compiler certification status', async () => {
    const client = {
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
      release: vi.fn()
    };
    poolConnect.mockResolvedValue(client);
    const { semanticQuery } = await import('../tools/db');

    const result = await (semanticQuery as any).execute({
      explanation: '按国家查询认证销售额口径',
      plan: certifiedSalesByCountryPlan
    });

    expect(result.audit).toMatchObject({
      isCertified: true,
      certificationLevel: 'certified_plan',
      certification: {
        status: 'certified',
        metrics: [
          expect.objectContaining({
            id: 'sales_amount',
            certified: true,
            businessDefinition: expect.any(String)
          })
        ],
        relationships: [
          expect.objectContaining({
            fromEntityId: 'users',
            toEntityId: 'orders',
            certified: true
          })
        ]
      }
    });
    expect(client.release).toHaveBeenCalledOnce();
  });
});
