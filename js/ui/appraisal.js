// ============ 鉴定报告演出：扫描头像 → 逐项揭示属性 → 雷达图 → 战力/称号 ============

const Appraisal = (() => {
  const W = 750, H = 1334;
  let raf = null;
  let state = null;

  function show(canvas, avatarCv, feature, onBack) {
    state = { canvas, ctx: canvas.getContext('2d'), avatar: avatarCv, f: feature, t0: performance.now(), skipped: false, onBack };
    canvas.onclick = () => { state.skipped = true; };
    cancelAnimationFrame(raf);
    loop();
  }

  const PH = { cardIn: 400, scan: 1700, bars: 2600, radar: 3400, stamp: 3800 };
  const BAR_ROWS = [
    { key: 'atk', y: 475 }, { key: 'def', y: 540 }, { key: 'spd', y: 605 },
    { key: 'skl', y: 670 }, { key: 'lck', y: 735 },
  ];

  function loop() {
    if (!state) return;
    const t = state.skipped ? 99999 : performance.now() - state.t0;
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  function draw(t) {
    const { ctx, avatar, f } = state;
    const E = ELEMENTS[f.element];

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#131622');
    g.addColorStop(1, '#1b2033');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 卡片滑入
    const cardIn = Math.min(t / PH.cardIn, 1);
    ctx.save();
    ctx.translate(0, (1 - easeOut(cardIn)) * 60);
    ctx.globalAlpha = cardIn;

    // 标题
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = '900 52px -apple-system, PingFang SC, sans-serif';
    ctx.fillText('— 头像鉴定报告 —', W / 2, 105);

    // 头像框
    const ax = W / 2, ay = 260, as = 220;
    drawAvatarFrame(ctx, avatar, ax, ay, as, E.color, 1);
    // 元素徽章
    ctx.beginPath();
    ctx.arc(ax + as / 2 + 6, ay + as / 2 + 6, 42, 0, Math.PI * 2);
    ctx.fillStyle = E.color;
    ctx.fill();
    ctx.font = '38px serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(E.emoji, ax + as / 2 + 6, ay + as / 2 + 20);
    // 五行文字
    ctx.font = '900 40px -apple-system, PingFang SC, sans-serif';
    ctx.fillStyle = E.color;
    const elText = f.element === 'thunder' ? '⚡ 隐藏属性 · 雷' : (f.element === 'chaos' ? '🌀 隐藏属性 · 混沌' : `五行 · ${E.name}`);
    ctx.fillText(elText, W / 2, 400);

    // 扫描动画
    if (t > PH.cardIn && t < PH.scan) {
      const p = (t - PH.cardIn) / (PH.scan - PH.cardIn);
      const sy = ay - as / 2 - 4 + p * (as + 8);
      ctx.save();
      ctx.beginPath();
      ctx.rect(ax - as / 2, ay - as / 2, as, as);
      ctx.clip();
      ctx.fillStyle = 'rgba(120,200,255,0.18)';
      ctx.fillRect(ax - as / 2, sy - 26, as, 26);
      ctx.fillStyle = 'rgba(160,230,255,0.9)';
      ctx.fillRect(ax - as / 2, sy, as, 3);
      ctx.restore();
      ctx.strokeStyle = 'rgba(120,200,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(ax - as / 2, sy - 26, as, 26);
    }

    // 属性条
    if (t > PH.bars - 500) {
      for (const row of BAR_ROWS) {
        const idx = BAR_ROWS.indexOf(row);
        const startT = PH.bars - 500 + idx * 120;
        const p = clamp01((t - startT) / 500);
        if (p <= 0) continue;
        const meta = STAT_META[row.key];
        const val = f.stats[row.key];
        // 名称
        ctx.textAlign = 'left';
        ctx.font = '900 30px -apple-system, PingFang SC, sans-serif';
        ctx.fillStyle = '#e8e6df';
        ctx.fillText(meta.name, 110, row.y + 8);
        ctx.font = '24px -apple-system, PingFang SC, sans-serif';
        ctx.fillStyle = 'rgba(232,230,223,0.45)';
        ctx.fillText(meta.desc, 180, row.y + 8);
        // 轨道
        const bx = 330, bw = 250;
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        roundRect(ctx, bx, row.y - 14, bw, 28, 14);
        ctx.fill();
        // 填充
        ctx.fillStyle = meta.color;
        roundRect(ctx, bx, row.y - 14, Math.max(28 * p, bw * (val / 100) * easeOut(p), 28), 28, 14);
        ctx.fill();
        // 数值
        ctx.textAlign = 'right';
        ctx.font = '900 30px -apple-system, PingFang SC, sans-serif';
        ctx.fillStyle = meta.color;
        ctx.fillText(String(Math.round(val * easeOut(p))), 640, row.y + 8);
      }
    }

    // 雷达图
    if (t > PH.bars) {
      const p = easeOut(clamp01((t - PH.bars) / (PH.radar - PH.bars)));
      drawRadar(ctx, W / 2, 955, 135, f, p);
    }

    // 战斗力
    if (t > PH.radar) {
      const p = easeOut(clamp01((t - PH.radar) / 700));
      ctx.textAlign = 'center';
      ctx.font = '900 34px -apple-system, PingFang SC, sans-serif';
      ctx.fillStyle = 'rgba(232,230,223,0.6)';
      ctx.fillText('战 斗 力', W / 2, 1150);
      ctx.font = '900 96px -apple-system, PingFang SC, sans-serif';
      ctx.fillStyle = '#ffd76a';
      ctx.shadowColor = 'rgba(255,215,106,0.5)';
      ctx.shadowBlur = 24;
      ctx.fillText(String(Math.round(f.power * p)).padStart(4, '0'), W / 2, 1250);
      ctx.shadowBlur = 0;
    }

    // 称号盖章
    if (t > PH.stamp) {
      const p = clamp01((t - PH.stamp) / 320);
      const s = 1.6 - 0.6 * easeOut(p);
      ctx.save();
      ctx.translate(W / 2, 1320);
      ctx.scale(s, s);
      ctx.rotate(-0.04);
      ctx.globalAlpha = Math.min(p * 1.4, 1);
      ctx.font = '900 48px -apple-system, PingFang SC, sans-serif';
      ctx.strokeStyle = '#ff5a3c';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#ff5a3c';
      const txt = `称号「${f.title}」`;
      ctx.strokeRect(-ctx.measureText(txt).width / 2 - 22, -40, ctx.measureText(txt).width + 44, 60);
      ctx.fillText(txt, 0, 6);
      ctx.restore();
    }

    ctx.restore();

    // 跳过提示
    if (t < PH.stamp && !state.skipped) {
      ctx.textAlign = 'right';
      ctx.font = '24px -apple-system, PingFang SC, sans-serif';
      ctx.fillStyle = 'rgba(232,230,223,0.35)';
      ctx.fillText('点击跳过 ▸', W - 30, 60);
    }
    if (t >= PH.stamp) {
      if (!state.ended) {
        state.ended = true;
        if (state.onBack) setTimeout(state.onBack, 500);
      }
      ctx.textAlign = 'center';
      ctx.font = '26px -apple-system, PingFang SC, sans-serif';
      ctx.fillStyle = 'rgba(232,230,223,0.5)';
      ctx.fillText('▾', W / 2, H - 18);
    }
  }

  function drawRadar(ctx, cx, cy, r, f, p) {
    const keys = STAT_KEYS;
    const n = keys.length;
    // 网格
    for (let ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const ang = -Math.PI / 2 + (i % n) * (Math.PI * 2 / n);
        const rr = (r * ring) / 3;
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + i * (Math.PI * 2 / n);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      ctx.stroke();
      // 标签
      const lx = cx + Math.cos(ang) * (r + 42), ly = cy + Math.sin(ang) * (r + 42);
      ctx.textAlign = 'center';
      ctx.font = '26px -apple-system, PingFang SC, sans-serif';
      ctx.fillStyle = STAT_META[keys[i]].color;
      ctx.fillText(STAT_META[keys[i]].name, lx, ly + 9);
    }
    // 数据多边形
    const E = ELEMENTS[f.element];
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const k = keys[i % n];
      const ang = -Math.PI / 2 + (i % n) * (Math.PI * 2 / n);
      const rr = r * (f.stats[k] / 100) * p;
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.fillStyle = hexA(E.color, 0.30);
    ctx.fill();
    ctx.strokeStyle = E.color;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // ---- 共用绘制工具 ----
  function drawAvatarFrame(ctx, avatar, cx, cy, size, glowColor, scale = 1) {
    const s = size * scale;
    ctx.save();
    ctx.shadowColor = hexA(glowColor, 0.7);
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#0d0f16';
    roundRect(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.22);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (avatar) {
      ctx.save();
      roundRect(ctx, cx - s / 2 + 6, cy - s / 2 + 6, s - 12, s - 12, s * 0.18);
      ctx.clip();
      const draw = Math.max(avatar.width, avatar.height);
      ctx.drawImage(avatar, cx - draw / 2, cy - draw / 2, draw, draw);
      ctx.restore();
    }
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 5;
    roundRect(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.22);
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  return { show, drawAvatarFrame, roundRect, easeOut, clamp01, hexA };
})();
