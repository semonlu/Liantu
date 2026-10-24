import records from './generated/exercises-dataset.json' with { type: 'json' };
import { chineseExerciseName } from './exercise-name-zh.ts';
import type { Equipment, ExerciseDefinition } from './training.ts';

type DatasetExercise={
  id:string;
  name:string;
  category:string;
  bodyPart:string;
  equipment:string;
  target:string;
  muscleGroup:string;
  secondaryMuscles:string[];
  instructionsZh:string;
  instructionStepsZh:string[];
  thumbnail:string;
  animation:string;
  attribution:string;
};

const bodyLabels:Record<string,string>={
  back:'背部',cardio:'心肺',chest:'胸部','lower arms':'前臂','lower legs':'小腿',neck:'颈部',shoulders:'肩部','upper arms':'上臂','upper legs':'大腿',waist:'核心腰腹',
};
const equipmentLabels:Record<string,string>={
  'body weight':'徒手',dumbbell:'哑铃',barbell:'杠铃',cable:'绳索','leverage machine':'固定器械',band:'弹力带','smith machine':'史密斯机',kettlebell:'壶铃',weighted:'负重','stability ball':'健身球','ez barbell':'曲杆',rope:'战绳',sled:'雪橇',roller:'泡沫轴',assisted:'辅助器械',bosu:'波速球',wheel:'健腹轮',trap_bar:'六角杠',other:'其他器械',
};

function supportedEquipment(value:string):Equipment[]{
  if(value==='body weight')return ['bodyweight','dumbbell','gym'];
  if(['dumbbell','kettlebell'].includes(value))return ['dumbbell','gym'];
  return ['gym'];
}

const datasetRecords=records as DatasetExercise[];

export const datasetExerciseDefinitions:ExerciseDefinition[]=datasetRecords.map((item)=>{
  const body=bodyLabels[item.bodyPart]??item.bodyPart;
  const equipment=equipmentLabels[item.equipment]??item.equipment;
  const cues=item.instructionStepsZh.length?item.instructionStepsZh:item.instructionsZh.split(/[。.!]\s*/).map((step)=>step.trim()).filter(Boolean);
  return {
    id:`logpress:${item.id}`,
    name:chineseExerciseName(item.name,{body,equipment,target:item.target}),
    englishName:item.name,
    target:`${body} · ${item.target} · ${equipment}`,
    equipment:supportedEquipment(item.equipment),
    cues:cues.length?cues:['保持动作可控，根据目标 RPE 选择重量。'],
    easier:'降低负荷或动作幅度；也可搜索相同部位的徒手、辅助或固定器械变式。',
    thumbnail:item.thumbnail,
    animation:item.animation,
    attribution:item.attribution,
    source:'exercises-dataset',
    sourceId:item.id,
    category:body,
    primaryMuscles:[item.target,item.muscleGroup].filter(Boolean),
    secondaryMuscles:item.secondaryMuscles,
  };
});

export const datasetExerciseDefinitionById:Record<string,ExerciseDefinition>=Object.fromEntries(datasetExerciseDefinitions.map((item)=>[item.id,item]));

export const curatedDatasetExerciseIds:Record<string,string>={
  leg_press:'1463',bench:'0025',lat_pulldown:'0818',leg_curl:'0599',cable_row:'0861',leg_extension:'0585',chest_fly:'0596',triceps:'0241',squat:'1760',pushup:'0662',row:'0293',dead_bug:'0276',lunge:'0381',jumping_jack:'3224',mountain:'0630',bridge:'3013',rdl:'0085',press:'0405',swing:'0549',carry:'2133',side_plank:'0705',walk:'3666',
};
