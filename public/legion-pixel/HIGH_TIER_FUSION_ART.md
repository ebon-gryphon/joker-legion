# 高阶副职模块小尺寸打磨

新增资源 `high-tier-fusion-parts.png`，1261×1247 RGBA，动态2列×2行透明图集。仅替换四个高阶样板中的焰术师、刺客副职模块。原32格主职业图集、原armory及其他副职资源均未修改。

| 格 | 品质／副职 | 主要轮廓 |
|---|---|---|
| 0 | 神话焰术师 | 短粗箍环法器、连成整体的火焰核心 |
| 1 | 棱彩焰术师 | 分阶叉座、大块焰心 |
| 2 | 神话刺客 | 宽V形双腰刃、中央透明负空间 |
| 3 | 棱彩刺客 | 阶梯护手、宽斜刃面，保持双刃空隙 |

使用内置image_gen，以本项目armory.png与high-tier-parts.png为风格参考，新生成独立资源。未使用API/CLI回退，未覆盖已有PNG。生成原件位于 `/Users/Admin/.codex/generated_images/01a20399-547a-7132-a447-6ae604808053/exec-2dc1975f-78c9-451a-a355-2f440f9c57bd.png`。

实际图集尺寸由工具决定；装载器按自然宽高的2×2网格裁取透明边界，不假定整除像素。

完整生成提示词：

```text
Use case: stylized-concept. Create a NEW tiny-equipment transparent sprite atlas for this existing tactical pixel game, matching the two reference atlases' 3/4 view facing right, dark plum/brown outlines, warm upper-left light and chunky pixel shading. ONLY four small secondary fusion equipment modules, no full characters. STRICT 2 columns by 2 rows regular grid, four square cells, equal margins, actual transparent alpha background; centered and complete inside each cell with 12% transparent gutter. No text, labels, gridlines, character faces or bodies, no particles or halos.
Top left MYTHIC FIRE module: a short stout ritual fire brazier / handheld magical fire-core. Readable broad FLAME TEARDROP silhouette with a forked iron holder, thick short lower grip, and one large ivory flame heart. Width/height 0.65–0.75. Flame occupies upper half, continuous thick connection to holder. Top right PRISMATIC FIRE: same recognizable broad flame-core, more stepped crystalline iron holder and doubled shoulder-like prongs, not merely a color swap. Keep broad solid dark outer contour and large luminous core that remains clear in grayscale.
Bottom left MYTHIC ASSASSIN module: ONE complete paired diagonal waist blades / short sheaths ensemble. Two broad curved blades form an open wide V, with handles grouped near upper middle, tips splayed to lower left and lower right. Thick grips and guards, continuous broad blade faces, a CLEAR transparent triangular negative space between the blades. Width/height about 1.05. Bottom right PRISMATIC ASSASSIN: same complete wide V pair, slightly stepped split guards and wider beveled blade faces. Main shape still a distinct pair of short blades. Do not draw one long thin sword. No weapon should be cut off.
Critical pixel density: each module will appear only about 14x20 to 20x18 screen pixels in battle. Simplify ruthlessly into chunky connected pixel clusters with dark outer silhouette, large midtone mass and one broad highlight. Render as 32x32 logical-pixel forms enlarged nearest-neighbor for this atlas. Thick 2 logical-pixel contours, at most 3–4 broad tones per material. DO NOT copy tiny filigree, gems, runes, chains, tassels, detailed grain or fine internal lines from the references. Preserve the references' refined medieval circus material feel, but use the detail budget on a crisp readable silhouette. Gray-scale distinction is essential: flame/holder vs paired V-blades must differ by shape alone. Existing four main professions are NOT to be redrawn or included. No giant rainbow aura, no smooth HD painting, no flat vector icon style.
```
