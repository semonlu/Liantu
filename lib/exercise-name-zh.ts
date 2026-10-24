type NameContext={body?:string;equipment?:string;target?:string;category?:string};

const exact:Record<string,string>={
  '3 4 sit up':'四分之三仰卧起坐','45° side bend':'45度侧屈','air bike':'空中自行车卷腹','alternate heel touchers':'交替触踵','ankle circles':'踝关节环绕',
  'barbell bench press medium grip':'中握距杠铃卧推','barbell bench press':'杠铃卧推','bench press':'卧推','bodyweight squat':'徒手深蹲','butt lift bridge':'臀桥',
  'close-grip front lat pulldown':'窄握胸前高位下拉','dead bug':'死虫式','farmers walk':'农夫行走','goblet squat':'高脚杯深蹲','jumping jacks':'开合跳',
  'leg press':'腿举','leg extensions':'腿屈伸','mountain climbers':'登山跑','plank':'平板支撑','pushups':'俯卧撑','romanian deadlift':'罗马尼亚硬拉',
  'seated cable rows':'坐姿绳索划船','seated leg curl':'坐姿腿弯举','side bridge':'侧桥','star jump':'开合跳','walking treadmill':'跑步机步行',
  "world's greatest stretch":'世界最佳拉伸','yoke walk':'轭架行走','zercher squats':'泽奇深蹲','zottman curl':'佐特曼弯举','zottman preacher curl':'佐特曼牧师凳弯举',
};

const phrases:Record<string,string>={
  'close grip':'窄握','wide grip':'宽握','reverse grip':'反握','neutral grip':'中立握','one arm':'单臂','single arm':'单臂','two arm':'双臂','one leg':'单腿','single leg':'单腿','straight leg':'直腿','bent over':'俯身','chest supported':'胸托',
  'body weight':'徒手','bench press':'卧推','chest press':'胸推','shoulder press':'肩推','overhead press':'过顶推举','military press':'军用推举','leg press':'腿举','leg curl':'腿弯举','leg extension':'腿屈伸','calf raise':'提踵',
  'hip thrust':'臀推','glute bridge':'臀桥','good morning':'早安式','push up':'俯卧撑','pull up':'引体向上','chin up':'反手引体向上','lat pulldown':'高位下拉','triceps pushdown':'肱三头肌下压','face pull':'面拉','upright row':'直立划船',
  'preacher curl':'牧师凳弯举','hammer curl':'锤式弯举','concentration curl':'集中弯举','romanian deadlift':'罗马尼亚硬拉','stiff leg deadlift':'直腿硬拉','sumo deadlift':'相扑硬拉','split squat':'分腿蹲','front squat':'前蹲','hack squat':'哈克深蹲','overhead squat':'过顶深蹲',
  'sit up':'仰卧起坐','knee raise':'抬膝','leg raise':'举腿','russian twist':'俄罗斯转体','pallof press':'帕洛夫抗旋推','farmer walk':'农夫行走','skull crusher':'仰卧臂屈伸','reverse fly':'反向飞鸟','chest fly':'夹胸飞鸟','pec deck':'蝴蝶机夹胸',
  'lateral raise':'侧平举','front raise':'前平举','rear delt':'三角肌后束','kettlebell swing':'壶铃摆动','battle rope':'战绳','foam roll':'泡沫轴放松','wrist curl':'腕弯举','wrist rotation':'手腕旋转','ankle circle':'踝关节环绕',
  'all fours':'四点支撑','archer pull up':'弓箭式引体向上','archer push up':'弓箭式俯卧撑','battle ropes':'战绳','battling ropes':'战绳','bear crawl':'熊爬','mountain climber':'登山跑','around world':'环绕世界','get up':'起身','muscle up':'双力臂','handstand push up':'倒立撑','jack knife':'折刀式','turkish get up':'土耳其起身','bottoms up':'壶铃底朝上','cross body':'跨体','iron cross':'铁十字','balance board':'平衡板','stationary bike':'固定自行车','inverted row':'反向划船',
};

const words:Record<string,string>={
  dumbbell:'哑铃',barbell:'杠铃',cable:'绳索',machine:'器械',lever:'固定器械',leverage:'固定器械',smith:'史密斯机',kettlebell:'壶铃',band:'弹力带',bands:'弹力带',rope:'绳索',sled:'雪橇',plate:'杠铃片',bosu:'波速球',ball:'球',medicine:'药球',stability:'稳定球',roller:'滚轴',wheel:'健腹轮',ez:'曲杆',weighted:'负重',bodyweight:'徒手',assisted:'辅助',resistance:'阻力',
  standing:'站姿',seated:'坐姿',lying:'卧姿',supine:'仰卧',prone:'俯卧',kneeling:'跪姿',hanging:'悬垂',incline:'上斜',decline:'下斜',flat:'平板',vertical:'垂直',horizontal:'水平',lateral:'侧向',side:'侧向',front:'前侧',rear:'后侧',posterior:'后侧',reverse:'反向',revers:'反向',inverse:'反向',inverted:'反向',alternate:'交替',alternating:'交替',single:'单侧',double:'双侧',wide:'宽距',narrow:'窄距',close:'窄距',high:'高位',low:'低位',overhead:'过顶',behind:'颈后',inner:'内侧',outer:'外侧',upper:'上部',lower:'下部',full:'全程',half:'半程',partial:'半程',extended:'伸展',straight:'直臂',bent:'屈曲',suspended:'悬吊',elevated:'垫高',linear:'直线',diagonal:'对角线',parallel:'平行',mixed:'混合',advanced:'进阶',quick:'快速',
  press:'推举',presses:'推举',push:'推',pull:'拉',pulldown:'下拉',pushdown:'下压',row:'划船',rows:'划船',squat:'深蹲',squats:'深蹲',deadlift:'硬拉',lunge:'箭步蹲',curl:'弯举',curls:'弯举',extension:'伸展',raise:'上举',raises:'上举',fly:'飞鸟',flyes:'飞鸟',crunch:'卷腹',crunches:'卷腹',stretch:'拉伸',dip:'臂屈伸',dips:'臂屈伸',shrug:'耸肩',pullover:'直臂上拉',twist:'转体',twisting:'转体',rotation:'旋转',bend:'侧屈',bridge:'桥式',plank:'平板支撑',planche:'俄式挺身',kickback:'后踢',kick:'踢',kicks:'踢腿',swing:'摆动',walk:'行走',walking:'步行',run:'跑步',sprint:'冲刺',jump:'跳跃',jumps:'跳跃',hops:'跳跃',step:'踏步',crawl:'爬行',throw:'投掷',clean:'翻举',snatch:'抓举',jerk:'挺举',hang:'悬垂',drag:'拖行',lift:'提拉',rollout:'滚轮伸展',rollerout:'滚轮伸展',hyperextension:'背伸',adduction:'内收',abduction:'外展',isometric:'等长',circles:'环绕',circular:'环绕',circle:'环绕',touch:'触碰',tap:'点触',pose:'姿势',carry:'负重行走',thruster:'深蹲推举',burpee:'波比跳',smr:'自我筋膜放松',flip:'翻转',march:'交替踏步',climb:'攀爬',squeeze:'夹压',hug:'抱合',wipers:'雨刷式',
  chest:'胸部',shoulder:'肩部',shoulders:'肩部',back:'背部',body:'身体',lat:'背阔肌',lats:'背阔肌',biceps:'肱二头肌',bicep:'肱二头肌',triceps:'肱三头肌',tricep:'肱三头肌',delt:'三角肌',deltoid:'三角肌',wrist:'手腕',forearm:'前臂',finger:'手指',neck:'颈部',hip:'髋部',glute:'臀肌',glutes:'臀肌',hamstring:'腘绳肌',quad:'股四头肌',quads:'股四头肌',calf:'小腿',calves:'小腿',leg:'腿部',legs:'腿部',legged:'单腿',knee:'膝部',knees:'膝部',arm:'手臂',arms:'手臂',elbow:'肘部',abs:'腹肌',ab:'腹部',oblique:'腹斜肌',core:'核心',muscle:'肌肉',groin:'腹股沟',pelvic:'骨盆',ankle:'脚踝',toe:'脚趾',feet:'双脚',head:'头部',hand:'手部',hands:'双手',palms:'掌心',palm:'掌心',scapula:'肩胛骨',scapular:'肩胛骨',spine:'脊柱',adductor:'内收肌',peroneals:'腓骨肌',tibialis:'胫骨肌',
  arnold:'阿诺德',zottman:'佐特曼',zercher:'泽奇',pallof:'帕洛夫',russian:'俄罗斯式',bulgarian:'保加利亚式',turkish:'土耳其式',donkey:'驴式',spider:'蜘蛛式',frog:'蛙式',sumo:'相扑式',romanian:'罗马尼亚式',military:'军用',preacher:'牧师凳',hammer:'锤式',concentration:'集中式',power:'爆发力',plyo:'增强式',speed:'速度',balance:'平衡',crossover:'交叉',cross:'交叉',external:'外旋',internal:'内旋',forward:'向前',backward:'向后',stance:'站距',floor:'地面',wall:'靠墙',box:'跳箱',rack:'深蹲架',bar:'杠杆',bench:'训练凳',board:'平衡板',towel:'毛巾',chair:'椅子',trainer:'训练器',blaster:'训练器',attachment:'附件',archer:'弓箭式',jack:'开合式',butterfly:'蝴蝶式',bear:'熊式',inchworm:'毛毛虫式',handstand:'倒立',pike:'屈体',windmill:'风车式',landmine:'地雷杆',straddle:'跨坐',chains:'链条',style:'式',figure:'数字形',iron:'铁十字',
};

const stop=new Set(['a','an','and','or','the','to','of','with','without','on','in','from','for','using','at','by','over','through','against','off','into','male','female','exercise','v','s','t']);
const phraseEntries=Object.entries(phrases).sort((a,b)=>b[0].length-a[0].length);

function fallback(context:NameContext){
  const parts=[context.equipment,context.body||context.target,context.category].filter((value)=>value&&/[\u3400-\u9fff]/u.test(value));
  return `${[...new Set(parts)].join(' · ')||'综合'}训练动作`;
}

export function chineseExerciseName(englishName:string,context:NameContext={}){
  const source=englishName.trim();
  if(!source)return fallback(context);
  const normalized=source.toLocaleLowerCase().replace(/[’']/g,"'").replace(/e[.\s-]?z[.\s-]?/g,'ez ').replace(/[-_/]+/g,' ').replace(/[^a-z0-9°'\s]/g,' ').replace(/\s+/g,' ').trim();
  if(exact[normalized])return exact[normalized];
  let prepared=` ${normalized.replace(/\b(?:male|female)\b/g,' ')} `;
  for(const [phrase,translation] of phraseEntries)prepared=prepared.replace(new RegExp(`\\b${phrase.replace(/ /g,'\\s+')}\\b`,'g'),` ${translation} `);
  const tokens=prepared.trim().split(/\s+/).filter(Boolean);
  const translated:string[]=[];
  let meaningful=0,known=0;
  for(const token of tokens){
    if(stop.has(token)||/^\d+$/.test(token))continue;
    meaningful++;
    if(/[\u3400-\u9fff]/u.test(token)){translated.push(token);known++;continue;}
    const value=words[token];
    if(value){translated.push(value);known++;}
  }
  if(!translated.length||known/Math.max(1,meaningful)<0.4)return fallback(context);
  const result=translated.filter((value,index)=>index===0||value!==translated[index-1]).join(' · ')
    .replace(/卧推 · 推举/g,'卧推').replace(/俯卧撑 · 向上/g,'俯卧撑').replace(/引体向上 · 向上/g,'引体向上');
  return result||fallback(context);
}
