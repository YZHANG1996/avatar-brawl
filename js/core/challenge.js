// ============ 好友挑战编解码（平台无关） ============
// 挑战书 = 对方的小图头像 + 鉴定结果, 全部编码进 URL 的 #fragment
// (fragment 不会被发往服务器, 302 重定向后仍由浏览器保留 —— 兼容 EdgeOne 的 token 跳转)

const Challenge = (() => {

  function utf8ToB64(str) {
    return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
  }
  function binToUtf8(bin) {
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  function toB64Url(s) { return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function fromB64Url(s) { return atob(s.replace(/-/g, '+').replace(/_/g, '/')); }

  // 把头像压到极小: 56px JPEG, 挑战链接里只放得下这个量级
  function tinyAvatar(source, size, quality) {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const side = Math.min(source.width, source.height);
    cv.getContext('2d').drawImage(
      source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, size, size
    );
    return cv.toDataURL('image/jpeg', quality);
  }

  // 返回 base64url 负载; 头像放不下时逐级降质, 实在不行只发数值(对方会看到元素化身)
  function encode(feature, avatarSource) {
    const compact = { v: 1, e: feature.element, s: [feature.stats.atk, feature.stats.def, feature.stats.spd, feature.stats.skl, feature.stats.lck], p: feature.power, h: feature.hash, t: feature.title };
    const attempts = [
      () => ({ ...compact, a: tinyAvatar(avatarSource, 56, 0.45) }),
      () => ({ ...compact, a: tinyAvatar(avatarSource, 48, 0.4) }),
      () => ({ ...compact, a: tinyAvatar(avatarSource, 40, 0.35) }),
      () => ({ ...compact, a: null }),
    ];
    for (const make of attempts) {
      const payload = toB64Url(utf8ToB64(JSON.stringify(make())));
      // QR 码 byte 模式极限约 2953B, 留出域名等余量
      if (payload.length <= 2500) return payload;
    }
    return toB64Url(utf8ToB64(JSON.stringify({ ...compact, a: null })));
  }

  function decode(payload) {
    try {
      const d = JSON.parse(binToUtf8(fromB64Url(payload)));
      if (!d || !d.e || !d.s || d.s.length !== 5) return null;
      const feature = {
        element: d.e,
        stats: { atk: d.s[0], def: d.s[1], spd: d.s[2], skl: d.s[3], lck: d.s[4] },
        power: d.p, hash: d.h, title: d.t || '神秘挑战者',
      };
      return { feature, img: d.a || null };
    } catch (e) {
      return null;
    }
  }

  // EdgeOne 的访问 token 在 302 跳转后不会出现在 location.search 里,
  // 只能从 performance 记录的最初入口 URL 中抢救并缓存, 生成挑战链接时拼回去
  function getEntryQuery() {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.name) {
        const q = new URL(nav.name).search;
        if (q) {
          try { localStorage.setItem('ab_entryq', q); } catch (e) { /* 忽略 */ }
          return q;
        }
      }
    } catch (e) { /* 忽略 */ }
    try { return localStorage.getItem('ab_entryq') || ''; } catch (e) { return ''; }
  }

  // 基于当前页面生成挑战链接
  function buildUrl(payload) {
    let base = location.origin + location.pathname;
    const q = location.search || getEntryQuery();
    if (q) base += q;
    return base + '#c=' + payload;
  }

  // 读取当前页面携带的挑战书
  function readIncoming() {
    const m = location.hash.match(/[#&]c=([A-Za-z0-9\-_]+)/);
    if (!m) return null;
    return decode(m[1]);
  }

  return { encode, decode, buildUrl, readIncoming };
})();
