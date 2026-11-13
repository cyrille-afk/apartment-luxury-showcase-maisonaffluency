import { describe, it, expect } from 'vitest';
import { projectWorkflow, specificationStages } from './specificationWorkflow';

describe('Specification workflow', () => {
  it('partitions completed and remaining stages per project in workflow order', () => {
    const result = projectWorkflow('one', [
      { project_id: 'one', stage: 'quote', completed_at: '2026-11-13' },
      { project_id: 'one', stage: 'mood-board', completed_at: '2026-11-13' },
      { project_id: 'two', stage: 'visualiser', completed_at: '2026-11-13' },
    ]);
    expect(result.completedStages.map(stage => stage.id)).toEqual(['mood-board', 'quote']);
    expect(result.remainingStages.map(stage => stage.id)).toEqual(['comparator', 'annotation', 'visualiser', 'tearsheet', 'specification-sheet', 'ffe-schedule']);
    expect(projectWorkflow('one', []).remainingStages).toHaveLength(8);
    expect(projectWorkflow('one', specificationStages.map(stage => ({ project_id: 'one', stage: stage.id, completed_at: '2026-11-13' }))).remainingStages).toHaveLength(0);
  });
  it('tracks eight stages in the requested design workflow order', () => {
    expect(specificationStages.map(stage => stage.id)).toEqual(['mood-board', 'comparator', 'annotation', 'visualiser', 'tearsheet', 'specification-sheet', 'ffe-schedule', 'quote']);
  });
  it('keeps project completion independent', () => {
    const rows = [{ project_id: 'one', stage: 'mood-board', completed_at: '2026-11-13' }];
    expect(projectWorkflow('one', rows).count).toBe(1);
    expect(projectWorkflow('one', rows).percent).toBe(13);
    expect(projectWorkflow('two', rows).count).toBe(0);
  });
  it('reopening a stage reduces progress without requiring prior stages', () => {
    const rows = specificationStages.map(stage => ({ project_id: 'one', stage: stage.id, completed_at: '2026-11-13' }));
    expect(projectWorkflow('one', rows).percent).toBe(100);
    expect(projectWorkflow('one', rows.filter(row => row.stage !== 'quote')).count).toBe(7);
    expect(projectWorkflow('one', rows.filter(row => row.stage === 'quote')).count).toBe(1);
  });
});