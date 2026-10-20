// ============ 头像分析器：图像像素特征 → 五维属性 + 五行（平台无关） ============
// 接受 HTMLImageElement 或 HTMLCanvasElement，返回确定性结果（同图同果）

const AvatarAnalyzer = (() => {
  const S = 64; // 降采样尺寸

  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h, s, l };
  }

  function bucketOf(h, s) {
    if (s < 0.10) return 'gray';
    if (h >= 255 && h < 320 && s > 0.50) return 'thunder';
    if (h >= 340 || h < 25) return 'fire';
    if (h >= 25 && h < 40) return 'earth';
    if (h >= 40 && h < 70) return 'metal';
    if (h >= 70 && h < 170) return 'wood';
    if (h >= 170 && h < 255) return 'water';
    if (h >= 320 && h < 340) return s > 0.5 ? 'fire' : 'water';
    return 'gray';
  }

  // 按原图尺寸取像素后手动均值降采样 —— drawImage 缩放算法因浏览器/设备而异,
  // 直接用它降采样会让同一张照片在不同手机上算出不同战力
  function downsample(source) {
    const sw = source.width, sh = source.height;
    const cv = document.createElement('canvas');
    cv.width = sw; cv.height = sh;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0); // 1:1 绘制, 不缩放
    const full = ctx.getImageData(0, 0, sw, sh).data;
    // 中心方形裁剪区(与展示用 normalizeToCanvas 的裁剪一致)
    const side = Math.min(sw, sh);
    const ox = (sw - side) / 2, oy = (sh - side) / 2;
    const data = new Uint8ClampedArray(S * S * 4);
    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        const x0 = ox + Math.floor(tx * side / S);
        const x1 = Math.max(x0 + 1, ox + Math.floor((tx + 1) * side / S));
        const y0 = oy + Math.floor(ty * side / S);
        const y1 = Math.max(y0 + 1, oy + Math.floor((ty + 1) * side / S));
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * sw + x) * 4;
            r += full[i]; g += full[i + 1]; b += full[i + 2]; n++;
          }
        }
        const o = (ty * S + tx) * 4;
        data[o] = r / n; data[o + 1] = g / n; data[o + 2] = b / n; data[o + 3] = 255;
      }
    }
    return data;
  }

  function analyze(source) {
    const data = downsample(source);
    const total = S * S;
    const lum = new Float32Array(total);
    const buckets = { fire: 0, metal: 0, wood: 0, water: 0, earth: 0, thunder: 0, gray: 0 };
    const hueBins = new Array(12).fill(0);
    let satSum = 0, dark = 0, hash = 0x811c9dc5;

    for (let i = 0; i < total; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      lum[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const { h, s, l } = rgb2hsl(r, g, b);
      satSum += s;
      if (l < 0.25) dark++;
      buckets[bucketOf(h, s)]++;
      if (s > 0.15) hueBins[Math.floor(h / 30) % 12]++;
      if (i % 3 === 0) {
        hash ^= (r + g * 3 + b * 7);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
    }

    // 对称性：左右镜像差异越小防御越高
    let symDiff = 0;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S / 2; x++) {
        symDiff += Math.abs(lum[y * S + x] - lum[y * S + (S - 1 - x)]);
      }
    }
    const symmetry = 1 - Math.min((symDiff / (total / 2)) * 2.5, 1);

    // 边缘密度：细节越多速度越快
    let grad = 0;
    for (let y = 0; y < S - 1; y++) {
      for (let x = 0; x < S - 1; x++) {
        const i = y * S + x;
        grad += Math.abs(lum[i] - lum[i + 1]) + Math.abs(lum[i] - lum[i + S]);
      }
    }
    const edge = grad / ((S - 1) * (S - 1) * 2);

    // 色彩多样性：显著色相桶数量
    const diverse = hueBins.filter((c) => c / total > 0.04).length;

    // 元素判定
    const share = (k) => buckets[k] / total;
    let element = ['fire', 'metal', 'wood', 'water', 'earth'].reduce((a, b) => (buckets[b] > buckets[a] ? b : a));
    if (share('thunder') > 0.16) element = 'thunder';
    else if (share('gray') > 0.78) element = 'chaos';

    const meanSat = satSum / total;
    const darkRatio = dark / total;

    let stats = {
      atk: clampStat(12 + meanSat * 85 + share('fire') * 25),
      def: clampStat(14 + symmetry * 62 + darkRatio * 22),
      spd: clampStat(12 + edge * 520),
      skl: clampStat(8 + diverse * 11),
      lck: 10 + (hash % 91),
    };
    if (element === 'chaos') {
      // 混沌彩蛋：黑白头像全属性 +3
      stats = { atk: stats.atk + 3, def: stats.def + 3, spd: stats.spd + 3, skl: stats.skl + 3, lck: stats.lck + 3 };
    }

    const power = Math.round(
      (stats.atk * 3 + stats.def * 2.5 + stats.spd * 2 + stats.skl * 1.5 + stats.lck * 2) * 9 + 100
    );

    const feature = {
      element, stats, power, hash,
      title: titleFor({ element, stats }),
    };
    return feature;
  }

  return { analyze };
})();
