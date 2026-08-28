import assert from 'node:assert/strict';
import { assessDailyNutrition, enrichModelMeal, parseModelJson, recalculateMeal } from '../lib/nutrition.ts';

const localMeal=enrichModelMeal({
  mealName:'米饭',confidence:90,assumptions:'测试',
  items:[{name:'米饭',databaseKey:'white_rice',grams:200,cookingMethod:'蒸煮',hiddenIngredient:false,
    estimatedCaloriesPer100:999,estimatedProteinPer100:99,estimatedCarbsPer100:99,estimatedFatPer100:99}],
});
assert.equal(localMeal.calories,260,'本地条目应忽略模型营养值');
assert.equal(localMeal.items[0].sourceType,'local');
assert.match(localMeal.items[0].nutritionSource,/FDC 168878/);
assert.ok(localMeal.items.some((item)=>item.databaseKey==='cooking_oil'));

const fallback=enrichModelMeal(parseModelJson('```json\n{"mealName":"地方蒸糕","confidence":88,"assumptions":"按蒸糕估算","items":[{"name":"地方蒸糕","databaseKey":"unknown","grams":150,"cookingMethod":"蒸","hiddenIngredient":false,"estimatedCaloriesPer100":220,"estimatedProteinPer100":4,"estimatedCarbsPer100":45,"estimatedFatPer100":3}]}\n```'));
assert.equal(fallback.calories,330);
assert.equal(fallback.confidence,65);
assert.equal(fallback.items[0].sourceType,'model');

const edited=recalculateMeal(fallback,fallback.items.map((item,index)=>index===0?{...item,grams:200}:item));
assert.equal(edited.calories,440,'模型估算项修改克数后应重新计算');
assert.equal(edited.protein,8);

const assessment=assessDailyNutrition({totals:{calories:2300,protein:80,carbs:190,fat:110},calorieTarget:2000,weightKg:70,goal:'strength',hasTraining:true});
assert.equal(assessment.status,'over');
assert.equal(assessment.trainingChangeAllowed,false);
assert.ok(assessment.nextMealAdvice.some((item)=>item.includes('惩罚性加练')));

console.log('nutrition validation passed');
