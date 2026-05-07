export function getPreviewToolPartInput(part: any) {
  return part?.input || part?.args || part?.invocation?.args;
}

export function getPreviewToolPartOutput(part: any) {
  return part?.output || part?.result;
}

export function isPreviewQueryPlanPart(part: any): boolean {
  return part?.type === 'tool-previewQueryPlan';
}

export function needsPreviewHydration(part: any): boolean {
  if (!isPreviewQueryPlanPart(part)) return false;

  const input = getPreviewToolPartInput(part);
  const output = getPreviewToolPartOutput(part);

  if (output?.error || output?.code) return false;

  return !!input?.plan && (!output?.sql || !output?.planId);
}

export function getPreviewHydrationKey(part: any): string | undefined {
  if (!needsPreviewHydration(part)) return undefined;
  return part.toolCallId || JSON.stringify(getPreviewToolPartInput(part));
}

export function hydratePreviewToolPart(part: any, output: any) {
  if (!isPreviewQueryPlanPart(part)) return part;

  return {
    ...part,
    state: 'output-available',
    input: getPreviewToolPartInput(part),
    output,
  };
}
