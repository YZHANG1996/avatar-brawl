// ============ 战斗模拟器：双方特征 → 确定性事件流（平台无关） ============
// 结果只依赖双方头像哈希，同两个头像 PK 结果恒定

const BattleSim = (() => {

  function counterMult(ae, de) {
    if (ELEMENTS[ae].counters.includes(de)) return 1.3;
    if (ELEMENTS[de].counters.includes(ae)) return 0.72;
    return 1;
  }

  function makeUnit(f, side) {
    const hp = Math.round(80 + f.stats.def * 1.8);
    return {
      side, f, title: f.title, elem: f.element,
      hp, maxHp: hp, shield: 0, weakNext: false, burnStacks: 0,
      totDmg: 0, maxHit: 0, crits: 0, dodges: 0, skills: 0, extras: 0,
    };
  }

  function simulate(fa, fb) {
    const A = makeUnit(fa, 'A');
    const B = makeUnit(fb, 'B');
    let seed = (fa.hash ^ fb.hash) >>> 0;
    if (!seed) seed = 0x9e3779b9;
    const rng = mulberry32(seed);
    const ev = [{ type: 'intro' }];

    const foe = (u) => (u === A ? B : A);

    function dealDamage(u, t, raw, opts = {}) {
      if (rng() < t.f.stats.lck * 0.0016) {
        t.dodges++;
        ev.push({ type: 'miss', actor: u.side, label: '闪避!' });
        return;
      }
      let d = raw;
      const cm = counterMult(u.elem, t.elem);
      const crit = rng() < u.f.stats.lck * 0.0035;
      if (crit) d *= 1.7;
      if (u.elem === 'chaos') d *= 0.7 + rng() * 0.8;
      d = Math.max(1, Math.round(d));
      let shieldDmg = 0;
      if (t.shield > 0) {
        shieldDmg = Math.min(t.shield, d);
        t.shield -= shieldDmg;
        d -= shieldDmg;
      }
      t.hp -= d;
      const dealt = d + shieldDmg;
      u.totDmg += dealt;
      if (dealt > u.maxHit) u.maxHit = dealt;
      if (crit) u.crits++;
      ev.push({
        type: opts.skill ? 'skill' : 'attack',
        actor: u.side, dmg: dealt, shieldDmg, crit,
        counter: cm > 1 ? 1 : (cm < 1 ? -1 : 0),
        hpA: A.hp, hpB: B.hp, label: opts.label || null, elem: u.elem,
      });
    }

    function normalRaw(u, t, defFactor = 1) {
      const defE = t.f.stats.def * defFactor;
      return u.f.stats.atk * (0.85 + rng() * 0.3) * (1 - defE / (defE + 130));
    }

    function act(u) {
      const t = foe(u);

      if (u.burnStacks > 0) {
        const bd = Math.round(u.maxHp * 0.05);
        u.burnStacks--;
        u.hp -= bd;
        ev.push({ type: 'burn', actor: u.side, dmg: bd, hpA: A.hp, hpB: B.hp });
        if (u.hp <= 0) return;
      }

      const useSkill = rng() < 0.08 + u.f.stats.skl * 0.004;
      let outMult = 1;
      if (u.weakNext) { outMult = 0.7; u.weakNext = false; }

      if (useSkill) {
        u.skills++;
        const e = u.elem;
        const E = ELEMENTS[e];
        if (e === 'water') {
          const heal = Math.round(u.maxHp * 0.14);
          u.hp = Math.min(u.maxHp, u.hp + heal);
          ev.push({ type: 'heal', actor: u.side, heal, hpA: A.hp, hpB: B.hp, label: E.skill });
          dealDamage(u, t, normalRaw(u, t) * 0.6, { skill: true, label: E.skill });
        } else if (e === 'earth') {
          u.shield += Math.round(u.maxHp * 0.12);
          ev.push({ type: 'shield', actor: u.side, shield: u.shield, label: E.skill });
          dealDamage(u, t, normalRaw(u, t) * 0.8, { skill: true, label: E.skill });
        } else if (e === 'fire') {
          t.burnStacks += 2;
          dealDamage(u, t, normalRaw(u, t) * 1.55, { skill: true, label: E.skill });
        } else if (e === 'metal') {
          dealDamage(u, t, normalRaw(u, t, 0.7) * 1.5, { skill: true, label: E.skill });
        } else if (e === 'wood') {
          t.weakNext = true;
          dealDamage(u, t, normalRaw(u, t) * 1.25, { skill: true, label: E.skill });
        } else if (e === 'thunder') {
          dealDamage(u, t, normalRaw(u, t) * 1.2, { skill: true, label: E.skill });
          if (t.hp > 0 && rng() < 0.4) {
            u.extras++;
            ev.push({ type: 'banner', actor: u.side, label: '⚡ 雷之连击!' });
            dealDamage(u, t, normalRaw(u, t) * 0.8, { skill: true, label: '追击' });
          }
        } else if (e === 'chaos') {
          if (rng() < 0.25) {
            ev.push({ type: 'banner', actor: u.side, label: '🌀 混沌失稳…' });
          } else {
            dealDamage(u, t, normalRaw(u, t) * 1.8, { skill: true, label: E.skill });
          }
        }
      } else {
        dealDamage(u, t, normalRaw(u, t) * outMult);
      }

      // 速度压制：快 15 点以上有概率追击
      if (t.hp > 0 && u.hp > 0 && u.f.stats.spd - t.f.stats.spd >= 15 && rng() < 0.18) {
        u.extras++;
        ev.push({ type: 'banner', actor: u.side, label: '💨 速度追击!' });
        dealDamage(u, t, normalRaw(u, t) * 0.7, { label: '追击' });
      }
    }

    let rounds = 0, guard = 0;
    while (A.hp > 0 && B.hp > 0 && guard++ < 200 && rounds < 30) {
      rounds++;
      let first;
      if (A.f.stats.spd !== B.f.stats.spd) first = A.f.stats.spd > B.f.stats.spd ? A : B;
      else first = rng() < 0.5 ? A : B;
      const second = foe(first);
      act(first);
      if (second.hp > 0 && first.hp > 0) act(second);
    }

    let winner;
    if (A.hp <= 0 && B.hp <= 0) winner = A.f.power >= B.f.power ? 'A' : 'B';
    else if (A.hp <= 0) winner = 'B';
    else if (B.hp <= 0) winner = 'A';
    else winner = A.hp === B.hp ? (A.f.power >= B.f.power ? 'A' : 'B') : (A.hp > B.hp ? 'A' : 'B');

    ev.push({ type: 'ko', winner });

    return { events: ev, winner, A, B, rounds };
  }

  return { simulate };
})();
