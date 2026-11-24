# 四职业神话／棱彩视觉原型验收 · 2026-11-24

本轮只为御前君主、随军牧师、盾卫、长弓手加入神话与棱彩的部件化视觉层。原264项测试保持，最终277项通过、0失败。没有修改牌型、计分、概率、属性、技能、职业、融合结果、战斗时机、价格、资源或存档规则。

## 管线与资源

52张身份牌绘和四族atlas继续负责人物身份，七套regalia与armory仍是原军装、骨骼和武器来源。战场一星普通步兵为54×49逻辑像素，传说以上沿原规则使用52像素高；本轮没有修改drawUnit尺寸、命中框、脚点、关节、布阵区或拾取算法。

新增一张4×8透明图集high-tier-parts.png，共32个部件：四职业×两品质×头饰、背件、主手、肩胸。素材与原图同视角、描边与光照。使用内置image_gen生成，最终采用资源与完整提示词见public/legion-pixel/HIGH_TIER_ART.md。没有制作66套独立模型，也没有替换低阶资源。

高阶分支仍使用原关节动画：原脸与四肢保留，新冠/帽/盔替换旧冠，窄化旧礼服外廓，再挂接职业的背件、肩甲及主手。部件随原关节转动，不拉伸身体，不另造动作释放时间。资源失败时完整回退原绘图。

| 职业 | 神话方向 | 棱彩进一步区别 |
|---|---|---|
| 御前君主 | 王权冠、分叉鼬领王氅、统帅肩铠、王权长刃 | 更高晶冠、分层折面王氅、分叉护手与层叠肩甲 |
| 随军牧师 | 祭冠、月形经匣背饰、圣器与经书杖 | 三叶祭冠、三联经匣、分枝祭器与层叠披带 |
| 盾卫 | 重盔、宽肩甲、长方塔盾 | 城垛盔、双边阶梯塔盾、铰接重甲与双层肩甲 |
| 长弓手 | 翎羽兜帽、长箭袋、巨型反曲弓、轻肩皮甲 | 双翎、双箭袋、双曲弓臂、分层轻肩甲 |

## 融合与动作

模块只读取真实fusionJobs，主职保持在首位。副职按明确优先级与外观族去重，最多显示两类；牧师使用礼仪经匣、盾卫使用护板盾纹、弓手使用箭袋、焰术师使用袖侧法器、刺客使用腰侧双刃，其他职业使用既有armory回退。主要武器最后绘制，不被副职替换，模块避开脸部。

待机、行走、受击、普通攻击／治疗／射击继续沿用原骨骼与动作相位。图册另外包含windup、contact、release与salute采样。欢呼手臂幅度略增强以适配小尺寸大装备，仍为完整1000毫秒／短版420毫秒、100–300毫秒错峰。身体位置与步态位移为零，真实战斗动作优先，不延长计时或生成额外伤害。

## 揭晓构图

高阶主将模型在揭晓卡中成为中心，展示真实人物名、品质、主职及实际兼修职业，最多三项真实关键变化，完整属性展开查看。桌面右侧为主将卡、左侧为真实军团；手机上方卡片、下方军团，矮横屏在卡片内部滚动。揭晓替换工坊列表，收起后恢复整编操作，不再保留顶部信息加大块工坊空白。

高阶卡接入已有部署视窗的界面避让，仅调整Canvas相机视窗的缩放与留白，不修改士兵世界坐标、布阵规则、命中框或拾取映射。逐一检查真实renderer返回的姓名和模型投影与卡片相交面积为零；正式揭晓时清掉旧的临时通知，避免覆盖卡片。

候补模型可在揭晓卡中完整查看，但战场只画真实在阵成员，候补明确标记尚未上阵。跳过、演出2倍速、关闭及减少动态效果继续使用原外置表现状态，不写入存档、不重播正式结果。

## 实际验收

- 全量277/277通过；生产构建及包含新图集的单文件离线打包成功。
- 正常／传说的四样板与另八个职业所有品质，启用新图集与回退旧图集逐像素一致；四样板神话／棱彩确实改变轮廓和装备。
- 深冻结人物、动作和融合记录，绘图后完整对象不变。原动作命中相位、命中框、真实部署拾取及RNG不变，没有调用随机源。
- 同一合法种子4操作序列逐动作比较完整snapshot与RNG，一直到十二波胜利完全一致。
- 同一次真实浏览器新局：第三波同品质融合产生神话，第五波同品质融合产生棱彩；正常正式操作和真实计时器继续到十二波。最终胜利、城门100、金币119、击退164，完整浏览器路线约119秒。
- 五尺寸1366×900、390×844、360×740、844×390、768×1024分别检查神话和棱彩。反向使用同一合法材料，验证神话主将留在候补，战场四人而非第六人；减少动态与跳过保持已保存快照相同。
- 四主职正常尺寸、放大、灰度与动作图均由真实浏览器Canvas绘图导出。灰度使用Canvas滤镜，不改原PNG。
- 皇后独立合法分支的蓄力、真实打断与胜利仍正常；原11组离线出牌回归通过。

## 修改文件

| 文件 | 用途 |
|---|---|
| src/highTierArt.js | 四职业部件映射、挂点、真实兼修模块、最多两类的优先级与回退 |
| src/articulatedSprites.js、src/spriteAtlas.js | 复用现有关节绘制部件、载入图集，其他品质与职业不变 |
| src/HighTierReveal.vue、src/RecruitReveal.vue、src/ScoreSequence.vue | 主将中心构图、实际身份／去向／属性、复用现有速度与跳过 |
| src/LegionGame.vue、src/presentation.css | 正式结果接入、工坊切换与响应式卡片布局、清理旧通知 |
| src/presentationViews.js | 只读正式结算数据，最多三项关键变化与完整属性 |
| src/battlefieldPresentation.js | 保持原欢呼时长与错峰，增强已有致意手臂幅度 |
| src/highTierArt.test.js、src/highTierReadOnly.test.js、src/highTierReveal.test.js | 新增13项映射、回退、动作、去向与完整状态一致性测试 |
| scripts/check-high-tier-ui.mjs | 图册、灰度、五尺寸、候补和十二波实际浏览器验收 |
| scripts/build-legion-demo.mjs | 将新增PNG内联进离线版 |
| public/legion-pixel/high-tier-parts.png | 本轮唯一新增美术资源，32个透明部件 |
| public/legion-pixel/HIGH_TIER_ART.md、PROMPTS.md | 资源布局、来源与完整生成提示词 |
| README.md、本文件 | 内容范围、复测入口与验收限制 |

## 证据与复跑

```bash
npm test
npm run build
node scripts/build-legion-demo.mjs
node scripts/verify-builds.mjs
node scripts/verify-presentation.mjs
LEGION_HIGH_TIER_SCENARIOS=art,ui,route LEGION_TEST_URL=http://127.0.0.1:5187/ node scripts/check-high-tier-ui.mjs
```

浏览器脚本需要开发入口，可先运行npm run dev -- --host 127.0.0.1 --port 5187。art为只读美术样本，不将成品兵注入实际游戏；route从正常新局、正式操作与真实战斗开始。output生成图和JSON不作为源码提交，可用脚本重建。

主要图册：

- output/high-tier-normal-tiers.png：四职业普通／传说／神话／棱彩，原战场尺寸。
- output/high-tier-normal-tiers-grayscale.png：同一尺寸灰度对比。
- output/high-tier-large-rigs.png、-grayscale.png：放大轮廓与装备。
- output/high-tier-actions-{sovereign,priest,shield,archer}.png及-grayscale.png：原相位动作。
- output/high-tier-legal-fusions.png、-grayscale.png：真实君主多职业融合记录与模块上限。
- output/high-tier-module-matrix-{5,6}.png及-grayscale.png：四主职分别搭配牧师、盾卫、弓手、焰术师、刺客的40格正常／灰度美术样本；同职业列不增加模块。
- output/high-tier-mythic-1366x900.png、high-tier-prismatic-390x844.png：实际揭晓与真实军团同屏。
- output/high-tier-reserve-mythic-phone-reduced.png：真实候补及减少动态分支。
- output/presentation-journey-main-12-wave-victory.png：完整主路线最终胜利。
- output/high-tier-ui-verification.json：art、ui及完整路线结果。

## 已知覆盖边界

四个样板完成，没有向其余八个基础职业推广。旧版六种独立融合外观仍使用原回退，未为66种组合绘制独立模型。大量兼修最多显示两类装备，完整职业名可在揭晓中查看。牧师背饰、盾板和箭袋较易辨认；焰术师法器与刺客腰刃在52像素、尤其棱彩灰度下偏细，需要放大查看，不能声称每个副职在战场尺寸均可一眼识别。罕见姿态与多模块的视觉品质仍适合人工试玩复查；灰度图用于辅助判断，不能代替人的美术判断。图片当前是这一轮的四样板候选，后续是否扩展应在人工确认后再决定。
