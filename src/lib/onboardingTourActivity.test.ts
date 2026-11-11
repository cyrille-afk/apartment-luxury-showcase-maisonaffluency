import { describe, expect, it, vi, beforeEach } from 'vitest';
import { beginTourActivity, summarizeTourActivity, type TourRun } from './onboardingTourActivity';
const mocks = vi.hoisted(() => ({ consent: true, rpc: vi.fn(async () => ({error:null})) }));
vi.mock('@/integrations/supabase/client', () => ({supabase:{rpc:mocks.rpc}}));
vi.mock('@/lib/consent/consentStore', () => ({hasConsent:()=>mocks.consent}));
const now = Date.parse('2026-11-12T00:00:00Z');
const run = (extra: Partial<TourRun> = {}): TourRun => ({ started_at:'2026-11-11T23:00:00Z',updated_at:'2026-11-11T23:50:00Z',completed:false,replay:false,mode:'manual',exit_reason:null,last_step:'welcome',last_step_number:1,viewed_steps:['welcome'],total_steps:24,...extra });
beforeEach(()=>{mocks.consent=true;mocks.rpc.mockClear();});
describe('onboarding dashboard rules',()=>{
 it('computes replay and completion rates from the same start cohort',()=>{
  const result=summarizeTourActivity([run({completed:true}),run({replay:true}),run(),run()],['welcome'],now);
  expect(result.starts).toBe(4);expect(result.completed).toBe(1);expect(result.replays).toBe(1);expect(result.completionRate).toBe(25);expect(result.replayRate).toBe(25);
 });
 it('marks inactivity at 30 minutes, excludes completed and recently active runs',()=>{
  const result=summarizeTourActivity([run({updated_at:'2026-11-11T23:30:00Z'}),run(),run({completed:true,exit_reason:'page_exit'})],['welcome'],now);
  expect(result.steps[0].dropped).toBe(1);expect(result.pending).toBe(1);
 });
 it('counts explicit exits at their actual step and never invents viewed steps',()=>{
  const result=summarizeTourActivity([run({exit_reason:'dismissed',last_step:'quotes'})],['welcome','collection','quotes'],now);
  expect(result.steps[1].reached).toBe(0);expect(result.steps[2].dropped).toBe(1);
 });
 it('does not send operational analytics without consent',()=>{
  mocks.consent=false;expect(beginTourActivity('felix','manual',24)).toBeNull();expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it('blocks operational analytics when Global Privacy Control is enabled',()=>{
  Object.defineProperty(navigator,'globalPrivacyControl',{configurable:true,value:true});
  try { expect(beginTourActivity('felix','manual',24)).toBeNull();expect(mocks.rpc).not.toHaveBeenCalled(); }
  finally { Object.defineProperty(navigator,'globalPrivacyControl',{configurable:true,value:false}); }
 });
 it('queues starts before views and completion with the same run ID',async()=>{
  const activity=beginTourActivity('felix','manual',24,true);activity?.view('welcome',1);activity?.finish('beta-feedboard',24);
  await vi.waitFor(()=>expect(mocks.rpc).toHaveBeenCalledTimes(3));
  const events=mocks.rpc.mock.calls as unknown as [string,Record<string,unknown>][];
  expect(events.map(e=>e[1]._kind)).toEqual(['start','view','complete']);expect(new Set(events.map(e=>e[1]._id)).size).toBe(1);expect(events[0][1]._replay).toBe(true);
 });
});