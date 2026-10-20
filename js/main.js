// ============ 主流程（H5 适配层）：上传/随机/BOSS → 鉴定 → 开战 → 战报 ============

const App = (() => {
  const BOSSES = [
    { name: '灰烬领主', seed: 101, elem: 'fire' },
    { name: '磐岩壁垒', seed: 202, elem: 'earth' },
    { name: '疾风之影', seed: 303, elem: 'wood' },
  ];
  const PALETTES = {
    fire: ['#ff5a3c', '#ff9d3c', '#ffd76a', '#8a2a1a'],
    metal: ['#ffd76a', '#fff3c9', '#e8c56a', '#b8a05a'],
    wood: ['#58d158', '#9aff9a', '#1a6a2a', '#d4ff9a'],
    water: ['#4aa8ff', '#8ad0ff', '#1a4a8a', '#d0ecff'],
    earth: ['#c9a06a', '#e8cba0', '#6a4a2a', '#a07850'],
    thunder: ['#b96aff', '#e0c0ff', '#6a3cff', '#3a1a6a'],
    chaos: ['#a8b2c1', '#dfe6f0', '#7a8698', '#3a4050'],
  };

  const slots = {
    A: { avatar: null, feature: null },
    B: { avatar: null, feature: null },
  };
  let lastSim = null;

  // ---------- 头像工具 ----------
  function normalizeToCanvas(img) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
    return cv;
  }

  function toDataURL(cv) {
    const small = document.createElement('canvas');
    small.width = 128; small.height = 128;
    small.getContext('2d').drawImage(cv, 0, 0, 128, 128);
    return small.toDataURL('image/jpeg', 0.82);
  }

  function makeRandomAvatar(seed, forceElem) {
    const rng = seed != null ? mulberry32(seed) : mulberry32((Math.random() * 2 ** 31) | 0);
    const elemKeys = ['fire', 'metal', 'wood', 'water', 'earth', 'thunder'];
    const elem = forceElem || elemKeys[(rng() * elemKeys.length) | 0];
    const pal = PALETTES[elem];
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext('2d');
    // 背景渐变
    const ang = rng() * Math.PI;
    const g = ctx.createLinearGradient(128 + Math.cos(ang) * 128, 128 + Math.sin(ang) * 128, 128 - Math.cos(ang) * 128, 128 - Math.sin(ang) * 128);
    g.addColorStop(0, pal[(rng() * 2) | 0]);
    g.addColorStop(1, pal[3]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    // 色块
    const blobs = 6 + ((rng() * 10) | 0);
    for (let i = 0; i < blobs; i++) {
      ctx.globalAlpha = 0.35 + rng() * 0.5;
      ctx.fillStyle = pal[(rng() * pal.length) | 0];
      if (rng() < 0.7) {
        ctx.beginPath();
        ctx.arc(rng() * 256, rng() * 256, 20 + rng() * 80, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(rng() * 256, rng() * 256);
        ctx.rotate(rng() * Math.PI);
        ctx.fillRect(-70, -14, 140, 28);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    // 高频细节点
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
      ctx.fillRect(rng() * 256, rng() * 256, 2 + rng() * 3, 2 + rng() * 3);
    }
    return cv;
  }

  // ---------- 槽位 ----------
  // source 必须是原始图片(照片原图/生成的画布): 分析只做一次, 结果与 PNG 头像一起持久化,
  // 恢复时直接读结果不再重算 —— 若每次重存 JPEG 再重分析, 有损压缩的代际漂移会让战力每次都变
  function setSlot(slot, source, opts = {}) {
    const avatar = normalizeToCanvas(source);
    const feature = AvatarAnalyzer.analyze(source);
    const imgData = avatar.toDataURL('image/png');
    slots[slot] = { avatar, feature, imgData };
    try {
      localStorage.setItem('ab_slot' + slot, JSON.stringify({ img: imgData, feature }));
    } catch (e) { /* 空间不足忽略 */ }
    if (!opts.silent) showAppraisal(slot);
    refreshHome();
  }

  function refreshHome() {
    for (const slot of ['A', 'B']) {
      const el = document.getElementById('slot' + slot);
      const s = slots[slot];
      const img = el.querySelector('img');
      const info = el.querySelector('.slot-info');
      if (s) {
        img.src = s.imgData || toDataURL(s.avatar);
        img.style.display = 'block';
        el.querySelector('.slot-empty').style.display = 'none';
        const E = ELEMENTS[s.feature.element];
        info.innerHTML = `<b style="color:${E.color}">${E.emoji}${E.name}·${s.feature.title}</b><span>战力 ${s.feature.power}</span>`;
      } else {
        img.style.display = 'none';
        el.querySelector('.slot-empty').style.display = 'flex';
        info.innerHTML = '<span style="opacity:.4">等待头像…</span>';
      }
    }
    document.getElementById('fightBtn').disabled = !(slots.A.feature && slots.B.feature);
  }

  // ---------- 鉴定 ----------
  function showAppraisal(slot) {
    switchScreen('scr-appraise');
    const s = slots[slot];
    Appraisal.show(document.getElementById('apCanvas'), s.avatar, s.feature, () => {
      // 落版后显示返回按钮
    });
  }

  // ---------- 战斗 ----------
  function startBattle() {
    if (!(slots.A.feature && slots.B.feature)) return;
    lastSim = BattleSim.simulate(slots.A.feature, slots.B.feature);
    switchScreen('scr-battle');
    document.getElementById('resultOverlay').style.display = 'none';
    BattleScene.play(
      document.getElementById('btCanvas'),
      {
        avA: slots.A.avatar, avB: slots.B.avatar,
        fa: slots.A.feature, fb: slots.B.feature, sim: lastSim,
      },
      showResult
    );
  }

  function showResult() {
    const sim = lastSim;
    const win = sim.winner;
    const wf = win === 'A' ? slots.A.feature : slots.B.feature;
    const ov = document.getElementById('resultOverlay');
    document.getElementById('resultTitle').innerHTML = win === 'A'
      ? '🏆 我方获胜!' : '💀 我方落败…';
    document.getElementById('resultSub').textContent =
      `「${wf.title}」经过 ${sim.rounds} 回合激战称霸战场`;
    const row = (label, a, b) => `<tr><td>${a}</td><td>${label}</td><td>${b}</td></tr>`;
    document.getElementById('resultStats').innerHTML =
      row('总输出', sim.A.totDmg, sim.B.totDmg) +
      row('最高一击', sim.A.maxHit, sim.B.maxHit) +
      row('暴击次数', sim.A.crits, sim.B.crits) +
      row('闪避次数', sim.A.dodges, sim.B.dodges) +
      row('技能释放', sim.A.skills, sim.B.skills);
    ov.style.display = 'flex';
  }

  function copyReport() {
    if (!lastSim) return;
    const fa = slots.A.feature, fb = slots.B.feature;
    const Ea = ELEMENTS[fa.element], Eb = ELEMENTS[fb.element];
    const winF = lastSim.winner === 'A' ? fa : fb;
    const text =
      `⚔️ 头像大乱斗 ⚔️\n` +
      `我方【${fa.title}·${Ea.name}】战力 ${fa.power}\n` +
      `敌方【${fb.title}·${Eb.name}】战力 ${fb.power}\n` +
      `${lastSim.rounds} 回合激战后，【${winF.title}】获胜！\n` +
      `你的头像能打几分？来鉴定一下！`;
    const done = () => toast('战报已复制，去粘贴给好友吧');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动截图分享'); }
    document.body.removeChild(ta);
  }

  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- 屏幕切换 ----------
  function switchScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id !== 'scr-battle') BattleScene.stop();
  }

  // ---------- 初始化 ----------
  function boot() {
    // 文件上传
    for (const slot of ['A', 'B']) {
      const input = document.getElementById('file' + slot);
      input.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { setSlot(slot, img); URL.revokeObjectURL(url); };
        img.onerror = () => toast('图片读取失败，换一张试试');
        img.src = url;
        input.value = '';
      });
      document.getElementById('rand' + slot).addEventListener('click', () => {
        setSlot(slot, makeRandomAvatar());
      });
    }
    // BOSS
    const bossRow = document.getElementById('bossRow');
    for (const b of BOSSES) {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = `${ELEMENTS[b.elem].emoji} ${b.name}`;
      btn.onclick = () => {
        const av = makeRandomAvatar(b.seed, b.elem);
        setSlot('B', av, { silent: true });
        toast(`敌方已就位：${b.name}！`);
      };
      bossRow.appendChild(btn);
    }
    // 按钮
    document.getElementById('fightBtn').addEventListener('click', startBattle);
    document.getElementById('apBack').addEventListener('click', () => switchScreen('scr-home'));
    document.getElementById('speedBtn').addEventListener('click', (e) => {
      const v = e.target.dataset.v === '1' ? 2 : 1;
      e.target.dataset.v = v;
      e.target.textContent = v === 1 ? '▶ 加速' : '▶▶ 超速';
      BattleScene.setSpeed(v);
    });
    document.getElementById('btnReplay').addEventListener('click', startBattle);
    document.getElementById('btnHome').addEventListener('click', () => switchScreen('scr-home'));
    document.getElementById('btnCopy').addEventListener('click', copyReport);

    // 恢复上次头像: 新格式 {img, feature} 直接读结果; 旧格式(纯dataURL)迁移一次后稳定
    for (const slot of ['A', 'B']) {
      const saved = localStorage.getItem('ab_slot' + slot);
      if (!saved) continue;
      const img = new Image();
      let feature = null;
      if (saved.startsWith('{')) {
        try {
          const d = JSON.parse(saved);
          feature = d.feature;
          img.src = d.img;
        } catch (e) { continue; }
      } else {
        img.src = saved;
      }
      img.onload = () => {
        if (feature) {
          slots[slot] = { avatar: normalizeToCanvas(img), feature, imgData: img.src };
          refreshHome();
        } else {
          setSlot(slot, img, { silent: true });
        }
      };
    }
    refreshHome();
  }

  return { boot };
})();

window.addEventListener('DOMContentLoaded', App.boot);
