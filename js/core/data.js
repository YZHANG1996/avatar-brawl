// ============ 元素 / 称号 / 通用工具（平台无关） ============

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampStat(v) { return Math.max(10, Math.min(100, Math.round(v))); }

const ELEMENTS = {
  fire:    { name: '火',  color: '#ff5a3c', skill: '烈焰冲撞', emoji: '🔥', counters: ['metal'] },
  metal:   { name: '金',  color: '#ffd76a', skill: '破甲一击', emoji: '⚔️', counters: ['wood'] },
  wood:    { name: '木',  color: '#58d158', skill: '荆棘缠绕', emoji: '🌿', counters: ['earth'] },
  water:   { name: '水',  color: '#4aa8ff', skill: '治愈之泉', emoji: '💧', counters: ['fire'] },
  earth:   { name: '土',  color: '#c9a06a', skill: '大地壁垒', emoji: '⛰️', counters: ['water', 'thunder'] },
  thunder: { name: '雷',  color: '#b96aff', skill: '天雷引',   emoji: '⚡', counters: ['water', 'metal'] },
  chaos:   { name: '混沌', color: '#a8b2c1', skill: '混沌波动', emoji: '🌀', counters: [] },
};

const STAT_META = {
  atk: { name: '攻击', desc: '色彩烈度', color: '#ff6b5a' },
  def: { name: '防御', desc: '构图沉稳', color: '#6ab0ff' },
  spd: { name: '速度', desc: '细节密度', color: '#6affc3' },
  skl: { name: '技巧', desc: '色彩丰富', color: '#ffd76a' },
  lck: { name: '运气', desc: '头像玄学', color: '#c58aff' },
};
const STAT_KEYS = ['atk', 'def', 'spd', 'skl', 'lck'];

const TITLES = [
  { el: 'fire',   top: 'atk', name: '烈焰狂战士' },
  { el: 'fire',   top: 'spd', name: '赤焰刺客' },
  { el: 'metal',  top: 'atk', name: '黄金重炮手' },
  { el: 'metal',  top: 'def', name: '不朽金身' },
  { el: 'wood',   top: 'def', name: '古树守卫' },
  { el: 'wood',   top: 'skl', name: '藤蔓戏法师' },
  { el: 'water',  top: 'def', name: '深海壁垒' },
  { el: 'water',  top: 'skl', name: '碧波贤者' },
  { el: 'earth',  top: 'def', name: '磐岩巨人' },
  { el: 'earth',  top: 'atk', name: '山崩猛将' },
  { el: 'fire',   top: 'def', name: '熔岩壁垒' },
  { el: 'water',  top: 'atk', name: '怒涛战神' },
  { el: 'metal',  top: 'skl', name: '飞银流光' },
  { el: 'wood',   top: 'atk', name: '破竹先锋' },
  { el: 'earth',  top: 'spd', name: '裂地奔行者' },
];

function titleFor(f) {
  if (f.element === 'thunder') return '雷霆之主';
  if (f.element === 'chaos') return '混沌行者';
  const s = f.stats;
  if (s.lck >= 85 && s.lck >= Math.max(s.atk, s.def, s.spd, s.skl)) return '天选之人';
  const top = ['atk', 'def', 'spd', 'skl'].reduce((a, b) => (s[b] > s[a] ? b : a));
  const hit = TITLES.find((t) => t.el === f.element && t.top === top);
  return hit ? hit.name : '无名战士';
}
