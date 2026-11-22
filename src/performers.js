// Each playable joker starts with a familiar passive partner, while the trick belongs
// to the player and remains available even if that partner is later sold.
export const PERFORMERS = [
  { id:'ghost', avatarFrame:0, timing:'战前组牌时', doctrine:'iron', name:'鬼手', role:'老千', skill:'袖里换点', art:'joker-ghost', keyArt:'joker-ghost-deal', color:'#efb076',
    storyTitle:'两碗面',
    story:'鬼手赢了铁壁旗手一个月的饷钱。面摊快收了，旗手从靴筒里摸出两个铜子，叫了碗面，把筷子递给他。“你盯我钱袋盯了一晚上，也没顾上吃。”鬼手埋头吃完，从白手套里抽出那张方片六，当着旗手的面抹掉一点。“看错了。我这对六没凑成，钱归你。”旗手收了钱，又从鬼手的帽檐底下摸出两个铜子，给自己也叫了一碗。这回换鬼手盯他的手了。',
    opening:'先看手里差一点能凑出的对子。把相邻点数改成一对，招一名牧师，让铁壁旗手给领队加盾。',
    rule:'选一张手牌，把点数调高或调低一级。离手后失效。', cue:'在手牌里挑一张改点', partner:'铁壁旗手' },
  { id:'mirror', avatarFrame:1, timing:'交战中', doctrine:'arcane', name:'双面', role:'幻术师', skill:'镜中替身', art:'joker-mirror', keyArt:'joker-mirror-double', color:'#c9adef',
    storyTitle:'第三幕的工钱',
    story:'演到第三幕，搭档提着箱子走了。双面拖了面穿衣镜上台，在镜前坐下，一个人念两份台词。他说一句，镜中人跟一句。等他说到“你怎么还不走”，倒影忽然站起来，朝他后脑勺扮了个鬼脸。台下笑得厉害，双面坐在椅子上，一动也没敢动。那晚的工钱他只拿走一半，另一半搁在镜框上。天亮去看，铜子一枚挨一枚，全都立了起来。',
    opening:'先用战令强化术士。等敌人聚在前排，再复制已经强化的术士，让分身的六秒都花在攻击上。',
    rule:'战斗中选一名友军，复制它此刻的战力。分身能攻击和治疗，最多留场 6 秒。', cue:'点一名友军投下分身', partner:'第三幕' },
  { id:'bell', avatarFrame:2, timing:'交战中', doctrine:'scarlet', name:'铃铛', role:'设局者', skill:'响铃诱牌', art:'joker-bell', keyArt:'joker-bell-lure', color:'#ecd285',
    storyTitle:'活捉赏银十枚',
    story:'通缉令上画着铃铛的脸，底下写着活捉赏银十枚。她嫌画得丑，在每张告示背后都拴了张系铃的红桃。谁揭纸，铃就响，满街孩子跟着那人喊“十枚！十枚！”只有个小姑娘揭了纸还站在原地。她问铃铛，十枚银币够不够给弟弟请大夫。铃铛挽起她的胳膊，一道去领赏。当天傍晚，大夫收到了诊金。牢里的看守循着铃声追到走廊尽头，捡回一张红桃，上头画着他自己的丑脸。',
    opening:'让游侠在铁卫身后开弓。敌人分散时，把其中一名引到铁卫跟前，再用参与计分的红桃给伤兵回血。',
    rule:'战斗中选一名敌人，亮出一张系铃的假牌，诱使它离开原位，走到我方前排。', cue:'点一名敌人令响铃诱牌', partner:'红心回响' },
  { id:'sleeve', avatarFrame:3, timing:'战后商店', doctrine:'sleeve', name:'夹层', role:'藏牌师', skill:'袖底留牌', art:'joker-sleeve', keyArt:'joker-sleeve-hide', color:'#92bcc4',
    storyTitle:'第三张方片',
    story:'夹层做学徒时，师傅拿三张镀金的方片抵他的工钱，说一张能换个面包。到了铺子，老板用指甲一刮，金皮底下露出硬纸。夹层把刮破的那张留给老板，另两张收进袖底。二十年后，他在军营给新兵验钱，还会拆开袖线，拿出一张方片给人看。有个兵算得快，问剩下那张去了哪儿。他低头把袖口缝好。“那天饿。隔壁那家面包房暗些。”',
    opening:'先让方片参与计分赚金币。战后看过下波军情，再把改印过的牌或想围绕它凑牌型的关键牌收入袖底。',
    rule:'战后从手牌里藏一张。下波起手必定摸回这张牌，改印也会保留。', cue:'选一张牌带入下波', partner:'贪婪镀金' },
  { id:'voice', avatarFrame:4, timing:'战前随军令打出', doctrine:'voice', name:'替嗓', role:'腹语师', skill:'木偶复令', art:'joker-voice', keyArt:'joker-voice-puppet', color:'#df9c93',
    storyTitle:'有你什么事',
    story:'替嗓小时候讲故事，一说“从前”，就容易卡在那个“从”字上。台下总有人抢着替他喊“前”。他爹是个做箭的木匠，用一截剩下的桦木给他削了个小人，眉毛挑得老高，一看就没耐心。下回再有人要抢话，木偶先张了嘴，一口气喊了七八个“前”。替嗓等它嚷完，慢吞吞问了句“有你什么事？”他爹在最后一排，笑得从凳子上滑了下去。如今两翼游侠各听一个嗓子发令。收兵时，木偶偶尔还要多喊几声“收”。',
    opening:'打出三条招长弓手。队里有牧师时，用高牌让游侠加攻击，再让木偶把半份攻疗传给牧师。遇到前排吃紧，也可以让铁卫主接对子。',
    rule:'出牌时让木偶向另一兵种复述战令。主队照常受令，副队获得一半数值加成，只花一手牌的军令。', cue:'选副队并出牌', partner:'双生箭' },
  { id:'escape', avatarFrame:5, timing:'交战中', doctrine:'escape', name:'活扣', role:'逃脱师', skill:'逃生绳', art:'joker-escape', keyArt:'joker-escape-rope', color:'#aaca9a',
    storyTitle:'绞盘边的好座',
    story:'那回沉箱逃生，活扣在水里解开了三把锁，偏偏木盖泡胀了，怎么推也推不动。岸上的人还在数数。一个洗衣妇瞧见箱缝里冒出来的白手指，丢下床单去摇绞盘。箱子拖上岸时，活扣的嘴唇已经比脸上的蓝油彩还深。再演这出，她把最贵的一排座位搬到了绞盘跟前，拿只刻着荆棘花的杯子给洗衣妇收赏钱。有人嫌这个角度看不清箱子。她探出半个脑袋招呼他，“这回你瞧她的手。上回最值票钱的就是那一下。”',
    opening:'让牧师跟在铁卫后面。开战后给最值得保住的领队系绳，让它从致命一击中脱身，再靠牧师把血补回来。',
    rule:'战斗中给一名友军系绳。下次受到致命伤害时，它保留 1 点生命，被拉回后排。绳索随即解开。', cue:'点一名友军系上逃生绳', partner:'荆棘圣杯' },
]
export const performerOf = doctrine => PERFORMERS.find(actor => actor.doctrine === doctrine) || PERFORMERS[0]
export const LURE_REVEAL = .35
export const LURE_TRAVEL = .65
