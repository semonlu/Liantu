import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const upstream=path.resolve(root,'..','Liantu-Upstreams','exercises-dataset');
const sourceJson=path.join(upstream,'data','exercises.json');
const sourceSchema=path.join(upstream,'data','exercises.schema.json');
const sourceLicense=path.join(upstream,'LICENSE');
const sourceNotice=path.join(upstream,'NOTICE.md');
for(const file of [sourceJson,sourceSchema,sourceLicense,sourceNotice]){
  if(!fs.existsSync(file))throw new Error(`缺少 exercises-dataset 文件：${file}`);
}

const records=JSON.parse(fs.readFileSync(sourceJson,'utf8'));
if(!Array.isArray(records)||records.length!==1324)throw new Error(`动作数异常：${records.length}`);

const assetRoot=path.join(root,'public','exercises-dataset');
fs.mkdirSync(assetRoot,{recursive:true});
fs.cpSync(path.join(upstream,'images'),path.join(assetRoot,'images'),{recursive:true,force:true});
fs.cpSync(path.join(upstream,'videos'),path.join(assetRoot,'videos'),{recursive:true,force:true});
fs.copyFileSync(sourceLicense,path.join(assetRoot,'LICENSE'));
fs.copyFileSync(sourceNotice,path.join(assetRoot,'NOTICE.md'));
fs.copyFileSync(sourceSchema,path.join(assetRoot,'exercises.schema.json'));

const compact=records.map((item)=>({
  id:String(item.id),
  name:item.name,
  category:item.category,
  bodyPart:item.body_part,
  equipment:item.equipment,
  target:item.target,
  muscleGroup:item.muscle_group,
  secondaryMuscles:item.secondary_muscles??[],
  instructionsZh:item.instructions?.zh??item.instructions?.en??'',
  instructionStepsZh:item.instruction_steps?.zh??item.instruction_steps?.en??[],
  thumbnail:`/exercises-dataset/${item.image}`,
  animation:`/exercises-dataset/${item.gif_url}`,
  attribution:item.attribution??'© Gym visual — https://gymvisual.com/',
}));
const generatedDir=path.join(root,'lib','generated');
fs.mkdirSync(generatedDir,{recursive:true});
fs.writeFileSync(path.join(generatedDir,'exercises-dataset.json'),JSON.stringify(compact));
fs.writeFileSync(path.join(assetRoot,'SOURCE.json'),JSON.stringify({
  source:'https://github.com/hasaneyldrm/exercises-dataset',
  commit:'7455efae41b330c265e7cd4b78dfa848e7ce5ebd',
  importedAt:new Date().toISOString(),
  exerciseCount:compact.length,
  attribution:'© Gym visual — https://gymvisual.com/',
},null,2));
console.log(`Imported ${compact.length} exercises, thumbnails and GIF animations`);
