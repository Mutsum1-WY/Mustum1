'use strict';

/* ============================================================
   Rain Pages · 个人文章存储
   纯前端：localStorage 持久化，支持搜索、浏览与阅读文章。
   ============================================================ */

/* ---------------- 版本戳 ---------------- */

/* 当前版本号：升级时改成新版本号，并同步修改 index.html 里
   styles.css?v= 与 script.js?v= 的查询参数，浏览器即会重新下载资源。 */
const APP_VERSION = '1.0.1';
const VERSION_KEY = 'rainpages.version.v1';

try {
  const lastVersion = localStorage.getItem(VERSION_KEY);
  if (lastVersion && lastVersion !== APP_VERSION) {
    // 检测到版本更新：先记录新版本再刷新一次，确保页面加载最新资源
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    location.reload();
  } else {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
  }
} catch (e) { /* localStorage 不可用时忽略，不影响正常使用 */ }

/* ---------------- 常量与工具 ---------------- */

const STORE_KEY = 'rainpages.articles.v1';
const PREF_KEY = 'rainpages.prefs.v1';
/* 旧版存储键，用于数据迁移（改名后保留读取兼容，迁移完成后清除） */
const LEGACY_WIND_STORE_KEY = 'windpages.articles.v1';
const LEGACY_WIND_PREF_KEY = 'windpages.prefs.v1';
const LEGACY_STORE_KEY = 'inkwell.articles.v1';
const LEGACY_PREF_KEY = 'inkwell.prefs.v1';

const $ = (sel) => document.querySelector(sel);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pad2 = (n) => String(n).padStart(2, '0');

const fmtDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const fmtTime = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${fmtDate(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const wordCount = (text) => {
  const t = String(text || '');
  const cjk = (t.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = (t.match(/[a-zA-Z0-9]+/g) || []).length;
  return cjk + words;
};

const readMinutes = (wc) => Math.max(1, Math.round(wc / 400));

const fmtWords = (wc) => (wc >= 1000 ? (wc / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(wc));

const stripMd = (text) => String(text || '')
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/[#>*_`~\-\[\]()!]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/* ---------------- Markdown 渲染（轻量） ---------------- */

function inlineMd(text) {
  let t = esc(text);
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return t;
}

function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let i = 0;

  const flush = () => {
    if (para.length) {
      out.push(`<p>${para.map(inlineMd).join('<br>')}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块
    if (/^```/.test(line)) {
      flush();
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }

    // 空行
    if (/^\s*$/.test(line)) { flush(); i++; continue; }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // 分割线
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { flush(); out.push('<hr>'); i++; continue; }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      flush();
      const q = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${q.map(inlineMd).join('<br>')}</blockquote>`);
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(inlineMd(lines[i].replace(/^\s*[-*+]\s+/, '')));
        i++;
      }
      out.push(`<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`);
      continue;
    }

    // 有序列表
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(inlineMd(lines[i].replace(/^\s*\d+[.)]\s+/, '')));
        i++;
      }
      out.push(`<ol>${items.map((x) => `<li>${x}</li>`).join('')}</ol>`);
      continue;
    }

    para.push(line);
    i++;
  }
  flush();
  return out.join('\n');
}

/* ---------------- 数据层 ---------------- */

/* 首篇文章：对应磁盘存档 2026/For You/index.html，以网页跳转形式打开 */
const FIRST_ARTICLE_ID = '2026-01-01-first';
const FIRST_ARTICLE = {
  id: FIRST_ARTICLE_ID,
  title: 'For You',
  subtitle: '关于这个网站的一切，它的由来、建造过程以及作用',   // 卡片副标题
  category: '',
  tags: [],
  link: '2026/For%20You/index.html',   // 文章页地址（点击直接跳转）
  createdAt: '2026-08-26T00:00:00',
  updatedAt: '2026-08-26T00:00:00',
  content: '',
};

/* 随笔1：对应磁盘存档 2026/随笔1/index.html（内容后续补充，正文在页面内编辑） */
const ESSAY_1_ID = '2026-09-02-essay-1';
const ESSAY_1_ARTICLE = {
  id: ESSAY_1_ID,
  title: '随笔1',
  subtitle: '我在干什么',
  category: '',
  tags: [],
  link: '2026/%E9%9A%8F%E7%AC%941/index.html',   // 2026/随笔1/index.html（URL 编码）
  createdAt: '2026-09-02T00:00:00',
  updatedAt: '2026-09-02T00:00:00',
  content: '',
};

/* 内置文章（磁盘存档 + 网页跳转）：统一在此登记，刷新后自动出现在列表 */
const BUILTIN_ARTICLES = [FIRST_ARTICLE, ESSAY_1_ARTICLE];

function loadArticles() {
  let data = null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) data = parsed;
    }
  } catch (e) { /* 数据损坏时重建 */ }

  // 迁移：读取旧版存储键的数据（先「风文库」windpages.*，再「墨库」inkwell.*）
  if (!data) {
    try {
      const legacy = localStorage.getItem(LEGACY_WIND_STORE_KEY) || localStorage.getItem(LEGACY_STORE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) data = parsed;
      }
    } catch (e) { /* 忽略 */ }
  }

  if (!data) {
    data = [];
    persistArticles(data);
    return data;
  }

  // 删除自动创建的示例文章（seed-* 为旧版示例数据，不再生成）
  const withoutSeeds = data.filter((a) => !String(a.id || '').startsWith('seed-'));
  if (withoutSeeds.length !== data.length) data = withoutSeeds;

  // 内置文章：不存在则写入（一次性的，刷新不会重复）
  for (const builtin of BUILTIN_ARTICLES) {
    const existing = data.find((a) => a.id === builtin.id);
    if (!existing) {
      data.unshift({ ...builtin });
    } else {
      // 标题/跳转地址/日期/副标题同步：仅当仍是旧模板（或缺少字段、仍是模板日期）时更新，用户改过的不动
      if (existing.title === '第一篇文章' || !existing.link || !existing.subtitle || existing.subtitle === '内容待定' || existing.updatedAt === '2026-01-01T00:00:00') {
        existing.title = builtin.title;
        existing.subtitle = builtin.subtitle;
        existing.link = builtin.link;
        existing.createdAt = builtin.createdAt;
        existing.updatedAt = builtin.updatedAt;
      }
    }
  }

  persistArticles(data); // 写入新存储键

  // 彻底清除：旧版存储键（windpages.* / inkwell.*）不再保留
  try {
    localStorage.removeItem(LEGACY_WIND_STORE_KEY);
    localStorage.removeItem(LEGACY_WIND_PREF_KEY);
    localStorage.removeItem(LEGACY_STORE_KEY);
    localStorage.removeItem(LEGACY_PREF_KEY);
  } catch (e) { /* 忽略 */ }

  return data;
}

function persistArticles(list) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('保存失败：浏览器存储空间不足或不可用', e);
  }
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY) || localStorage.getItem(LEGACY_WIND_PREF_KEY) || localStorage.getItem(LEGACY_PREF_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function persistPrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* 忽略 */ }
}

/* ---------------- 状态 ---------------- */

let articles = loadArticles();
const prefs = loadPrefs();

let view = 'list';            // list | reader
let currentId = null;         // 阅读中的文章 id
let searchQuery = '';
let sortMode = prefs.sortMode || 'updated';

/* ---------------- DOM 引用 ---------------- */

const el = {
  viewList: $('#viewList'),
  viewReader: $('#viewReader'),
  listCount: $('#listCount'),
  articleGrid: $('#articleGrid'),
  emptyState: $('#emptyState'),
  emptyTitle: $('#emptyTitle'),
  emptyText: $('#emptyText'),
  clearFilterBtn: $('#clearFilterBtn'),
  searchInput: $('#searchInput'),
  sortSelect: $('#sortSelect'),
  readerTitle: $('#readerTitle'),
  readerCategory: $('#readerCategory'),
  readerDate: $('#readerDate'),
  readerWords: $('#readerWords'),
  readerTags: $('#readerTags'),
  readerContent: $('#readerContent'),
  readerFooter: $('#readerFooter'),
  heroWrap: $('#heroWrap'),
};

const topbarEl = document.querySelector('.topbar');

/* ---------------- 友链（顶栏下拉面板） ---------------- */

/* 友链清单：直接在这里增删改即可。
   name 站点名（必填）
   url  网址（必填）
   desc 一句话简介（可选） */
const FRIEND_LINKS = [
  { name: 'GitHub', url: 'https://github.com/Mutsum1-WY', desc: 'Mutsum1的github' },
  { name: 'LS的Blog', url: 'https://ls-hower.cc/', desc: 'LS的Blog' },
  { name: '你知道哈基米德原理吗', url: 'https://nam1dame-github-io.vercel.app/', desc: 'nam1dame的博客' },
  { name: 'AceChann', url: 'https://acechann.github.io/', desc: '艾斯的小窝' },
];

const linksWrapEl = $('#linksWrap');
const linksBtnEl = $('#linksBtn');
const linksPanelEl = $('#linksPanel');
const linksListEl = $('#linksList');
const linksCountEl = $('#linksCount');

function renderLinks() {
  linksCountEl.textContent = `${FRIEND_LINKS.length} 个站点`;
  linksListEl.innerHTML = FRIEND_LINKS.map((l) => `
    <a class="links-item" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="${esc(l.url)}">
      <span class="links-info">
        <span class="links-name">${esc(l.name)}</span>
        ${l.desc ? `<span class="links-desc">${esc(l.desc)}</span>` : ''}
      </span>
    </a>`).join('');
}

function setLinksOpen(open) {
  linksPanelEl.hidden = !open;
  linksBtnEl.setAttribute('aria-expanded', String(open));
}

linksBtnEl.addEventListener('click', () => setLinksOpen(linksPanelEl.hidden));

// 点击面板外部任意位置关闭
document.addEventListener('click', (e) => {
  if (!linksPanelEl.hidden && !linksWrapEl.contains(e.target)) setLinksOpen(false);
});

/* ---------------- 视图切换 ---------------- */

function setView(v) {
  view = v;
  el.viewList.hidden = v !== 'list';
  el.viewReader.hidden = v !== 'reader';
  el.heroWrap.hidden = v !== 'list';
  // 首页时顶栏不占布局位置（Hero 从页面顶端开始）；其他视图恢复正常文档流
  document.body.classList.toggle('topbar-fixed', v === 'list');
  if (v === 'list') renderList();
  if (v === 'reader') renderReader();
  window.scrollTo({ top: 0 });
  updateScrollUI();
}

/* ---------------- 滚动联动：Hero 收缩 + 顶栏渐进浮现 ---------------- */

function updateScrollUI() {
  const s = window.scrollY;

  if (view !== 'list') {
    // 非列表视图：顶栏始终完整显示
    topbarEl.style.setProperty('--tb-progress', 1);
    topbarEl.style.pointerEvents = '';
    return;
  }

  // Hero：向下滚动，高度同步收缩，内容淡出
  const hero = document.querySelector('.hero');
  const full = el.heroWrap.offsetHeight;   // 满屏高度（与 CSS 100dvh 一致）
  const h = Math.max(0, full - s);
  hero.style.height = h + 'px';
  hero.style.setProperty('--shrink', Math.min(1, s / full));

  // 顶栏：页面顶部完全消失，下滑 240px 内渐进浮现
  const reveal = 240;
  const p = Math.min(1, s / reveal);
  topbarEl.style.setProperty('--tb-progress', p);
  topbarEl.style.pointerEvents = p >= 1 ? '' : 'none';
}

window.addEventListener('scroll', updateScrollUI, { passive: true });
window.addEventListener('resize', updateScrollUI);

/* ---------------- 首页 Hero 副标题轮换 ---------------- */

/* 轮换文案列表：直接在这里增删改即可（之后补充正式文案）。
   只留一段时则不再轮换，固定显示该段。 */
const HERO_SUBTITLES = [
  '伤不是要你去忍耐的东西，痛是要说出来的。',
  '消失吧，群青。',
  '所谓的窄门，并不是只有被选中的人才能进入的门，而是要用自己的眼睛找出、抱着觉悟踏进去的门。',
];

const heroSubEl = document.querySelector('#heroSub');
let heroSubIndex = 0;
let heroSubBusy = false;

setInterval(() => {
  if (view !== 'list' || HERO_SUBTITLES.length < 2 || heroSubBusy) return;
  heroSubBusy = true;

  // 旧文案沉入水下
  heroSubEl.classList.add('hero-sink');
  setTimeout(() => {
    heroSubIndex = (heroSubIndex + 1) % HERO_SUBTITLES.length;
    heroSubEl.textContent = HERO_SUBTITLES[heroSubIndex];
    heroSubEl.classList.remove('hero-sink');
    void heroSubEl.offsetWidth;              // 强制重排，重新触发动画
    // 新文案从水底浮出水面
    heroSubEl.classList.add('hero-rise');
    setTimeout(() => {
      heroSubEl.classList.remove('hero-rise');
      heroSubBusy = false;
    }, 900);
  }, 380);
}, 6280); // 每段文案展示 5 秒 + 沉入 0.38s + 浮出 0.9s = 约 6.3s 一轮

/* ---------------- 列表视图 ---------------- */

function getVisibleArticles() {
  const query = searchQuery.toLowerCase();
  return articles
    .filter((a) => {
      if (query) {
        const hay = `${a.title} ${a.category} ${(a.tags || []).join(' ')} ${a.content}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'created') return b.createdAt.localeCompare(a.createdAt);
      if (sortMode === 'oldest') return a.createdAt.localeCompare(b.createdAt);
      if (sortMode === 'title') return a.title.localeCompare(b.title, 'zh');
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

function renderList() {
  const visible = getVisibleArticles();
  el.listCount.textContent = `${visible.length} / ${articles.length} 篇`;

  el.articleGrid.innerHTML = visible.map((a) => {
    const tags = (a.tags || []).slice(0, 4)
      .map((t) => `<span class="tag-chip">${esc(t)}</span>`).join('');
    const wc = wordCount(a.content);
    // 外链文章：点击直接跳转到独立页面；不显示链接文字
    const excerpt = a.link
      ? ''
      : esc(stripMd(a.content).slice(0, 96) || '（暂无正文）');
    return `
      <article class="article-row" data-open="${a.id}">
        <div class="row-main">
          <div class="row-top">
            ${a.category ? `<span class="chip">${esc(a.category)}</span>` : ''}
            <h3>${esc(a.title)}</h3>
          </div>
          ${a.subtitle ? `<p class="row-sub">${esc(a.subtitle)}</p>` : ''}
          ${excerpt ? `<p class="row-excerpt">${excerpt}</p>` : ''}
          ${tags ? `<div class="row-tags">${tags}</div>` : ''}
        </div>
        <div class="row-side">
          <div class="row-meta">
            <span>${fmtDate(a.updatedAt)}</span>
            <span>${a.link ? '网页文章' : `${fmtWords(wc)} 字 · ${readMinutes(wc)} 分钟`}</span>
          </div>
        </div>
      </article>`;
  }).join('');

  // 空状态
  const noArticles = articles.length === 0;
  const noMatch = visible.length === 0 && !noArticles;
  el.emptyState.hidden = !(noArticles || noMatch);
  if (noArticles) {
    el.emptyTitle.textContent = '还没有任何文章';
    el.emptyText.textContent = '文库暂时是空的。';
    el.clearFilterBtn.hidden = true;
  } else if (noMatch) {
    el.emptyTitle.textContent = '没有匹配的文章';
    el.emptyText.textContent = '试试更换关键词，或清除筛选条件。';
    el.clearFilterBtn.hidden = false;
  }
}

/* ---------------- 阅读视图 ---------------- */

function renderReader() {
  const a = articles.find((x) => x.id === currentId);
  if (!a) { setView('list'); return; }

  const wc = wordCount(a.content);
  el.readerTitle.textContent = a.title;
  el.readerCategory.textContent = a.category || '未分类';
  el.readerCategory.hidden = !a.category;
  el.readerDate.textContent = `创建于 ${fmtDate(a.createdAt)}`;
  el.readerWords.textContent = `${fmtWords(wc)} 字 · ${readMinutes(wc)} 分钟阅读`;
  el.readerTags.innerHTML = (a.tags || []).map((t) => `<span class="tag-chip">${esc(t)}</span>`).join('');
  el.readerContent.innerHTML = renderMarkdown(a.content);
  el.readerFooter.textContent = `最后更新：${fmtTime(a.updatedAt)}`;
  document.title = `${a.title} · Rain Pages`;
}

/* ---------------- 事件绑定 ---------------- */

// 顶栏
$('#homeBtn').addEventListener('click', () => {
  el.searchInput.value = '';
  searchQuery = '';
  setView('list');
});

// 首页展示区按钮
$('#heroBrowseBtn').addEventListener('click', () => {
  el.articleGrid.scrollIntoView({ behavior: 'smooth' });
});

el.searchInput.addEventListener('input', () => {
  searchQuery = el.searchInput.value.trim();
  if (view !== 'list') { setView('list'); return; }
  renderList();
});

el.sortSelect.value = sortMode;
el.sortSelect.addEventListener('change', () => {
  sortMode = el.sortSelect.value;
  prefs.sortMode = sortMode;
  persistPrefs();
  renderList();
});

// 列表
el.articleGrid.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (!open) return;
  const a = articles.find((x) => x.id === open.dataset.open);
  // 外链文章：直接跳转到独立文章页面
  if (a && a.link) {
    window.location.href = a.link;
    return;
  }
  currentId = open.dataset.open;
  setView('reader');
});

$('#clearFilterBtn').addEventListener('click', () => {
  el.searchInput.value = '';
  searchQuery = '';
  renderList();
});

// 页脚：回到顶部
$('#footerTopBtn').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// 阅读视图
$('#backBtn').addEventListener('click', () => { setView('list'); document.title = 'Rain Pages'; });

// 快捷键：Esc 优先关闭友链面板；阅读视图下再返回列表
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !linksPanelEl.hidden) {
    setLinksOpen(false);
    return;
  }
  if (e.key === 'Escape' && view === 'reader') {
    setView('list');
    document.title = 'Rain Pages';
  }
});

/* ---------------- 初始化 ---------------- */

// 页脚版本戳显示
const footerVersionEl = $('#footerVersion');
if (footerVersionEl) footerVersionEl.textContent = `v${APP_VERSION}`;

renderLinks();
renderList();
updateScrollUI();
