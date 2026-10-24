import fs from 'node:fs';
import path from 'node:path';
import { exerciseCatalog } from '../lib/training.ts';
import { freeExerciseDefinitions } from '../lib/exercise-library.ts';
import { datasetExerciseDefinitions } from '../lib/exercises-dataset-library.ts';

const root=process.cwd();
const legacyManifest=JSON.parse(fs.readFileSync(path.join(root,'Training-Nutrition-KB','exercise-media.json'),'utf8')) as Array<{exerciseId:string;status:string;localPath?:string}>;
const legacyMedia=Object.fromEntries(legacyManifest.filter((item)=>item.localPath&&['downloaded','generated'].includes(item.status)).map((item)=>[item.exerciseId,item]));
const toFile=(url:string)=>path.join(root,'public',...url.split('/').filter(Boolean));
const missing:string[]=[];
const checked=new Set<string>();
const validateFile=(url:string,label:string)=>{
  if(checked.has(url))return;
  checked.add(url);
  if(!fs.existsSync(toFile(url)))missing.push(`${label}: file missing ${url}`);
};

for(const exercise of freeExerciseDefinitions){
  if(!exercise.images?.length){missing.push(`${exercise.id}: no image`);continue;}
  for(const image of exercise.images)validateFile(image,exercise.id);
}
for(const exercise of datasetExerciseDefinitions){
  if(!exercise.thumbnail||!exercise.animation){missing.push(`${exercise.id}: thumbnail or animation missing`);continue;}
  validateFile(exercise.thumbnail,exercise.id);
  validateFile(exercise.animation,exercise.id);
  if(!exercise.attribution)missing.push(`${exercise.id}: attribution missing`);
}
for(const exercise of Object.values(exerciseCatalog)){
  if(exercise.animation){validateFile(exercise.animation,exercise.id);continue;}
  if(exercise.images?.length){for(const image of exercise.images)validateFile(image,exercise.id);continue;}
  const legacy=legacyMedia[exercise.id];
  if(!legacy?.localPath){missing.push(`${exercise.id}: no packaged media`);continue;}
  validateFile(legacy.localPath,exercise.id);
}
for(const required of [
  'public/exercise-db/LICENSE.md','public/exercise-db/SOURCE.json',
  'public/exercises-dataset/LICENSE','public/exercises-dataset/NOTICE.md','public/exercises-dataset/SOURCE.json',
])if(!fs.existsSync(path.join(root,required)))missing.push(`source metadata missing: ${required}`);

if(missing.length)throw new Error(`动作媒体校验失败：\n${missing.join('\n')}`);
const supplements=freeExerciseDefinitions.filter((item)=>item.images?.some((image)=>image.includes('/generated-exercises/free-db-supplements/'))).length;
console.log(`动作媒体完整性通过：exercises-dataset ${datasetExerciseDefinitions.length} 个 GIF + 缩略图，free-exercise-db ${freeExerciseDefinitions.length} 个动作 / 1746 张原图，AI 补图 ${supplements} 张。`);
console.log(`计划内置动作 ${Object.keys(exerciseCatalog).length} 个均有离线媒体，并优先使用 exercises-dataset 动图。`);
