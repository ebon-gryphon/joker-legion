# 整局生命、构筑奖励与终幕验收

日期：2026-11-25。修改基线：`f99d3d9`。本轮直接修改现有《小丑军团》，未修改场景、兵种美术、首领动作或欢呼资源。现有扑克牌型与对应职业、34种商品、金币/蓝水晶用途保持。

收尾时用户追加“不再进行竖屏的开发”。已停止后续竖屏调整，保留此前完成的兼容代码和验收证据；后续开发以桌面、横屏为准。

## 当前规则

- 奖励池共36项，原24项普通奖励加12项整局唯一构筑被动。前十一波仍从整个合法池按权重随机抽三个不同选项，没有方向占位。唯一被动领取后退出后续池；候选、具体目标、领取状态、触发次数和上一手成功牌型进入存档。
- 标准初始生命12，险境8，来自难度配置。当前上限奖励可累积至基础上限两倍，即24/16。跨波不自动回复玩家生命；士兵归营仍按原规则回血。
- 每名实际突破的非首领敌人扣1生命。1→0仍安全，0时再突破才失败；界面提示“不能再放入任何敌人”。普通超时残敌按真实在场存活单位逐名结算，未入场队列撤回；首领存活超时或实际突破直接失败。
- 鸣钟在右侧召唤真实流寇，不直接扣生命。召唤、击杀、突破和超时保留真实来源；只有突破/超时的生命损失事件扣血。对子打断首次鸣钟保留。敌军数量达到现有上限时不虚构加入成功。
- 恢复生命奖励恢复2；生命上限奖励上限+2并恢复2，实际收益受当前上限限制。纯回血在满生命时退出池，满上限时上限奖励退出池。
- 生命铆钉每层守波后恢复1。红心回响保留友军治疗，每波首次至少两张计分红心恢复1玩家生命；同花王冠保留25%战令效果，每波首次五张同花恢复1。两者在满生命时记录实际0且消耗当波机会，不伪造收益。
- 第十二波安全清场后直接进入胜利，保留真实战报、生命、双货币和军团成果。不再生成三选一、商店、第十三波或无用途末波收入。前十一波5蓝水晶/波，第5、10波各额外5，合计基础收入65；奖励与售出另算，购买会减少余额。

## 十二项被动的真实结算验证

数值、卡数条件、每波次数与描述模板集中在`src/buildPassives.js`。下表全部通过真实引擎动作/状态断言验证，不以界面文本替代结算。领取唯一性另经36池领取、存档恢复及后续排除测试覆盖。

| 被动 | 已验证的实际结果与边界 |
| --- | --- |
| 连奏 | 同波第二手相同成功牌型最终分+20%。与已有首手25%合计为45%后只取整一次；7分样例得到10，非分开取整的9。预览不改状态，失败出牌不推进上一手。 |
| 变奏 | 非首手且成功牌型改变时+20%；预览分等于实际分。跨波清空上一手，保留整局次数。 |
| 五牌军势 | 当波首次五张成功出牌各战令数值乘1.25；之后不再触发。与主将军令的顺序为先全团25%，再主将30%，行动间隔下限保持。 |
| 轻装进发 | 不超过两张且真实付费军令的出牌返还1，最多两次/波；付费加手的免军令出牌返还0且不占轻装次数。 |
| 黑桃铁律 | 两张实际计分黑桃触发，在场铁卫每人真实获得18盾，非铁卫不获盾；高牌带两张黑桃但只有一张计分时不触发。 |
| 红桃誓约 | 两张计分红心激活本波牧师战团规则；当前及随后牧师治疗10→12。目标只缺5时实际恢复5，额外收益0；非牧师不加成，跨波清除。 |
| 梅花猎令 | 两张计分梅花激活后，真实游侠首次攻击产生一支额外箭，请求伤害为攻击×60%，进入真实伤害、弹道及战报。后续攻击不重复；目标已死亡的箭记录实际0。真实镜像成员按自己的单位ID只触发一次。 |
| 方片回流 | 首次计分方片按张数返还、最多3。与轻装共同分享实际军令支出上限，2点支出样例各退1，合计不超过2；免军令手记录0。 |
| 融合军规 | 当前及之后异职业融合正式兵攻疗+12%。职业融合、旧战技融合、经验、永久补给、归营与读档后不重复乘算。 |
| 主将军令 | 只有真实主将所在战团受到本手战令时，主将本人的该次战令再×1.30；同团其他士兵保留原战令。记录真实主将ID及实际属性变化。 |
| 候补教官 | 满编转训经验按原值×1.5向下取整，受999总经验上限约束；另有正收益测试证明经验实际增加。满编传说进入候补时不转训、不触发。 |
| 精兵协议 | 传说及以上当前/未来正式兵攻疗+10%。与融合军规在同一永久基础上合计22%，领取顺序不影响结果，临时战令不被当成永久基础重复放大。 |

零收益单独验证：永久属性取整未增加数值时，不记录虚假的新增攻击；满血治疗/满经验不冒充成功收益。正式士兵若符合永久被动资格却缺少属性账本，恢复校验拒绝该不完整存档，避免下一次培养再次叠加；合法新档和未获被动的旧制档仍可恢复。

## 运行结果

- `npm test`：354项，全部通过。基线309项未删除规则覆盖；更新旧生命/终幕期望，新增生命、鸣钟、被动、界面数据和迁移测试。
- `npm run build`：成功，153个模块。Vite仍提示主JS包超过500kB（548.65kB）；这是体积提示，不是构建错误，本轮未调整资源或拆包。
- `node scripts/verify-builds.mjs`：三条合法路线均推进至十二波胜利，逐动作重放完整快照与RNG一致。这里只验证同一新规则下的重放一致性；新生命和构筑会依法改变旧版本的路线结果，不宣称与旧战绩逐值相同。
- `node scripts/verify-presentation.mjs`：真实第三波神话、第五波棱彩融合路线仍合法。
- `LEGION_TEST_URL=http://127.0.0.1:5187/ node scripts/check-life-builds-ui.mjs`：16组浏览器验收通过，运行时异常0。
- `/Users/Admin/.bun/bin/bun scripts/build-legion-demo.mjs`：已基于新构建重新生成可双击离线版`output/legion-demo.html`。

| 合法路线 | 种子/角色 | 操作数 | 最终状态 | 生命 | 金币 | 蓝水晶 | 击退 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 改印高阶牌型 | 4/鬼手 | 167 | 第12波胜利 | 12/12 | 120 | 55 | 164 |
| 连续出牌与集训 | 1/替嗓 | 186 | 第12波胜利 | 12/12 | 152 | 58 | 165 |
| 治疗转伤害 | 3/活扣 | 175 | 第12波胜利 | 12/12 | 220 | 35 | 173 |

完整引擎路线记录：`output/build-verification.json`。它包含每次合法选牌、消费、上架候选、领取、计分来源和最终快照。

## 浏览器连续一局

浏览器从种子4新局开始，执行167次合法动作，中途不注入资源、不替换波次快照，使用真实战斗计时器连续完成十二波。第一波选连奏；第四波选变奏；第五波选方片回流；第十一波选红桃誓约。第5、10波额外蓝水晶独立发放，第六波首领后正常三选一、购物并推进，第十二波直接胜利且货架为空。

该局获得5项构筑：连奏实际触发1次，变奏12次，方片回流2次，红桃誓约激活1次，主将军令0次。红桃誓约在此路线只有激活记录，没有可归属的额外有效治疗；没有把激活次数冒充治疗收益。至少三项产生直接收益的构筑已实际打出。其余被动逐项真实结算由自动测试及另两条路线覆盖，不声称本局同时集齐12项。

另用合法弱军团分支实测：

- 第1波真实流寇突破，生命12→11，战报逐条记录单位与来源。
- 第2波合法改印两张计分红心，红心回响使生命3→4；友军满血时有效友军治疗仍为0。
- 第3波8.033秒真实鸣钟，新增带`bellSourceId`的流寇，生命4→4；随后击杀/突破/超时沿统一规则处理。
- 生命0时仍处于交战，再一次真实突破才失败；该次实际扣血0但尝试扣血1、失败标记为真，未产生负生命。
- 险境新局生命8/8。

五个尺寸1366×900、390×844、360×740、844×390、768×1024均检查资源栏、0生命警告、生命事件、双货币和胜利结算。窄屏长内容可滚动，终幕初始焦点在标题，不再因重试按钮自动滚到底部。主要实战截图已逐张查看。

### 证据路径

| 内容 | 文件（仓库根目录下） |
| --- | --- |
| 浏览器断言与全局异常 | `output/life-builds-ui-verification.json` |
| 连续一局逐动作记录 | `output/life-build-journey-actions.json` |
| 构筑及终幕同屏 | `output/life-build-result-1366x900-top.png` |
| 手机终幕 | `output/life-build-result-390x844-top.png`、`output/life-build-result-360x740-top.png` |
| 真实突破逐条战报 | `output/life-build-actual-enemy-breach-report.png` |
| 真实回血 | `output/life-build-actual-red-heart-life-heal.png` |
| 鸣钟真实流寇 | `output/life-build-actual-bell-raider-spawn.png`、`output/life-build-actual-bell-life-report.png` |
| 险境上限 | `output/life-build-veteran-eight-life.png` |
| 0生命及各尺寸 | `output/life-build-size-360x740-zero-life.png`及同前缀尺寸截图 |

截图和完整JSON在本地生成输出目录，未把大型生成资源纳入源代码仓库。脚本可在当前代码重建。

## 旧存档迁移

复用内部`baseHp/maxBaseHp`以减少迁移风险，新存档`lifeVersion:1`。旧生命比例向上取整映射；旧档受损时至多保留新上限减1，进行中有效档至少1，失败档0。旧上限每+10映射为新+2，再受难度基础值两倍限制。示例标准50/100→6/12、99/100→11/12；险境37/75→4/8，47/95→6/12。

旧战报和鸣钟直伤只保留历史，新的生命账本从恢复时状态开始，绝不再扣一次。旧奖励具体目标和原候选顺序保留、不重抽；已领状态保留。旧上限奖励迁移后若已达到新上限，仅该失效候选采用确定性资源兜底，不消耗RNG。旧版第十二波已清场却停在商店的有效档直接转为胜利，不重复付款，也不追扣旧版已发货币。

额外从`git archive f99d3d9`真正运行旧引擎，取得备战、交战、未领奖励、已领奖励商店、末波未领取、末波已领取六个原始快照，再用新引擎恢复。六种均保留原军团、物品、钱包、波次与RNG；重复恢复幂等。证据`output/life-actual-f99-migration.json`。

波后领取奖励还会更新已结束战报的生命事件与构筑事件，并换报告对象使本地历史能够保存最新领取结果，不重算已经冻结的战斗统计。旧制未领奖励档恢复后，新增的回血/上限变化保存在独立的“读档后波后生命”记录中，旧防线及旧钟击历史保持原样；重复领取不会新增事件。

## 修改文件摘要

- `src/playerLife.js`统一生命损失、恢复、上限和援军事件；`tactics.js`配置难度初始生命；`combatActions.js`、`combatClock.js`、`combatHealth.js`、`gameState.js`与`campaign.js`接入真实事件和最终波流程。
- `src/buildPassives.js`集中12规则、每波状态、触发事件和永久属性账本；`waveRewards.js`把它们接入36池；`handPlan.js`、`scoreBreakdown.js`、`recruitOrder.js`、`campArmy.js`、`training.js`、`forge.js`、`rewardModifiers.js`接入预览、结算和培养。
- `src/itemEffects.js`、`itemTrace.js`、`campaignRules.js`更新3件生命道具；`combatStats.js`、`reportTelemetry.js`、`presentationFacts.js`、`scoreSequence.js`保留真实因果和表现只读。
- `src/gameSave.js`实现新字段验证、账本完整性、旧生命和终幕迁移。
- 新增`LifeReport.vue`、`BuildPassives.vue`、`lifeReportViews.js`、`buildDisplay.js`；更新主界面、预览、手册、战报、双货币与终幕样式。`enemyCatalog.js`、`performance.js`仅更新文字，不改动画或战斗参数。
- 新增`playerLife.test.js`、`lifeCombat.test.js`、`buildPassives.test.js`、`lifeMigration.test.js`、`lifeBuildViews.test.js`；现有规则测试同步新生命、奖励和末波期望。
- 新增`scripts/check-life-builds-ui.mjs`、`scripts/life-ui-fixtures.mjs`；更新合法路线`scripts/verify-builds.mjs`以及`README.md`、`DESIGN.md`。

## 仍需试玩平衡

目前未发现阻止十二波完成、读档或奖励生效的已知问题。需要多种子真人试玩确认生命容错、每层铆钉的恢复节奏、构筑上架频率和四花色成型成本；本轮没有根据单一种子调整军令、金币、价格或敌军强度。12项被动不会在一局11次奖励里保证全部出现，也不会强塞固定方向。手机长战报/构筑列表需要滚动；主JS包体积提示仍保留。

## 完整修改文件清单

```text
DESIGN.md
README.md
scripts/verify-builds.mjs
src/ActionPreview.vue
src/BattlePlan.vue
src/EconomySummary.vue
src/FieldManual.vue
src/JokerTable.vue
src/LegionGame.vue
src/ScoreBreakdown.vue
src/WaveReport.vue
src/bossCampaign.test.js
src/buildStrategies.test.js
src/campArmy.js
src/campaign.js
src/campaignRules.js
src/combatActions.js
src/combatClock.js
src/combatHealth.js
src/combatStats.js
src/combatStats.test.js
src/economy-ui.css
src/economy.test.js
src/enemyCatalog.js
src/engine.test.js
src/forge.js
src/gameSave.js
src/gameState.js
src/growthMarket.test.js
src/handPlan.js
src/highTierReadOnly.test.js
src/itemEffects.js
src/itemTrace.js
src/onboarding.js
src/performance.js
src/presentationFacts.js
src/presentationFacts.test.js
src/recruitOrder.js
src/reportTelemetry.js
src/rewardIntegration.test.js
src/rewardModifiers.js
src/scoreBreakdown.js
src/scoreBreakdown.test.js
src/scoreSequence.js
src/scoreTelemetry.test.js
src/supplyExperience.test.js
src/tactics.js
src/tactics.test.js
src/training.js
src/waveRewards.js
src/waveRewards.test.js
docs/life-builds-finale-2026-11-25.md
scripts/check-life-builds-ui.mjs
scripts/life-ui-fixtures.mjs
src/BuildPassives.vue
src/LifeReport.vue
src/buildDisplay.js
src/buildPassives.js
src/buildPassives.test.js
src/lifeBuildViews.test.js
src/lifeCombat.test.js
src/lifeMigration.test.js
src/lifeReportViews.js
src/playerLife.js
src/playerLife.test.js
```
