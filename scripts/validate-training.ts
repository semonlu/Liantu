import assert from 'node:assert/strict';
import {
  acceptPlanProposal, buildSession, createPlanProposal, defaultProfile, fatigueSignalCount,
  phaseForWeek, recoveryRecommendations, splitLabel, type TrainingDayCount, type WorkoutLog,
} from '../lib/training.ts';

const monday=new Date('2026-08-24T12:00:00');
for (const days of [2,3,4,5,6] as TrainingDayCount[]) {
  const profile={...defaultProfile,startDate:'2026-08-24',equipment:'gym' as const,daysPerWeek:days};
  const trainingDays=Array.from({length:7},(_,offset)=>{
    const date=new Date(monday); date.setDate(date.getDate()+offset);
    return buildSession(profile,date,[]);
  }).filter((session)=>!session.recovery);
  assert.equal(trainingDays.length,days,`${days} 天分化必须生成 ${days} 个训练日`);
  assert.ok(trainingDays.every((session)=>session.split===splitLabel(days)));
  assert.ok(trainingDays.flatMap((session)=>session.exercises).some((exercise)=>exercise.role==='T1'));
}

const novice={...defaultProfile,startDate:'2026-08-24',equipment:'gym' as const,goal:'strength' as const,daysPerWeek:3 as const,mainLift1RM:{...defaultProfile.mainLift1RM,legPress:200,bench:100,deadlift:160,overheadPress:60,squat:140}};
const base=buildSession(novice,monday,[]);
assert.equal(base.phase,'基础');
assert.equal(base.title,'全身 A｜蹲推');
assert.equal(base.exercises[0].id,'leg_press');
assert.equal(base.exercises[0].suggestedWeightKg,145,'基础阶段腿举建议重量应由 1RM × 72% 并按 5 kg 取整');
assert.equal(base.exercises[0].loadPercent1RM,72);
assert.equal(phaseForWeek(8,'beginner',0),'基础','新手不能按固定第8周自动减载');

const progressionLogs:WorkoutLog[]=Array.from({length:2},(_,index)=>({
  id:`progress-${index}`,date:`2026-08-${20+index}`,sessionId:'old',title:'测试',durationMinutes:60,caloriesBurned:200,
  completion:1,averageRpe:8,exercises:[{exerciseId:'leg_press',completedSets:4,plannedSets:4,reps:'6',weightKg:150,rpe:8}],note:'',completedAt:Date.parse(`2026-08-${20+index}T12:00:00`),
}));
assert.equal(buildSession(novice,monday,progressionLogs).exercises[0].suggestedWeightKg,155,'连续完成后应小幅加重并按器械 5 kg 取整');
const failureLogs=progressionLogs.map((log,index)=>({...log,id:`fail-${index}`,averageRpe:9.5,exercises:[{exerciseId:'leg_press',completedSets:2,plannedSets:4,reps:'4',weightKg:150,rpe:9.5}]}));
assert.equal(buildSession(novice,monday,failureLogs).exercises[0].suggestedWeightKg,140,'连续两次失败后应回退约 7.5%');

const hardLogs:WorkoutLog[]=Array.from({length:2},(_,index)=>({
  id:`hard-${index}`,date:`2026-09-${10+index}`,sessionId:'old',title:'测试',durationMinutes:20,caloriesBurned:100,
  completion:.5,averageRpe:9.5,exercises:[],note:index===0?'膝关节不适':'',completedAt:Date.parse(`2026-09-${20+index}T12:00:00`),
}));
const intermediate={...novice,level:'intermediate' as const,sleepHours:6,readiness:2 as const,startDate:'2026-08-24'};
assert.ok(fatigueSignalCount(intermediate,hardLogs)>=2);
const deload=buildSession(intermediate,new Date('2026-09-21T12:00:00'),hardLogs);
assert.equal(deload.phase,'减载');
assert.match(deload.adjustment,/主动减载建议/);
assert.ok(deload.exercises[0].sets<base.exercises[0].sets);

const structural={...novice,daysPerWeek:4 as const};
const proposal=createPlanProposal(novice,structural,'改为上下肢四分化',['每周可稳定训练四天'],'structure',monday);
assert.equal(proposal.status,'pending');
assert.equal(proposal.effectiveFrom,'2026-08-31');
const accepted=acceptPlanProposal(proposal,[]);
assert.equal(accepted.version.version,1);
assert.equal(accepted.versions.length,1);

const recovery=recoveryRecommendations(base);
assert.ok(recovery.length>=2);
assert.ok(recovery.every((item)=>item.stretch&&item.foam&&item.massageGun));

console.log(JSON.stringify({base:base.title,split:base.split,deloadSets:deload.exercises[0].sets,proposalEffectiveFrom:proposal.effectiveFrom,recoveryAreas:recovery.map((item)=>item.area)},null,2));
