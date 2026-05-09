import { executeSemanticQueryPlan } from '@/lib/tools/db';
import { queryPlanSchema } from '@/lib/semantic/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = queryPlanSchema.safeParse(body?.plan);

    if (!parsed.success) {
      return Response.json(
        {
          error: 'Invalid query plan',
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await executeSemanticQueryPlan(
      parsed.data,
      body?.explanation || '用户确认执行预览查询计划。'
    );

    return Response.json(result);
  } catch (error: any) {
    console.error('[EXECUTE_PLAN_ERROR]', error);
    return Response.json(
      { error: error.message || 'Failed to execute query plan' },
      { status: 500 }
    );
  }
}
