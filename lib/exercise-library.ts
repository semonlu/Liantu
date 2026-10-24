import records from './generated/free-exercise-db.json' with { type: 'json' };
import { chineseExerciseName } from './exercise-name-zh.ts';
import type { Equipment, ExerciseDefinition } from './training.ts';

export type FreeExerciseRecord = {
  id:string;
  name:string;
  force:string|null;
  level:string|null;
  mechanic:string|null;
  equipment:string|null;
  primaryMuscles:string[];
  secondaryMuscles:string[];
  instructions:string[];
  category:string|null;
  images:string[];
};

const muscleLabels:Record<string,string>={
  abdominals:'腹部',abductors:'髋外展肌',adductors:'髋内收肌',biceps:'肱二头肌',calves:'小腿',chest:'胸部',forearms:'前臂',glutes:'臀部',hamstrings:'大腿后侧',lats:'背阔肌','lower back':'下背部','middle back':'中背部',neck:'颈部',quadriceps:'股四头肌',shoulders:'肩部',traps:'斜方肌',triceps:'肱三头肌',
};
const equipmentLabels:Record<string,string>={
  'body only':'徒手',machine:'固定器械',cable:'绳索',barbell:'杠铃',dumbbell:'哑铃',kettlebells:'壶铃',bands:'弹力带','medicine ball':'药球','exercise ball':'健身球','foam roll':'泡沫轴','e-z curl bar':'曲杆',other:'其他器械',
};
const categoryLabels:Record<string,string>={strength:'力量',stretching:'拉伸',cardio:'心肺',powerlifting:'力量举',strongman:'强人',plyometrics:'爆发力','olympic weightlifting':'奥举'};
const levelLabels:Record<string,string>={beginner:'初级',intermediate:'中级',expert:'高级'};
const generatedSupplementImages:Record<string,string>={
  Kettlebell_Halo:'/generated-exercises/free-db-supplements/Kettlebell_Halo.png',
  Kettlebell_Halo_With_Overhead_Extension:'/generated-exercises/free-db-supplements/Kettlebell_Halo_With_Overhead_Extension.png',
  Kettlebell_Overhead_Triceps_Extension:'/generated-exercises/free-db-supplements/Kettlebell_Overhead_Triceps_Extension.png',
};

export const freeExerciseRecords=records as FreeExerciseRecord[];
export const freeExerciseRecordBySourceId:Record<string,FreeExerciseRecord>=Object.fromEntries(freeExerciseRecords.map((item)=>[item.id,item]));

function supportedEquipment(value:string|null):Equipment[] {
  if(!value||value==='body only')return ['bodyweight','dumbbell','gym'];
  if(value==='dumbbell')return ['dumbbell','gym'];
  return ['gym'];
}

export function freeExerciseDefinition(item:FreeExerciseRecord):ExerciseDefinition {
  const muscles=item.primaryMuscles.map((muscle)=>muscleLabels[muscle]??muscle).join('、')||'全身';
  const category=categoryLabels[item.category??'']??item.category??'训练';
  const equipment=equipmentLabels[item.equipment??'']??item.equipment??'无特定器械';
  return {
    id:`fedb:${item.id}`,
    name:chineseExerciseName(item.name,{body:muscles,equipment,category}),
    englishName:item.name,
    target:`${muscles} · ${category} · ${equipment}`,
    equipment:supportedEquipment(item.equipment),
    cues:item.instructions.length?item.instructions:['按可控幅度完成动作，并根据目标 RPE 调整重量。'],
    easier:'降低重量、减少动作幅度，或选择动作库中同肌群的初级变式。',
    images:item.images.length?item.images:[generatedSupplementImages[item.id]].filter((image):image is string=>Boolean(image)),
    source:'free-exercise-db',
    sourceId:item.id,
    level:levelLabels[item.level??'']??item.level??'未标注',
    category,
    primaryMuscles:item.primaryMuscles.map((muscle)=>muscleLabels[muscle]??muscle),
    secondaryMuscles:item.secondaryMuscles.map((muscle)=>muscleLabels[muscle]??muscle),
  };
}

export const freeExerciseDefinitions=freeExerciseRecords.map(freeExerciseDefinition);
export const freeExerciseDefinitionById:Record<string,ExerciseDefinition>=Object.fromEntries(freeExerciseDefinitions.map((item)=>[item.id,item]));

export const curatedFreeExerciseIds:Record<string,string>={
  leg_press:'Leg_Press',bench:'Barbell_Bench_Press_-_Medium_Grip',lat_pulldown:'Close-Grip_Front_Lat_Pulldown',leg_curl:'Seated_Leg_Curl',cable_row:'Seated_Cable_Rows',leg_extension:'Leg_Extensions',chest_fly:'Butterfly',triceps:'Triceps_Pushdown_-_Rope_Attachment',squat:'Goblet_Squat',body_squat:'Bodyweight_Squat',pushup:'Pushups',row:'Bent_Over_Two-Dumbbell_Row',dead_bug:'Dead_Bug',lunge:'Dumbbell_Rear_Lunge',plank:'Plank',jumping_jack:'Star_Jump',mountain:'Mountain_Climbers',bridge:'Butt_Lift_Bridge',rdl:'Romanian_Deadlift',press:'Dumbbell_Shoulder_Press',swing:'One-Arm_Kettlebell_Swings',carry:'Farmers_Walk',side_plank:'Side_Bridge',walk:'Walking_Treadmill',
};
