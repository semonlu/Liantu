export type NutritionSource = 'local' | 'model' | 'missing';

export type FoodItem = {
  id: string;
  name: string;
  databaseKey: string;
  grams: number;
  cookingMethod: string;
  hiddenIngredient: boolean;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  referenceName: string;
  nutritionSource: string;
  sourceType: NutritionSource;
};

export type Meal = {
  id: string;
  timestamp: number;
  mealName: string;
  confidence: number;
  assumptions: string;
  items: FoodItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type DailyNutritionAssessment = {
  calorieTarget:number;
  caloriesConsumed:number;
  caloriesRemaining:number;
  proteinTarget:number;
  proteinRemaining:number;
  carbsTarget:number;
  carbsRemaining:number;
  fatTarget:number;
  fatRemaining:number;
  status:'insufficient'|'on_track'|'over';
  nextMealAdvice:string[];
  recoveryImpact:string;
  trainingChangeAllowed:false;
};

type Entry = {
  key: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fdcId: string;
  aliases: string[];
};

const entries: Entry[] = [
  e('white_rice','熟白米饭',130,2.69,28.17,.28,'168878','米饭','白米饭','大米'),
  e('brown_rice','熟糙米饭',123,2.74,25.58,.97,'169704','糙米','糙米饭'),
  e('egg_noodles','熟鸡蛋面',138,4.54,25.16,2.07,'168919','面条','鸡蛋面','挂面'),
  e('pasta','熟意面',158,5.8,30.86,.93,'169737','意大利面','意面','通心粉'),
  e('white_bread','白面包',266,8.85,49.42,3.33,'174924','面包','吐司'),
  e('dumpling_wrapper','馄饨/饺子皮',291,9.8,57.9,1.5,'172802','饺子皮','馄饨皮','春卷皮'),
  e('wheat_flour','小麦面粉',364,10.33,76.31,.98,'168894','面粉','小麦粉'),
  e('chicken_breast','熟鸡胸肉',165,31.02,0,3.57,'171477','鸡胸','鸡胸肉','鸡肉'),
  e('chicken_thigh','熟鸡腿肉',179,24.76,0,8.15,'172388','鸡腿','鸡腿肉'),
  e('pork_lean','熟瘦猪肉',209,28.62,0,9.63,'168233','猪肉','瘦肉','里脊'),
  e('beef_lean','熟瘦牛肉',230,28.45,0,12.04,'171794','牛肉','牛肉末','牛排'),
  e('egg','熟鸡蛋',155,12.58,1.12,10.61,'173424','鸡蛋','蛋','水煮蛋','煎蛋'),
  e('tofu','硬豆腐',78,9.04,2.85,4.17,'172448','豆腐','老豆腐','北豆腐'),
  e('white_fish','熟白肉鱼',85,18.73,0,.5,'171990','鱼','鱼肉','鳕鱼'),
  e('shrimp','熟虾仁',99,23.98,.2,.28,'175180','虾','虾仁','大虾'),
  e('whole_milk','全脂牛奶',61,3.15,4.8,3.25,'171265','牛奶','全脂奶'),
  e('yogurt','原味全脂酸奶',61,3.47,4.66,3.25,'171284','酸奶','原味酸奶'),
  e('cheddar','切达奶酪',403,22.87,3.37,33.31,'173414','奶酪','芝士','切达'),
  e('peanuts','干烤花生',587,24.35,21.26,49.66,'173806','花生','花生米'),
  e('broccoli','熟西兰花',35,2.38,7.18,.41,'169967','西兰花','花椰菜'),
  e('cabbage','熟卷心菜',23,1.27,5.51,.06,'169976','卷心菜','包菜','圆白菜'),
  e('bok_choy','熟小白菜',12,1.56,1.78,.16,'170391','小白菜','青菜','上海青','油菜'),
  e('spinach','熟菠菜',23,2.97,3.75,.26,'168463','菠菜'),
  e('tomato','番茄',18,.88,3.89,.2,'170457','番茄','西红柿'),
  e('cucumber','黄瓜',15,.65,3.63,.11,'168409','黄瓜'),
  e('potato','熟土豆',86,1.71,20.01,.1,'170440','土豆','马铃薯'),
  e('sweet_potato','熟红薯',76,1.37,17.72,.14,'168484','红薯','地瓜','甘薯'),
  e('corn','熟甜玉米',96,3.41,20.98,1.5,'169999','玉米','甜玉米'),
  e('carrot','熟胡萝卜',35,.76,8.22,.18,'170394','胡萝卜'),
  e('mushroom','熟白蘑菇',28,2.17,5.29,.47,'169252','蘑菇','香菇','菌菇'),
  e('peas','熟青豌豆',84,5.36,15.63,.22,'170420','豌豆','青豆'),
  e('onion','熟洋葱',44,1.36,10.15,.19,'170001','洋葱'),
  e('garlic','大蒜',149,6.36,33.06,.5,'169230','大蒜','蒜','蒜末'),
  e('apple','带皮苹果',52,.26,13.81,.17,'171688','苹果'),
  e('banana','香蕉',89,1.09,22.84,.33,'173944','香蕉'),
  e('orange','橙子',47,.94,11.75,.12,'169097','橙子','橘子','柑橘'),
  e('cooking_oil','食用油',884,0,0,100,'172336','食用油','烹调油','植物油','菜籽油','油'),
  e('sugar','白砂糖',387,0,99.98,0,'169655','糖','白糖','砂糖'),
  e('soy_sauce','酱油',53,8.14,4.93,.57,'174277','酱油','生抽','老抽'),
  e('oyster_sauce','蚝油',51,1.35,10.92,.25,'174529','蚝油'),
  e('mayonnaise','蛋黄酱',680,.96,.57,74.85,'171009','蛋黄酱','沙拉酱','美乃滋'),
];

function e(key:string,name:string,calories:number,protein:number,carbs:number,fat:number,fdcId:string,...aliases:string[]):Entry {
  return { key,name,calories,protein,carbs,fat,fdcId,aliases };
}

const byKey = new Map(entries.map((entry) => [entry.key, entry]));

const normalize = (value: unknown) => String(value ?? '').toLowerCase().replace(/[\s、，,。()（）/\-]/g, '');
const finite = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(number) ? number : 0;
};
const clamp = (value:number,min:number,max:number) => Math.min(max,Math.max(min,value));
const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function findEntry(key:string,name:string) {
  const direct = byKey.get(key);
  if (direct) return direct;
  const normalized = normalize(name);
  return entries.find((entry) => normalize(entry.name) && normalized.includes(normalize(entry.name))
    || entry.aliases.some((alias) => normalized.includes(normalize(alias))));
}

function validEstimate(calories:number,protein:number,carbs:number,fat:number) {
  return calories > 0 && calories <= 1000
    && [protein,carbs,fat].every((value) => value >= 0 && value <= 100);
}

function calculate(item: FoodItem): FoodItem {
  const factor = Math.max(0,item.grams) / 100;
  return {
    ...item,
    grams: Math.max(0,item.grams),
    calories: item.caloriesPer100 * factor,
    protein: item.proteinPer100 * factor,
    carbs: item.carbsPer100 * factor,
    fat: item.fatPer100 * factor,
  };
}

export function recalculateMeal(meal: Meal, items = meal.items): Meal {
  const calculated = items.map(calculate);
  return {
    ...meal,
    items: calculated,
    calories: calculated.reduce((sum,item) => sum + item.calories,0),
    protein: calculated.reduce((sum,item) => sum + item.protein,0),
    carbs: calculated.reduce((sum,item) => sum + item.carbs,0),
    fat: calculated.reduce((sum,item) => sum + item.fat,0),
  };
}

export function enrichModelMeal(raw: Record<string, unknown>): Meal {
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  let modelEstimated = 0;
  let missing = 0;
  const items: FoodItem[] = rawItems.map((candidate) => {
    const value = (candidate && typeof candidate === 'object' ? candidate : {}) as Record<string,unknown>;
    const name = String(value.name ?? '食物').trim() || '食物';
    const databaseKey = String(value.databaseKey ?? 'unknown');
    const entry = findEntry(databaseKey,name);
    const base = {
      id:id(), name, databaseKey:entry?.key ?? databaseKey, grams:Math.max(0,finite(value.grams)),
      cookingMethod:String(value.cookingMethod ?? ''), hiddenIngredient:Boolean(value.hiddenIngredient),
    };
    if (entry) return calculate({ ...base, caloriesPer100:entry.calories, proteinPer100:entry.protein,
      carbsPer100:entry.carbs, fatPer100:entry.fat, calories:0,protein:0,carbs:0,fat:0,
      referenceName:entry.name, nutritionSource:`USDA FoodData Central SR Legacy · FDC ${entry.fdcId}`, sourceType:'local' });
    const calories=finite(value.estimatedCaloriesPer100), protein=finite(value.estimatedProteinPer100);
    const carbs=finite(value.estimatedCarbsPer100), fat=finite(value.estimatedFatPer100);
    if (validEstimate(calories,protein,carbs,fat)) {
      modelEstimated++;
      return calculate({ ...base, caloriesPer100:calories,proteinPer100:protein,carbsPer100:carbs,fatPer100:fat,
        calories:0,protein:0,carbs:0,fat:0,referenceName:`${name}（模型估算）`,
        nutritionSource:'大模型估算（本地营养库无对应条目）',sourceType:'model' });
    }
    missing++;
    return calculate({ ...base, caloriesPer100:0,proteinPer100:0,carbsPer100:0,fatPer100:0,
      calories:0,protein:0,carbs:0,fat:0,referenceName:'未匹配',
      nutritionSource:'本地未匹配，模型未提供有效估算',sourceType:'missing' });
  });

  for (const [key,name] of [['cooking_oil','食用油（可调整）'],['sugar','糖（可调整）'],['soy_sauce','酱油（可调整）']] as const) {
    if (!items.some((item) => item.databaseKey === key)) {
      const entry = byKey.get(key)!;
      items.push(calculate({ id:id(),name,databaseKey:key,grams:0,cookingMethod:'',hiddenIngredient:true,
        caloriesPer100:entry.calories,proteinPer100:entry.protein,carbsPer100:entry.carbs,fatPer100:entry.fat,
        calories:0,protein:0,carbs:0,fat:0,referenceName:entry.name,
        nutritionSource:`USDA FoodData Central SR Legacy · FDC ${entry.fdcId}`,sourceType:'local' }));
    }
  }

  let assumptions = String(raw.assumptions ?? '图片估算仅供日常记录，请按实际分量校正。').trim();
  if (modelEstimated) assumptions += `；有 ${modelEstimated} 项本地无对应条目，采用大模型每100克营养估算`;
  if (missing) assumptions += `；有 ${missing} 项模型估算无效，未计入总量`;
  const confidence = clamp(Math.round(finite(raw.confidence) || 50),0,modelEstimated ? 65 : 100);
  return recalculateMeal({ id:id(),timestamp:Date.now(),mealName:String(raw.mealName ?? '一餐食物'),
    confidence:missing ? Math.min(confidence,40) : confidence,assumptions,items,calories:0,protein:0,carbs:0,fat:0 });
}

export function nutritionCatalogPrompt() {
  return `${entries.map((entry) => `${entry.key}=${entry.name}`).join('; ')}; unknown=无法匹配`;
}

export function parseModelJson(content: string): Record<string,unknown> {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型没有返回可解析的食物数据');
  return JSON.parse(cleaned.slice(start,end + 1));
}

export function assessDailyNutrition(input:{
  totals:{calories:number;protein:number;carbs:number;fat:number};
  calorieTarget:number;
  weightKg:number;
  goal:'fat_loss'|'strength'|'hypertrophy'|'endurance'|'circuit'|'functional';
  hasTraining:boolean;
}):DailyNutritionAssessment {
  const weight=Math.max(30,input.weightKg);
  const proteinPerKg=input.goal==='fat_loss'?2:input.goal==='hypertrophy'?1.8:1.6;
  const proteinTarget=Math.round(weight*proteinPerKg);
  const carbsTarget=Math.round(weight*(input.hasTraining?input.goal==='endurance'?4:3:2));
  const fatTarget=Math.round(Math.max(45,input.calorieTarget*.25/9));
  const caloriesRemaining=Math.round(input.calorieTarget-input.totals.calories);
  const proteinRemaining=Math.round(proteinTarget-input.totals.protein);
  const carbsRemaining=Math.round(carbsTarget-input.totals.carbs);
  const fatRemaining=Math.round(fatTarget-input.totals.fat);
  const tolerance=Math.max(120,input.calorieTarget*.08);
  const status=caloriesRemaining < -tolerance?'over':caloriesRemaining > tolerance?'insufficient':'on_track';
  const advice:string[]=[];
  if(proteinRemaining>20)advice.push(`后一餐优先补约 ${Math.min(50,proteinRemaining)}g 蛋白质，可选瘦肉、鱼虾、蛋奶或豆制品。`);
  if(carbsRemaining>35&&input.hasTraining)advice.push(`训练前后仍可补约 ${Math.min(90,carbsRemaining)}g 碳水，优先米面薯类和水果。`);
  if(fatRemaining<0)advice.push('今天脂肪已偏高，后续选择清蒸、炖煮或少油做法，减少坚果、油炸和浓酱。');
  if(caloriesRemaining<0)advice.push(`已超出约 ${Math.abs(caloriesRemaining)} kcal；后续餐减少高油高糖食物，保持正常训练，不用额外惩罚性加练。`);
  if(!advice.length)advice.push('今天总量和宏量营养接近目标，后一餐保持平常份量并补足蔬菜和水分。');
  return {
    calorieTarget:input.calorieTarget,caloriesConsumed:Math.round(input.totals.calories),caloriesRemaining,
    proteinTarget,proteinRemaining,carbsTarget,carbsRemaining,fatTarget,fatRemaining,status,nextMealAdvice:advice,
    recoveryImpact:status==='insufficient'&&input.hasTraining?'若连续多日能量不足且训练表现下降，会生成待确认的恢复建议；单日偏差不改训练。':status==='over'?'单日超出不改变训练；观察后续 7–14 天体重、饥饿和表现趋势。':'当前摄入不会触发训练计划变化。',
    trainingChangeAllowed:false,
  };
}
