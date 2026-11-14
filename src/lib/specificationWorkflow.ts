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
export type StageTarget = { project_id: string; stage: string; target_date: string };

export function localCalendarDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function stageTargetStatus(targetDate: string | undefined, complete: boolean, today = localCalendarDay()) {
  if (!targetDate || complete) return undefined;
  return targetDate < today ? 'Overdue' : targetDate === today ? 'Due today' : 'Upcoming';
}

export function projectWorkflow(projectId: string, rows: StageCompletion[], targets: StageTarget[] = [], today = localCalendarDay()) {
  const targetDates = new Map(targets.filter(row => row.project_id === projectId).map(row => [row.stage, row.target_date]));
  const completionDates = new Map(rows.filter(row => row.project_id === projectId).map(row => [row.stage, row.completed_at]));
  const completed = new Set(completionDates.keys());
  const completedStages = specificationStages.filter(stage => completed.has(stage.id)).map(stage => ({ ...stage, completedAt: completionDates.get(stage.id) }));
  const remainingStages = specificationStages.filter(stage => !completed.has(stage.id)).map(stage => ({ ...stage, targetDate: targetDates.get(stage.id), targetStatus: stageTargetStatus(targetDates.get(stage.id), false, today) }));
  const count = completedStages.length;
  return { completed, completionDates, targetDates, completedStages, remainingStages, overdueCount: remainingStages.filter(stage => stage.targetStatus === 'Overdue').length, count, percent: Math.round(count / specificationStages.length * 100) };
}