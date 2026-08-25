const articles = [
  {title:'慢一点，才能看见更多', category:'生活', date:'2025.01.06', minutes:'6 分钟阅读', excerpt:'在效率成为默认答案之后，重新练习把时间还给自己。'},
  {title:'给复杂问题画一张地图', category:'设计', date:'2024.12.22', minutes:'9 分钟阅读', excerpt:'当事情变得混乱，先别急着寻找答案，试着描述你正在面对的系统。'},
  {title:'工具应该为人让路', category:'技术', date:'2024.11.14', minutes:'7 分钟阅读', excerpt:'关于软件、自动化和那些不该被优化掉的人类瞬间。'},
  {title:'我的数字花园今年长什么样', category:'技术', date:'2024.10.28', minutes:'5 分钟阅读', excerpt:'把零散的笔记变成可以漫游的空间，知识因此开始拥有自己的天气。'},
  {title:'一张桌子的秩序', category:'生活', date:'2024.09.09', minutes:'4 分钟阅读', excerpt:'整理不是为了让生活看起来完美，而是为了知道下一步要去哪里。'},
  {title:'好的界面会慢慢消失', category:'设计', date:'2024.08.17', minutes:'8 分钟阅读', excerpt:'我们最终记住的不是按钮和颜色，而是事情顺利发生时的那一点轻盈。'}
];

const grid = document.querySelector('#articleGrid');
const searchInput = document.querySelector('#searchInput');
const articleCount = document.querySelector('#articleCount');
const emptyState = document.querySelector('#emptyState');
let activeFilter = '全部';

function renderArticles() {
  const query = searchInput.value.trim().toLowerCase();
  const sort = document.querySelector('#sortSelect').value;
  const visible = articles
    .filter(article => activeFilter === '全部' || article.category === activeFilter)
    .filter(article => `${article.title}${article.category}${article.excerpt}`.toLowerCase().includes(query))
    .sort((a, b) => sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

  articleCount.textContent = `${String(visible.length).padStart(2, '0')} 篇文章`;
  emptyState.hidden = visible.length > 0;
  grid.innerHTML = visible.map((article, index) => `
    <article class="article-card">
      <div class="article-index"><span>${String(index + 1).padStart(2, '0')}</span><span>${article.date}</span></div>
      <h3>${article.title}</h3>
      <p>${article.excerpt}</p>
      <div class="card-bottom"><span class="topic">${article.category} / ${article.minutes}</span><button class="bookmark" type="button" aria-label="收藏 ${article.title}" title="收藏文章" data-title="${article.title}">◇</button></div>
    </article>`).join('');
}

document.querySelectorAll('.filter-button').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.filter-button.active').classList.remove('active');
  button.classList.add('active');
  activeFilter = button.dataset.filter;
  renderArticles();
}));
searchInput.addEventListener('input', renderArticles);
document.querySelector('#sortSelect').addEventListener('change', renderArticles);

grid.addEventListener('click', event => {
  const bookmark = event.target.closest('.bookmark');
  if (!bookmark) return;
  const saved = bookmark.classList.toggle('saved');
  bookmark.textContent = saved ? '◆' : '◇';
  bookmark.setAttribute('aria-label', `${saved ? '取消收藏' : '收藏'} ${bookmark.dataset.title}`);
});

document.querySelectorAll('[data-read]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('#articles').scrollIntoView({behavior:'smooth'});
  searchInput.value = button.dataset.read;
  renderArticles();
}));

document.querySelector('#newsletterForm').addEventListener('submit', event => {
  event.preventDefault();
  document.querySelector('#formMessage').textContent = '已收到，下一封见。';
  event.currentTarget.reset();
});

document.querySelector('.menu-toggle').addEventListener('click', event => {
  const nav = document.querySelector('.main-nav');
  const isOpen = nav.classList.toggle('open');
  event.currentTarget.textContent = isOpen ? '×' : '☰';
  event.currentTarget.setAttribute('aria-label', isOpen ? '关闭菜单' : '打开菜单');
});

renderArticles();
