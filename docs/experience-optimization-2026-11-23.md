# 体验优化验收记录 · 2026-11-23

本轮聚焦引导、逐名战报、补给有效性、窄屏部署与人物身份。六位小丑、十二职业、34 件物品和十二波双首领维持原内容。牌型、职业、敌军与 Boss 数值定义未改；统计开启与关闭的同局验证中，生命、攻击结果、RNG、序列与战斗效果保持一致。

## 实现

- 新局启用可跳过的前三波引导。第一波依据真实征兵与前排护盾完成目标；第二波根据当前角色和时机介绍戏法；第三波实际换阵或拖动才算布阵，旧站位不会跳过教学。缺对子、次数用完或满编不阻止正常出战。结束引导立即开放全部系统，旧存档缺少引导字段时保持全部功能可用。
- 战报以人物身份名为主，按 unitId 记录实际生命伤害、有效治疗、生命承伤、护盾吸收和击杀。镜像单独记录；共享道具和无法准确归因的来源单列，避免归给最后出手的士兵。战前战令、实际军令消耗、剩余军令、战斗总时长、城门损伤与修复均保留。
- 战报分别保存备战与交战城门数据。中途旧档的贡献以续档点为起点并标部分记录，总时长仍显示整场已交战时间。历史缺少战术上下文时明确显示未记录；新历史包含阵型、融合战技和战术快照，不借用当前局信息。
- 每波用独立 runId、波次和 battleId 去重，同种子重试分开。历史只写本地，最多 1000 波且不超过 3 MiB，超出时清理最旧记录；手册可查看和下载 JSON。写入失败会提示，当前战报仍可导出。遥测损坏不会丢弃合法远征进度。
- 满耐久时禁用修复补给并说明原因，拒绝消耗选择。受伤时显示实际可恢复量，恢复上限仍为 20。战后简报等待玩家主动继续。
- 部署区按实际 HUD、面板、功能栏、引导和通知矩形避让，姓名、模型、拖动与命中坐标同步。固定通知区域避免消息显隐使军团跳动。人物名为主要信息，品质军装、职业和牌面为次级信息；原存档 name 字段不变。

## 验证结果

- 保留原有 157 项测试，新增 43 项状态与边界测试，共 **200 项通过，0 失败、0 跳过**。
- `npm run build`、离线单文件打包成功。
- 真实隔离 Chrome 验收新局开启、实际高牌与对子教学、跳过后刷新续玩、逐名战报、满血补给禁用、历史刷新保留、JSON 实际下载并解析，零浏览器异常。
- 20 个部署场景通过。旧档覆盖 390×844、360×740、844×390、768×1024，各检查手牌开关；新引导第 1、2、3 波各覆盖 390×844、844×390 及手牌开关。验证五名士兵与姓名不碰控件，所有姓名命中与人物详情一致、拖动坐标逆映射正确、无横向溢出、通知显隐不移动军团。

## 复跑

规则与离线 UI 验收需要 Node 22+；浏览器脚本自动寻找 Chrome，或用 LEGION_CHROME_BINARY 指定可执行文件。每次使用临时资料目录，不读取日常 Chrome 用户资料。

```bash
npm run test
npm run build
node scripts/build-legion-demo.mjs
node scripts/check-experience-ui.mjs
```

部署几何的真实 DOM 验收在开发模式运行，默认入口为 http://127.0.0.1:5173/，可用 LEGION_TEST_URL 指定实际端口。

```bash
node scripts/check-deployment-ui.mjs
TUTORIAL_WAVE=1 node scripts/check-deployment-ui.mjs
TUTORIAL_WAVE=2 node scripts/check-deployment-ui.mjs
TUTORIAL_WAVE=3 node scripts/check-deployment-ui.mjs
```

## 需要人工试玩确认

1. 初次接触游戏的人，能否理解“征兵职业”和“受令战团”之间的区别；随机手牌没有对子时，换牌与跳过提示是否清楚。
2. 六种第二波戏法的实际教学节奏，尤其双面的留位、替嗓的双战团与夹层的战后藏牌，是否容易跟上。
3. 在真实手机、触屏平板、Safari、系统放大字体及刘海安全区上，拖动和人物名阅读是否舒适；Chrome 自动化不能替代这些手感检查。
4. 完整十二波中，单兵贡献是否便于比较；弱设备帧率、连续多局后的历史浏览、浏览器禁用存储时的提示是否清楚。

## 修改文件

- `DESIGN.md`
- `README.md`
- `docs/experience-optimization-2026-11-23.md`
- `scripts/check-deployment-ui.mjs`
- `scripts/check-experience-ui.mjs`
- `src/CampRoster.vue`
- `src/LegionGame.vue`
- `src/SoldierSheet.vue`
- `src/SquadBench.vue`
- `src/TutorialCoach.vue`
- `src/WaveReport.vue`
- `src/battlefield.js`
- `src/battlefieldUnits.js`
- `src/campaign.js`
- `src/combatActions.js`
- `src/combatClock.js`
- `src/combatHealth.js`
- `src/combatHistory.js`
- `src/combatStats.js`
- `src/combatStats.test.js`
- `src/deploymentLayout.test.js`
- `src/engine.js`
- `src/experience.css`
- `src/fieldShop.js`
- `src/formation.js`
- `src/gameSave.js`
- `src/gameState.js`
- `src/itemExpansion.test.js`
- `src/onboarding.js`
- `src/onboarding.test.js`
- `src/performerActions.js`
- `src/recruitOrder.js`
- `src/scene.css`
- `src/soldierIdentity.js`
- `src/supplyExperience.test.js`
