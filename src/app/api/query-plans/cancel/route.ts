import { cancelPreviewedQueryPlan } from '@/lib/tools/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = cancelPreviewedQueryPlan({
      planId: body.planId,
      feedback: body.feedback,
      plan: body.plan,
      previewPlanHash: body.previewPlanHash,
    });

    return Response.json(result);
  } catch (error: any) {
    return Response.json(
      { error: error.message || '取消查询计划失败', code: 'CANCEL_QUERY_PLAN_FAILED' },
      { status: 500 }
    );
  }
}
