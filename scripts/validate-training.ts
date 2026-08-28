import assert from 'node:assert/strict';
import { buildSession, defaultProfile, recoveryRecommendations, type WorkoutLog } from '../lib/training.ts';

const profile={...defaultProfile,startDate:'2026-08-24',equipment:'gym' as const,goal:'strength' as const,daysPerWeek:3 as const};
const base=buildSession(profile,new Date('2026-08-24T12:00:00'),[]);
assert.equal(base.phase,'基础');
assert.equal(base.title,'全身器械力量 A');
assert.equal(base.exercises[0].id,'leg_press');
assert.equal(base.recovery,false);

const deload=buildSession(profile,new Date('2026-10-12T12:00:00'),[]);
assert.equal(deload.week,8);
assert.equal(deload.phase,'减载');
assert.match(deload.adjustment,/减载周/);
assert.ok(deload.exercises[0].sets<base.exercises[0].sets);

const hardLog:WorkoutLog={id:'test',date:'2026-08-21',sessionId:'old',title:'测试',durationMinutes:20,caloriesBurned:100,
  completion:.5,averageRpe:9,exercises:[],note:'',completedAt:Date.parse('2026-08-23T12:00:00')};
const adjusted=buildSession(profile,new Date('2026-08-24T12:00:00'),[hardLog]);
assert.match(adjusted.adjustment,/减少 1 组/);
assert.ok(adjusted.durationMinutes<profile.sessionMinutes);

const recovery=recoveryRecommendations(base);
assert.ok(recovery.length>=2);
assert.ok(recovery.every((item)=>item.stretch&&item.foam&&item.massageGun));

console.log(JSON.stringify({base:base.title,phase:base.phase,deloadSets:deload.exercises[0].sets,adjustedMinutes:adjusted.durationMinutes,recoveryAreas:recovery.map((item)=>item.area)},null,2));
