import assert from 'node:assert/strict';
import {
  acceptPlanProposal, applySessionOverride, buildSession, createPlanProposal, defaultProfile, fatigueSignalCount,
  phaseForWeek, recoveryRecommendations, splitLabel, splitSchedule, type TrainingDayCount, type WorkoutLog,
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
assert.deepEqual(splitSchedule(2).map((day)=>day.title),['全身 A｜蹲推主导','全身 B｜髋拉主导']);
assert.deepEqual(splitSchedule(4).map((day)=>day.title),['下肢 A｜力量','上肢 A｜力量','下肢 B｜容量与单腿','上肢 B｜容量']);

const novice={...defaultProfile,startDate:'2026-08-24',equipment:'gym' as const,goal:'strength' as const,daysPerWeek:3 as const,mainLift1RM:{...defaultProfile.mainLift1RM,legPress:200,bench:100,deadlift:160,overheadPress:60,squat:140}};
const base=buildSession(novice,monday,[]);
assert.equal(base.phase,'基础');
assert.equal(base.title,'推｜胸肩肱三头');
assert.deepEqual(base.exercises.map((item)=>item.id),['bench','press','chest_fly','triceps','dead_bug']);
assert.equal(base.exercises[0].suggestedWeightKg,72.5,'基础阶段卧推进议重量应由 1RM × 72% 并按 2.5 kg 取整');
assert.equal(base.exercises[0].loadPercent1RM,72);
assert.equal(base.exercises[0].sets,4);
assert.equal(base.exercises[0].reps,'4–6 次');
assert.equal(phaseForWeek(8,'beginner',0),'基础','新手不能按固定第8周自动减载');

const pull=buildSession(novice,new Date('2026-08-26T12:00:00'),[]);
const legs=buildSession(novice,new Date('2026-08-28T12:00:00'),[]);
assert.equal(pull.title,'拉｜背部与握力');
assert.equal(legs.title,'腿｜下肢与臀腿');
assert.ok(!base.exercises.some((item)=>['lat_pulldown','cable_row','leg_press','leg_curl','leg_extension'].includes(item.id)),'推日不得混入背部或腿部主训练');
assert.ok(!pull.exercises.some((item)=>['bench','press','chest_fly','leg_press','leg_curl','leg_extension'].includes(item.id)),'拉日不得混入胸肩推或腿部主训练');
assert.ok(!legs.exercises.some((item)=>['bench','press','chest_fly','lat_pulldown','cable_row','row'].includes(item.id)),'腿日不得混入胸背主训练');

const hypertrophy=buildSession({...novice,goal:'hypertrophy' as const},monday,[]);
assert.deepEqual(hypertrophy.exercises.slice(0,4).map((item)=>[item.role,item.sets,item.reps]),[['T1',4,'6–10 次'],['T2',3,'8–12 次'],['T3',2,'10–15 次'],['T3',2,'10–15 次']]);
const strengthened=buildSession({...novice,level:'intermediate' as const},new Date('2026-09-21T12:00:00'),[]);
assert.equal(strengthened.phase,'强化');
assert.deepEqual([strengthened.exercises[0].sets,strengthened.exercises[0].reps],[5,'3–5 次']);

const customized=applySessionOverride(base,{date:base.date,updatedAt:Date.now(),exercises:[
  {exerciseId:'bench',role:'T1',sets:5,reps:'5 次',restSeconds:180,targetRpe:8,suggestedWeightKg:75},
  {exerciseId:'lat_pulldown',role:'T2',sets:4,reps:'8 次',restSeconds:90,targetRpe:8},
]});
assert.deepEqual(customized.exercises.map((item)=>[item.id,item.sets,item.reps]),[['bench',5,'5 次'],['lat_pulldown',4,'8 次']]);
assert.match(customized.adjustment,/只覆盖这一天/);

const progressionLogs:WorkoutLog[]=Array.from({length:2},(_,index)=>({
  id:`progress-${index}`,date:`2026-08-${20+index}`,sessionId:'old',title:'测试',durationMinutes:60,caloriesBurned:200,
  completion:1,averageRpe:8,exercises:[{exerciseId:'bench',completedSets:4,plannedSets:4,reps:'6',weightKg:100,rpe:8}],note:'',completedAt:Date.parse(`2026-08-${20+index}T12:00:00`),
}));
assert.equal(buildSession(novice,monday,progressionLogs).exercises[0].suggestedWeightKg,102.5,'连续完成后应小幅加重并按杠铃 2.5 kg 取整');
const failureLogs=progressionLogs.map((log,index)=>({...log,id:`fail-${index}`,averageRpe:9.5,exercises:[{exerciseId:'bench',completedSets:2,plannedSets:4,reps:'4',weightKg:100,rpe:9.5}]}));
assert.equal(buildSession(novice,monday,failureLogs).exercises[0].suggestedWeightKg,92.5,'连续两次失败后应回退约 7.5%');

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
