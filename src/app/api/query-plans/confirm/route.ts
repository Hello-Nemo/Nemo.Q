import { confirmPreviewedQueryPlan } from '@/lib/tools/db';

function statusForResult(result: any): number {
  if (result?.code === 'QUERY_PLAN_NOT_FOUND') return 404;
  if (result?.code === 'PREVIEW_EXECUTION_MISMATCH') return 409;
  return 200;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await confirmPreviewedQueryPlan({
      planId: body.planId,
      plan: body.plan,
      explanation: body.explanation,
      previewPlanHash: body.previewPlanHash,
      previewSqlHash: body.previewSqlHash,
    });

    return Response.json(result, { status: statusForResult(result) });
  } catch (error: any) {
    return Response.json(
      { error: error.message || '确认查询计划失败', code: 'CONFIRM_QUERY_PLAN_FAILED' },
      { status: 500 }
    );
  }
}
