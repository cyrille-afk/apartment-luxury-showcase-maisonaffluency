import { describe, it, expect } from 'vitest';
import { projectWorkflow, specificationStages, stageTargetStatus, localCalendarDay } from './specificationWorkflow';

describe('Specification workflow', () => {
  it('marks only unfinished targets before today overdue', () => {
    expect(stageTargetStatus('2026-11-12', false, '2026-11-13')).toBe('Overdue');
    expect(stageTargetStatus('2026-11-12', true, '2026-11-13')).toBeUndefined();
  });
  it('keeps today due today and future dates upcoming', () => {
    expect(stageTargetStatus('2026-11-13', false, '2026-11-13')).toBe('Due today');
    expect(stageTargetStatus('2026-11-14', false, '2026-11-13')).toBe('Upcoming');
    expect(stageTargetStatus(undefined, false, '2026-11-13')).toBeUndefined();
  });
  it('preserves targets independently of completion and scopes overdue counts to the project', () => {
    const targets = [{ project_id: 'one', stage: 'quote', target_date: '2026-11-12' }, { project_id: 'two', stage: 'mood-board', target_date: '2026-11-11' }];
    const completed = projectWorkflow('one', [{ project_id: 'one', stage: 'quote', completed_at: '2026-11-13' }], targets, '2026-11-13');
    expect(completed.overdueCount).toBe(0);
    expect(completed.targetDates.get('quote')).toBe('2026-11-12');
    const reopened = projectWorkflow('one', [], targets, '2026-11-13');
    expect(reopened.overdueCount).toBe(1);
    expect(reopened.targetDates.has('mood-board')).toBe(false);
    expect(reopened.remainingStages.find(stage => stage.id === 'quote')?.targetStatus).toBe('Overdue');
  });
  it('compares local calendar dates rather than shifting them through UTC', () => {
    expect(localCalendarDay(new Date(2026, 10, 13, 0, 1))).toBe('2026-11-13');
  });
  it('uses each stage’s saved completion timestamp without crossing project boundaries', () => {
    const result = projectWorkflow('one', [
      { project_id: 'one', stage: 'mood-board', completed_at: '2026-11-12T02:30:00Z' },
      { project_id: 'one', stage: 'quote', completed_at: '2026-11-13T02:41:00Z' },
      { project_id: 'two', stage: 'mood-board', completed_at: '2026-11-10T10:00:00Z' },
    ]);
    expect(result.completionDates.get('mood-board')).toBe('2026-11-12T02:30:00Z');
    expect(result.completedStages.map(stage => stage.completedAt)).toEqual(['2026-11-12T02:30:00Z', '2026-11-13T02:41:00Z']);
    expect(result.completionDates.has('visualiser')).toBe(false);
  });
  it('removes a reopened stage’s date and uses its newly saved completion date', () => {
    expect(projectWorkflow('one', []).completionDates.has('quote')).toBe(false);
    expect(projectWorkflow('one', [{ project_id: 'one', stage: 'quote', completed_at: '2026-11-13T03:00:00Z' }]).completionDates.get('quote')).toBe('2026-11-13T03:00:00Z');
  });
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