# 双货币与随机波后奖励验收 · 2026-11-24

基于3d8b704，直接改造当前项目。场景、兵种美术、职业、扑克牌型、首领技能、融合属性公式、欢呼和副职外观保持原实现。新增独立奖励池24项，原4项现在只是普通池成员，新增20项真实奖励。

## 收入与商店

配置集中于src/economy.js。新局蓝水晶0；每次守波收入5，第5/10/15…波额外5，不受十二波上限限制。十二波结算共70蓝水晶，免费三选一、奖励给钱和出售所得另计。旧档一次补发5蓝水晶。

34项物品沿用原数值价格，改收蓝水晶；刷新2蓝水晶；卖出一件返还原标价一半向下取整、最低1。购买、卖出和刷新不改变金币。加购出牌、付费换牌、改印、牌谱研习、融合继续花金币，不提供两币兑换。原金币守波公式保持，末波与原版一样不另发金币军饷，蓝水晶仍发5。

## 奖励定义

全合法池按weight无放回抽3，不保证方向占位，不固定repair/power/supply同时出现。方向只作标签。具体牌谱和免费物品在生成货架时确定，显示名称与效果，领取不再随机。货架与领取状态保存；不可用选项先过滤，4个独立资源奖励提供至少3项兜底。终幕没有下一波，排除纯下一波奖励及混合战地补给。

所有数量、比例、上限、权重和持续类别来自定义；下波首手最终分加成向下取整，独立于牌谱倍率。

| id | 名称 | 方向 | 时效 | 实际效果定义 | 权重 |
|---|---|---|---|---|---|
| repair | 修复城堡 | resource | 立即 | {"kind":"repair","amount":20} | 10 |
| power | 淬炼军团 | army | 永久 | {"kind":"power","amount":0.08,"cap":1} | 8 |
| supply | 战地补给 | poker | 立即 / 下一波 | {"kind":"supply","gold":6,"discards":1,"cap":6} | 10 |
| enlist | 收编枪兵 | army | 下一波 | {"kind":"enlist","pattern":"twoPair","cap":5} | 7 |
| discard-training | 换牌教范 | poker | 永久 | {"kind":"maxDiscards","amount":1,"cap":12} | 5 |
| energy-reservoir | 军令储备 | resource | 永久 | {"kind":"maxEnergy","amount":2,"cap":30} | 5 |
| extra-hand | 战前动员 | poker | 下一波 | {"kind":"next","bonus":"hands","amount":1,"cap":3} | 7 |
| opening-score | 开幕华彩 | poker | 下一波 | {"kind":"next","bonus":"firstScorePercent","amount":0.25,"cap":1} | 6 |
| order-notes | 牌谱心得 | poker | 永久 | {"kind":"handLevel","amount":1,"cap":3} | 7 |
| army-experience | 全军集训 | army | 永久 | {"kind":"army","army":{"experience":2,"xpCap":999}} | 8 |
| army-attack | 磨砺锋芒 | army | 永久 | {"kind":"army","army":{"attackPercent":0.06,"attackCap":1}} | 7 |
| army-health | 强健军阵 | army | 永久 | {"kind":"army","army":{"healthPercent":0.08,"healthCap":2}} | 7 |
| gate-masonry | 增筑城垣 | resource | 永久 | {"kind":"gateMax","amount":10,"repair":10,"cap":200} | 5 |
| crystal-purse | 蓝水晶补给 | resource | 立即 | {"kind":"currency","crystals":4} | 10 |
| item-cache | 军需遗珍 | resource | 立即 | {"kind":"item","quantity":1} | 7 |
| gold-purse | 零用军饷 | resource | 立即 | {"kind":"currency","gold":3} | 12 |
| gold-chest | 充裕军饷 | resource | 立即 | {"kind":"currency","gold":12} | 6 |
| crystal-chest | 蓝水晶宝匣 | resource | 立即 | {"kind":"currency","crystals":8} | 5 |
| army-experience-greater | 老兵授课 | army | 永久 | {"kind":"army","army":{"experience":4,"xpCap":999}} | 4 |
| army-attack-greater | 百战锋芒 | army | 永久 | {"kind":"army","army":{"attackPercent":0.1,"attackCap":1}} | 4 |
| army-health-greater | 坚韧军阵 | army | 永久 | {"kind":"army","army":{"healthPercent":0.12,"healthCap":2}} | 4 |
| extra-hands-greater | 紧急动员 | poker | 下一波 | {"kind":"next","bonus":"hands","amount":2,"cap":3} | 4 |
| next-discards | 斥候情报 | poker | 下一波 | {"kind":"next","bonus":"discards","amount":2,"cap":6} | 7 |
| next-prints | 备用印模 | poker | 下一波 | {"kind":"next","bonus":"prints","amount":2,"cap":8} | 6 |

## 存档与一次结算

沿用version1，增加economyVersion。新币、波收入标记、具体3候选、领取状态、next/active临时奖励与单兵rewardModifiers进入快照校验。旧档不清空军团、物品、金币和波次；已领固定奖励保持已领，旧收编枪兵和旧战地补给待生效内容保留。

军团属性只在领取时对当时正式军团（含候补、排除镜像）永久实值增量结算，保存百分比台账，不在读档/归营时重放。生命保持当前比例，升星与融合继续沿用原属性公式并携带台账。临时奖励next转active，下波首次成功出牌消费首手加成，下一次推进清除未用临时值。

修复随机免费独有物品恰与商店同货位的边界：免费获得后关闭该货位，避免重复购买及拥有状态造成存档失效；seed69有专门回归。

末波守住后同样先三选一、再商店，点击“完成远征”进入原胜利结算，不生成第十三波、不重复发收入。

## 验证

- npm test：309/309通过，原286项保留并按新经济适配旧固定奖励假设，新增23项。
- npm run build：145模块成功；Vite报告主JS510.28KB的体积提示，没有构建错误。
- node scripts/verify-builds.mjs：三条合法路线逐行动快照重放一致。A种子4获胜12波，门100、金币144、蓝水晶50、击退164；B种子1获胜12波；C种子3真实失败第10波，未为过关调整难度。
- node scripts/verify-presentation.mjs：合法神话/棱彩夹具仍由真实同品质融合生成。
- node scripts/check-economy-rewards-ui.mjs：12组通过，Runtime异常0。关键1/5/6/10/12波及五尺寸、真实首手25%路径；另从同一浏览器封面新局seed4/iron连续12场真实ticker、166条正式动作，每波都领取真实3选1、使用商店并推进。无换档替换局面、注入货币或成品兵。
- node scripts/build-legion-demo.mjs：离线版34.9MiB生成。
- 用git archive提取真实旧提交3d8b704，运行旧版合法路线生成备战、交战、未领商店、已领商店四种快照；新版均成功恢复，军团/物品ID、金币、波次和阶段保留，补发5蓝水晶且再读档不叠加。证据output/economy-actual-legacy-migration.json。

旧规则测试中需要特定奖励的单元场景使用src/rewardFixtures.js构造真实定义offer；策略测试和浏览器连续路线使用实际随机货架，未在策略中保送supply或修复。

复测先npm run dev -- --host 127.0.0.1 --port 5187，然后LEGION_TEST_URL=http://127.0.0.1:5187/ node scripts/check-economy-rewards-ui.mjs。脚本使用隔离Chrome资料，不改日常浏览器。

## 浏览器证据

- output/economy-rewards-ui-verification.json：12组详细结果。
- output/economy-journey-actions.json：同一新局166条正式动作及每波真实三选、消费和推进记录。
- output/economy-journey-main-12-wave-victory.png：连续十二波最终胜利。
- output/economy-wave1-actual-three-offers.png、economy-wave1-actual-shop.png：首波随机货架与蓝水晶购物。
- output/economy-wave5-actual-three-offers.png、economy-wave10-actual-three-offers.png：基础5与大波次额外5，独立于三个奖励位置。
- output/economy-wave6-actual-three-offers.png：首领后依旧三选一。
- output/economy-wave12-actual-three-offers.png：终幕过滤未来奖励，领奖后完成。
- output/economy-size-{1366x900,390x844,360x740,844x390,768x1024}.png：五种布局。
- output/economy-opening-score-real-preview.png：真实15筹码×1倍率＋3奖励分＝18，首手消费一次。

## 待人工平衡

本轮保留商品原价，只分离货币。每波5、每五波再5、出售回收和免费物品对购买力的影响，需要更多种子统计。资源强弱变体、永久换牌/军令上限、额外出牌与首手25%的权重也需试玩比较；同方向三项可能自然出现，这是全池随机的明确行为。当前一条种子4路线金币与蓝水晶都有结余，不据此调整全局难度。

第十二波奖励缺少下一波战术价值，终幕仅提供仍能立刻结算的成员；未来无限模式可以复用通用收入函数，再单独设计终局用途。

## 修改文件

- [README.md](../README.md)
- [docs/economy-rewards-2026-11-24.md](../docs/economy-rewards-2026-11-24.md)
- [scripts/check-economy-rewards-ui.mjs](../scripts/check-economy-rewards-ui.mjs)
- [scripts/verify-builds.mjs](../scripts/verify-builds.mjs)
- [src/EconomySummary.vue](../src/EconomySummary.vue)
- [src/FieldMarket.vue](../src/FieldMarket.vue)
- [src/LegionGame.vue](../src/LegionGame.vue)
- [src/ScoreBreakdown.vue](../src/ScoreBreakdown.vue)
- [src/WaveReport.vue](../src/WaveReport.vue)
- [src/bossCampaign.test.js](../src/bossCampaign.test.js)
- [src/buildStrategies.test.js](../src/buildStrategies.test.js)
- [src/campaign.js](../src/campaign.js)
- [src/combatStats.js](../src/combatStats.js)
- [src/combatStats.test.js](../src/combatStats.test.js)
- [src/convoy.test.js](../src/convoy.test.js)
- [src/deck.js](../src/deck.js)
- [src/economy-ui.css](../src/economy-ui.css)
- [src/economy.js](../src/economy.js)
- [src/economy.test.js](../src/economy.test.js)
- [src/engine.test.js](../src/engine.test.js)
- [src/expedition.test.js](../src/expedition.test.js)
- [src/feint.test.js](../src/feint.test.js)
- [src/fieldShop.js](../src/fieldShop.js)
- [src/forge.js](../src/forge.js)
- [src/gameSave.js](../src/gameSave.js)
- [src/growthMarket.test.js](../src/growthMarket.test.js)
- [src/handPlan.js](../src/handPlan.js)
- [src/highTierReadOnly.test.js](../src/highTierReadOnly.test.js)
- [src/itemExpansion.test.js](../src/itemExpansion.test.js)
- [src/orders.test.js](../src/orders.test.js)
- [src/performers.test.js](../src/performers.test.js)
- [src/poker.test.js](../src/poker.test.js)
- [src/presentationFacts.test.js](../src/presentationFacts.test.js)
- [src/recruitOrder.js](../src/recruitOrder.js)
- [src/rewardFixtures.js](../src/rewardFixtures.js)
- [src/rewardIntegration.test.js](../src/rewardIntegration.test.js)
- [src/rewardModifiers.js](../src/rewardModifiers.js)
- [src/scoreBreakdown.js](../src/scoreBreakdown.js)
- [src/scoreSequence.js](../src/scoreSequence.js)
- [src/supplyExperience.test.js](../src/supplyExperience.test.js)
- [src/waveRewards.js](../src/waveRewards.js)
- [src/waveRewards.test.js](../src/waveRewards.test.js)
