import assert from 'node:assert/strict';
import { datasetExerciseDefinitions } from '../lib/exercises-dataset-library.ts';
import { freeExerciseDefinitions } from '../lib/exercise-library.ts';
import { chineseExerciseName } from '../lib/exercise-name-zh.ts';
import { exerciseCatalog } from '../lib/training.ts';

const imported=[...datasetExerciseDefinitions,...freeExerciseDefinitions];
assert.equal(imported.length,2200);
for(const exercise of [...Object.values(exerciseCatalog),...imported]){
  assert.ok(exercise.name.trim(),`${exercise.id} 缺少中文名`);
  assert.ok(exercise.englishName.trim(),`${exercise.id} 缺少英文名`);
  assert.match(exercise.name,/[\u3400-\u9fff]/u,`${exercise.id} 中文名不含中文`);
}
assert.equal(imported.filter((exercise)=>exercise.name.toLocaleLowerCase()===exercise.englishName.toLocaleLowerCase()).length,0);
assert.ok(imported.filter((exercise)=>exercise.name.endsWith('训练动作')).length<=100,'通用中文名称过多');
assert.equal(chineseExerciseName('barbell bench press'),'杠铃卧推');
assert.equal(chineseExerciseName('archer push up'),'弓箭式俯卧撑');
assert.equal(chineseExerciseName('romanian deadlift'),'罗马尼亚硬拉');
console.log(`动作名称校验通过：${imported.length} 个导入动作均有独立中英文名称。`);
