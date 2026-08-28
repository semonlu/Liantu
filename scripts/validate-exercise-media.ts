import fs from 'node:fs';
import path from 'node:path';
import { exerciseCatalog } from '../lib/training.ts';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'Training-Nutrition-KB','exercise-media.json'),'utf8')) as Array<{exerciseId:string;status:string;localPath?:string;author?:string;license?:string;licenseUrl?:string}>;
const exerciseMedia=Object.fromEntries(manifest.filter((item)=>item.localPath&&['downloaded','generated'].includes(item.status)).map((item)=>[item.exerciseId,{...item,image:item.localPath,source:item.status==='generated'?'ai':'wger'}]));
const missing:string[]=[];
for(const exercise of Object.values(exerciseCatalog)){
  const media=exerciseMedia[exercise.id];
  if(!media?.image){missing.push(`${exercise.id}: no local image`);continue;}
  const file=path.join(root,'public',...media.image.split('/').filter(Boolean));
  if(!fs.existsSync(file))missing.push(`${exercise.id}: file missing ${file}`);
  if(media.source==='wger'&&(!media.author||!media.license||!media.licenseUrl))missing.push(`${exercise.id}: attribution incomplete`);
}
if(missing.length)throw new Error(`动作媒体校验失败：\n${missing.join('\n')}`);
console.log(`动作媒体校验通过：${Object.keys(exerciseCatalog).length} 个动作全部具有本地图片和来源记录。`);
