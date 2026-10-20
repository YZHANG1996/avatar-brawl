// ============ 战斗演出：把 BattleSim 的事件流渲染成对战动画 ============

const BattleScene = (() => {
  const W = 750, H = 1334;
  const POS = { A: { x: 185, y: 950 }, B: { x: 565, y: 400 } };
  const SIZE = 235;
  const DUR = { intro: 1700, attack: 820, skill: 1080, heal: 700, shield: 700, burn: 620, miss: 600, banner: 720, ko: 2000 };

  let raf = null, S = null;

  function play(canvas, pack, onEnd) {
    const { avA, avB, fa, fb, sim } = pack;
    // 时间轴
    const times = [];
    let acc = 0;
    for (const e of sim.events) {
      times.push(acc);
      acc += DUR[e.type] || 800;
    }
    S = {
      canvas, ctx: canvas.getContext('2d'), avA, avB, fa, fb, sim,
      events: sim.events, times, total: acc,
      t0: performance.now(), speed: 1, evIdx: -1, ended: false, onEnd,
      particles: [], floaters: [], shake: 0, banner: null,
      hpShown: { A: sim.A.maxHp, B: sim.B.maxHp },
      hpTarget: { A: sim.A.maxHp, B: sim.B.maxHp },
      shieldShown: { A: 0, B: 0 }, shieldTarget: { A: 0, B: 0 },
      hitFlash: { A: 0, B: 0 }, koInfo: null, introDone: false,
    };
    canvas.onclick = () => { if (S) S.t0 = performance.now() - S.total / S.speed - 1; };
    cancelAnimationFrame(raf);
    loop();
  }

  function setSpeed(v) { if (S) S.speed = v; }

  function loop() {
    if (!S) return;
    const elapsed = (performance.now() - S.t0) * S.speed;
    step(elapsed);
    draw(elapsed);
    if (elapsed >= S.total) {
      if (!S.ended) { S.ended = true; if (S.onEnd) S.onEnd(); }
      raf = requestAnimationFrame(loop); // 结束后保持 KO 画面
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function step(elapsed) {
    // 找到当前事件
    let idx = 0;
    for (let i = 0; i < S.times.length; i++) if (elapsed >= S.times[i]) idx = i;
    if (idx !== S.evIdx) {
      S.evIdx = idx;
      onEventEnter(S.events[idx]);
    }
    // HP 平滑
    for (const k of ['A', 'B']) {
      S.hpShown[k] += (S.hpTarget[k] - S.hpShown[k]) * 0.12;
      S.shieldShown[k] += (S.shieldTarget[k] - S.shieldShown[k]) * 0.15;
      S.hitFlash[k] = Math.max(0, S.hitFlash[k] - 0.05);
    }
    // 粒子
    S.particles = S.particles.filter((p) => p.life > 0);
    for (const p of S.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= 0.022; p.rot += p.vr;
    }
    S.floaters = S.floaters.filter((f) => f.life > 0);
    for (const f of S.floaters) { f.y -= 1.8; f.life -= 0.016; }
    S.shake *= 0.88;
    if (S.banner) S.banner.life -= 0.025;
  }

  function onEventEnter(e) {
    const other = (k) => (k === 'A' ? 'B' : 'A');
    if (e.type === 'attack' || e.type === 'skill') {
      const t = other(e.actor);
      S.hpTarget[t] = t === 'A' ? e.hpA : e.hpB;
      S.hitFlash[t] = 1;
      const tp = POS[t];
      spawnParticles(tp.x, tp.y, e.elem, e.type === 'skill' ? 42 : 22, e.type === 'skill' ? 1.6 : 1);
      S.floaters.push({
        x: tp.x, y: tp.y - 150, text: '-' + e.dmg,
        color: e.crit ? '#ff9d3c' : '#ff5a4a', size: e.crit ? 92 : 64, life: 1,
      });
      S.shake = e.crit ? 26 : (e.type === 'skill' ? 20 : 13);
      if (e.crit) S.banner = { text: '暴击!', color: '#ff9d3c', life: 1 };
      else if (e.counter > 0) S.banner = { text: '属性克制 ×1.3', color: '#ffd76a', life: 1 };
      else if (e.counter < 0) S.banner = { text: '属性被克 ×0.72', color: '#9aa3b5', life: 1 };
      if (e.shieldDmg > 0) S.floaters.push({ x: tp.x + 70, y: tp.y - 90, text: '🛡' + e.shieldDmg, color: '#6ab0ff', size: 40, life: 1 });
    } else if (e.type === 'miss') {
      S.banner = { text: e.label || '闪避!', color: '#6affc3', life: 1 };
      const t = other(e.actor);
      S.floaters.push({ x: POS[t].x, y: POS[t].y - 150, text: 'MISS', color: '#6affc3', size: 56, life: 1 });
    } else if (e.type === 'banner') {
      S.banner = { text: e.label, color: '#e8e6df', life: 1 };
    } else if (e.type === 'burn') {
      const k = e.actor;
      S.hpTarget[k] = k === 'A' ? e.hpA : e.hpB;
      S.hitFlash[k] = 1;
      spawnParticles(POS[k].x, POS[k].y, 'fire', 16, 1);
      S.floaters.push({ x: POS[k].x, y: POS[k].y - 150, text: '🔥-' + e.dmg, color: '#ff8a5c', size: 52, life: 1 });
      S.shake = 8;
    } else if (e.type === 'heal') {
      const k = e.actor;
      S.hpTarget[k] = k === 'A' ? e.hpA : e.hpB;
      S.floaters.push({ x: POS[k].x, y: POS[k].y - 150, text: '+' + e.heal, color: '#6affa3', size: 62, life: 1 });
      spawnParticles(POS[k].x, POS[k].y, 'water', 18, 1);
      S.banner = { text: (e.label || '') + ' 💧回复', color: '#6affa3', life: 1 };
    } else if (e.type === 'shield') {
      const k = e.actor;
      S.shieldTarget[k] = e.shield;
      S.floaters.push({ x: POS[k].x, y: POS[k].y - 150, text: '🛡 护盾', color: '#6ab0ff', size: 52, life: 1 });
      S.banner = { text: (e.label || '') + ' ⛰️护盾', color: '#6ab0ff', life: 1 };
    } else if (e.type === 'ko') {
      S.koInfo = { winner: e.winner, t: performance.now() };
      S.hpTarget.A = Math.max(0, S.sim.A.hp);
      S.hpTarget.B = Math.max(0, S.sim.B.hp);
      const wp = POS[e.winner];
      spawnParticles(wp.x, wp.y, S['f' + e.winner] ? S['f' + e.winner].element : 'metal', 60, 2);
      S.shake = 22;
    }
  }

  function spawnParticles(x, y, elem, count, power) {
    const colors = {
      fire: ['#ff5a3c', '#ff9d3c', '#ffd76a'], metal: ['#ffd76a', '#fff3c9', '#e8c56a'],
      wood: ['#58d158', '#9aff9a', '#d4ff9a'], water: ['#4aa8ff', '#8ad0ff', '#d0ecff'],
      earth: ['#c9a06a', '#e8cba0', '#8a6a44'], thunder: ['#b96aff', '#e0c0ff', '#8a5cff'],
      chaos: ['#a8b2c1', '#dfe6f0', '#7a8698'],
    }[elem] || ['#fff'];
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (3 + Math.random() * 9) * power;
      S.particles.push({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 3,
        g: 0.28, size: 5 + Math.random() * 9, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        color: colors[(Math.random() * colors.length) | 0], life: 0.8 + Math.random() * 0.6,
        shape: Math.random() < 0.5 ? 'c' : 'r',
      });
    }
  }

  function fighterTransform(e, k, p) {
    // 返回当前事件中某战士的位置/缩放/旋转
    const pos = { x: POS[k].x, y: POS[k].y, scale: 1, rot: 0 };
    if (!e) return pos;
    const foe = k === 'A' ? 'B' : 'A';
    if ((e.type === 'attack' || e.type === 'skill' || e.type === 'miss') && e.actor === k) {
      if (p < 0.3) {
        pos.scale = 1 + 0.08 * Math.sin(p / 0.3 * Math.PI);
        pos.x += (Math.random() - 0.5) * 5;
      } else if (p < 0.58) {
        const q = Appraisal.easeOut((p - 0.3) / 0.28);
        pos.x = POS[k].x + (POS[foe].x - POS[k].x) * q;
        pos.y = POS[k].y + (POS[foe].y - POS[k].y) * q;
        if (e.type === 'miss' && p > 0.5) {
          // 闪避:冲过头
          pos.x += (POS[foe].x - POS[k].x) * 0.3;
        }
        pos.scale = 1.12;
        pos.rot = Math.atan2(POS[foe].y - POS[k].y, POS[foe].x - POS[k].x) * 0.12;
      } else {
        const q = Appraisal.easeOut((p - 0.58) / 0.42);
        const startX = POS[foe].x, startY = POS[foe].y;
        pos.x = startX + (POS[k].x - startX) * q;
        pos.y = startY + (POS[k].y - startY) * q;
        pos.scale = 1.12 - 0.12 * q;
      }
    } else if ((e.type === 'attack' || e.type === 'skill') && e.actor === foe && p > 0.55 && p < 0.85) {
      // 被击退
      const q = Math.sin((p - 0.55) / 0.3 * Math.PI);
      const dx = POS[k].x < POS[foe].x ? -1 : 1;
      pos.x += dx * q * 34;
      pos.rot = dx * q * 0.12;
    } else if (e.type === 'burn' && e.actor === k) {
      pos.y += Math.sin(p * Math.PI * 6) * 6;
    }
    if (S.koInfo) {
      if (k === S.koInfo.winner) {
        pos.scale = 1 + Math.sin((performance.now() - S.koInfo.t) / 200) * 0.04 + 0.06;
      } else {
        pos.rot = 0.35; pos.y += 60; pos.scale = 0.95;
      }
    }
    return pos;
  }

  function draw(elapsed) {
    const { ctx, avA, avB, fa, fb } = S;
    ctx.save();
    const sh = S.shake;
    if (sh > 0.5) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#171b2b');
    g.addColorStop(1, '#10131f');
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, W + 80, H + 80);
    // 战场圈
    ctx.beginPath();
    ctx.ellipse(W / 2, 700, 330, 150, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,106,0.15)';
    ctx.lineWidth = 3;
    ctx.stroke();

    let idx = 0;
    for (let i = 0; i < S.times.length; i++) if (elapsed >= S.times[i]) idx = i;
    const e = S.events[idx];
    const evStart = S.times[idx];
    const evDur = (DUR[e.type] || 800);
    const p = Math.min((elapsed - evStart) / evDur, 1);

    // intro 滑入
    if (e.type === 'intro') {
      const q = Appraisal.easeOut(p);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 110px -apple-system, PingFang SC, sans-serif';
      ctx.fillStyle = `rgba(255,215,106,${1 - p})`;
      ctx.strokeStyle = `rgba(255,90,60,${1 - p})`;
      ctx.lineWidth = 4;
      ctx.strokeText('VS', W / 2, 700);
      ctx.fillText('VS', W / 2, 700);
      ctx.restore();
    }

    // 战士
    for (const k of ['B', 'A']) {
      const pos = fighterTransform(e, k, p);
      let introOff = 0;
      if (!S.introDone) {
        const ip = Math.min(elapsed / DUR.intro, 1);
        introOff = (1 - Appraisal.easeOut(ip)) * (k === 'A' ? -500 : 500);
        if (ip >= 1) S.introDone = true;
      }
      const av = k === 'A' ? avA : avB;
      const f = k === 'A' ? fa : fb;
      const E = ELEMENTS[f.element];
      ctx.save();
      ctx.translate(pos.x + introOff, pos.y);
      ctx.rotate(pos.rot);
      const loser = S.koInfo && S.koInfo.winner !== k;
      ctx.globalAlpha = loser ? 0.55 : 1;
      Appraisal.drawAvatarFrame(ctx, av, 0, 0, SIZE, E.color, pos.scale);
      // 受击红闪
      if (S.hitFlash[k] > 0.05) {
        ctx.fillStyle = `rgba(255,60,40,${S.hitFlash[k] * 0.45})`;
        Appraisal.roundRect(ctx, -SIZE * pos.scale / 2 + 6, -SIZE * pos.scale / 2 + 6, SIZE * pos.scale - 12, SIZE * pos.scale - 12, 30);
        ctx.fill();
      }
      // 技能光环
      if ((e.type === 'skill') && e.actor === k && p < 0.5) {
        ctx.strokeStyle = Appraisal.hexA(E.color, 1 - p * 2);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, SIZE * 0.75 + p * 60, 0, Math.PI * 2);
        ctx.stroke();
      }
      // KO 王冠/坠灰
      if (S.koInfo) {
        ctx.textAlign = 'center';
        if (S.koInfo.winner === k) {
          ctx.font = '64px serif';
          ctx.fillText('👑', 0, -SIZE / 2 - 22);
        }
      }
      ctx.restore();
    }

    // 回合数
    ctx.textAlign = 'center';
    ctx.font = '900 30px -apple-system, PingFang SC, sans-serif';
    ctx.fillStyle = 'rgba(232,230,223,0.4)';
    ctx.fillText(`ROUND ${S.sim.rounds}`, W / 2, 70);

    // HP 条
    drawHpBar(ctx, 'B', fb, 60, 160, 400);
    drawHpBar(ctx, 'A', fa, 290, 1145, 400);

    // 横幅
    if (S.banner && S.banner.life > 0) {
      const bl = S.banner.life;
      const pop = bl > 0.8 ? (1 - bl) / 0.2 : 1;
      ctx.save();
      ctx.translate(W / 2, 640);
      ctx.scale(1 + (1 - pop) * 0.6, 1 + (1 - pop) * 0.6);
      ctx.globalAlpha = Math.min(bl * 2, 1);
      ctx.font = '900 56px -apple-system, PingFang SC, sans-serif';
      ctx.fillStyle = S.banner.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 6;
      ctx.strokeText(S.banner.text, 0, 0);
      ctx.fillText(S.banner.text, 0, 0);
      ctx.restore();
    }

    // 粒子
    for (const pc of S.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(pc.life, 0);
      ctx.translate(pc.x, pc.y);
      ctx.rotate(pc.rot);
      ctx.fillStyle = pc.color;
      if (pc.shape === 'c') {
        ctx.beginPath();
        ctx.arc(0, 0, pc.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-pc.size / 2, -pc.size / 2, pc.size, pc.size);
      }
      ctx.restore();
    }

    // 飘字
    for (const fl of S.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(fl.life, 0);
      ctx.textAlign = 'center';
      ctx.font = `900 ${fl.size}px -apple-system, PingFang SC, sans-serif`;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 7;
      ctx.strokeText(fl.text, fl.x, fl.y);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawHpBar(ctx, k, f, x, y, w) {
    const E = ELEMENTS[f.element];
    const h = 26;
    const u = S.sim[k];
    // 名牌
    ctx.textAlign = k === 'B' ? 'left' : 'right';
    ctx.font = '900 28px -apple-system, PingFang SC, sans-serif';
    ctx.fillStyle = '#e8e6df';
    const nx = k === 'B' ? x : x + w;
    ctx.fillText(`${E.emoji} ${f.title}`, nx, y - 34);
    ctx.font = '24px -apple-system, PingFang SC, sans-serif';
    ctx.fillStyle = 'rgba(232,230,223,0.5)';
    ctx.fillText(`${E.name}属性 · 战力 ${f.power}`, nx, y - 6);
    // 轨道
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    Appraisal.roundRect(ctx, x, y, w, h, 13);
    ctx.fill();
    // 血量
    const ratio = Math.max(0, S.hpShown[k] / u.maxHp);
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#ff5a4a');
    grad.addColorStop(1, ratio > 0.35 ? '#ffb03c' : '#ff3c3c');
    ctx.fillStyle = grad;
    Appraisal.roundRect(ctx, x, y, Math.max(ratio * w, 0.001), h, 13);
    ctx.fill();
    // 护盾段
    const sr = Math.min(S.shieldShown[k] / u.maxHp, 1 - ratio);
    if (sr > 0.01) {
      ctx.fillStyle = 'rgba(106,176,255,0.85)';
      Appraisal.roundRect(ctx, x + ratio * w, y, sr * w, h, 0);
      ctx.fill();
    }
    // 数值
    ctx.textAlign = k === 'B' ? 'right' : 'left';
    ctx.font = '900 22px -apple-system, PingFang SC, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`${Math.max(0, Math.round(S.hpShown[k]))}/${u.maxHp}`, k === 'B' ? x + w - 8 : x + 8, y + h + 26);
  }

  function stop() { cancelAnimationFrame(raf); S = null; }

  return { play, setSpeed, stop };
})();
