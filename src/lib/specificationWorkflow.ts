export const specificationStages = [
  { id: 'mood-board', url: '/trade/mood-boards' },
  { id: 'comparator', url: '/trade/comparator' },
  { id: 'annotation', url: '/trade/annotations' },
  { id: 'visualiser', url: '/trade/visualiser' },
  { id: 'tearsheet', url: '/trade/tearsheets' },
  { id: 'specification-sheet', url: '/trade/spec-generator' },
  { id: 'ffe-schedule', url: '/trade/ffe-schedule' },
  { id: 'quote', url: '/trade/quotes' },
] as const;

export type SpecificationStage = typeof specificationStages[number]['id'];
export type StageCompletion = { project_id: string; stage: string; completed_at: string };

export function projectWorkflow(projectId: string, rows: StageCompletion[]) {
  const completionDates = new Map(rows.filter(row => row.project_id === projectId).map(row => [row.stage, row.completed_at]));
  const completed = new Set(completionDates.keys());
  const completedStages = specificationStages.filter(stage => completed.has(stage.id)).map(stage => ({ ...stage, completedAt: completionDates.get(stage.id) }));
  const remainingStages = specificationStages.filter(stage => !completed.has(stage.id));
  const count = completedStages.length;
  return { completed, completionDates, completedStages, remainingStages, count, percent: Math.round(count / specificationStages.length * 100) };
}