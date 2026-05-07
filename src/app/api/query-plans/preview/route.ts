import { createPreviewedQueryPlan } from '@/lib/tools/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = createPreviewedQueryPlan({
      plan: body.plan,
      explanation: body.explanation,
    });

    return Response.json(result);
  } catch (error: any) {
    return Response.json(
      {
        error: `计划生成失败: ${error.message || '无法编译查询计划'}`,
        code: 'PREVIEW_QUERY_PLAN_FAILED',
        executedSql: false,
      },
      { status: 400 }
    );
  }
}
