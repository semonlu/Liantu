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
const downloaded=manifest.filter((item)=>item.status==='downloaded').length;
const generated=manifest.filter((item)=>item.status==='generated').length;
const authors=new Set(manifest.filter((item)=>item.status==='downloaded'&&item.author).map((item)=>item.author));
console.log(`动作媒体本地完整性通过：${Object.keys(exerciseCatalog).length} 个动作均有本地文件；${downloaded} 张下载、${generated} 张生成。`);
console.log(`风格一致性未通过：下载素材来自 ${authors.size} 位作者，与生成素材不构成统一视觉系列；不得将“本地完整”描述为“风格统一”。`);
