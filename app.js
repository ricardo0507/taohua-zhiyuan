/* ==========================================================================
   桃花之源 · 交互与本地数据
   纯原生 JavaScript，数据只存放在浏览器 localStorage
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'taohua:posts';
  var MAX_LEN = 280;

  /** 内存中的数据源；localStorage 不可用时等价于临时存储 */
  var posts = [];
  var storageAvailable = true;

  /* ---------- DOM ---------- */
  var form = document.getElementById('composer-form');
  var input = document.getElementById('composer-input');
  var submitBtn = document.getElementById('submit-btn');
  var countNum = document.getElementById('count-num');
  var countWrap = document.getElementById('composer-count');
  var noticeEl = document.getElementById('notice');
  var listEl = document.getElementById('timeline-list');
  var totalEl = document.getElementById('post-total');
  var emptyEl = document.getElementById('empty-state');

  /* ---------- 存储层 ---------- */
  function detectStorage() {
    try {
      var probe = '__taohua_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  }

  function loadPosts() {
    if (!storageAvailable) return [];

    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      // 过滤掉结构不完整的脏数据
      return parsed.filter(function (item) {
        return item && typeof item.content === 'string' && item.content.length > 0;
      }).map(function (item) {
        return {
          id: String(item.id || createId()),
          content: item.content,
          createdAt: Number(item.createdAt) || Date.now()
        };
      });
    } catch (err) {
      return [];
    }
  }

  function savePosts() {
    if (!storageAvailable) return false;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      return true;
    } catch (err) {
      storageAvailable = false;
      showNotice('本地存储写入失败，内容仅在本次打开期间有效', 'error');
      return false;
    }
  }

  /* ---------- 工具 ---------- */
  function createId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (err) { /* 忽略，走回退方案 */ }

    return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /** 相对时间：7 天内用「刚刚 / x 分钟前」，更早显示日期 */
  function formatTime(ts) {
    var now = Date.now();
    var diff = now - ts;

    if (diff < 0) diff = 0;

    var minute = 60 * 1000;
    var hour = 60 * minute;
    var day = 24 * hour;

    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + ' 分钟前';
    if (diff < day) return Math.floor(diff / hour) + ' 小时前';
    if (diff < 7 * day) return Math.floor(diff / day) + ' 天前';

    var d = new Date(ts);
    var sameYear = d.getFullYear() === new Date().getFullYear();
    var dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

    return sameYear
      ? pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
      : dateStr;
  }

  var noticeTimer = null;

  function showNotice(text, type) {
    if (!noticeEl) return;

    noticeEl.textContent = text || '';
    noticeEl.className = 'notice' + (text ? ' is-visible' : '') + (type ? ' is-' + type : '');

    if (noticeTimer) window.clearTimeout(noticeTimer);
    if (text) {
      noticeTimer = window.setTimeout(function () {
        noticeEl.className = 'notice';
        noticeEl.textContent = '';
      }, 2600);
    }
  }

  /* ---------- 渲染层 ---------- */
  function buildPostItem(post, index) {
    var li = document.createElement('li');
    li.className = 'post';
    li.style.setProperty('--i', String(Math.min(index, 12)));
    li.dataset.id = post.id;

    var content = document.createElement('p');
    content.className = 'post__content';
    // 使用 textContent，天然防止 HTML 注入
    content.textContent = post.content;

    var foot = document.createElement('div');
    foot.className = 'post__foot';

    var dot = document.createElement('span');
    dot.className = 'post__dot';

    var time = document.createElement('time');
    time.className = 'post__time';
    time.dateTime = new Date(post.createdAt).toISOString();
    time.textContent = formatTime(post.createdAt);
    time.title = new Date(post.createdAt).toLocaleString('zh-CN');

    foot.appendChild(dot);
    foot.appendChild(time);

    li.appendChild(content);
    li.appendChild(foot);

    return li;
  }

  function render(freshId) {
    listEl.textContent = '';

    var fragment = document.createDocumentFragment();

    posts.forEach(function (post, index) {
      var item = buildPostItem(post, index);
      if (freshId && post.id === freshId) {
        item.classList.add('post--fresh');
      }
      fragment.appendChild(item);
    });

    listEl.appendChild(fragment);

    var count = posts.length;
    totalEl.textContent = count > 0 ? '共 ' + count + ' 条' : '共 0 条';
    emptyEl.hidden = count > 0;
  }

  /* ---------- 交互层 ---------- */
  function currentLength() {
    return input.value.trim().length;
  }

  /** 输入框随内容自动增高，内容较少时交回 CSS 控制 */
  function autoGrow() {
    input.style.height = 'auto';
    var need = input.scrollHeight;
    input.style.height = need <= 88 ? '' : Math.min(need, 240) + 'px';
  }

  function syncComposer() {
    var len = currentLength();
    var rawLen = input.value.length;

    countNum.textContent = String(rawLen);
    countWrap.classList.toggle('is-warn', rawLen >= MAX_LEN);

    submitBtn.disabled = len === 0;
    autoGrow();
  }

  function handleSubmit(event) {
    event.preventDefault();

    var text = input.value.trim();

    if (!text) {
      showNotice('先写点什么，再让桃花开花', 'error');
      input.focus();
      return;
    }

    if (text.length > MAX_LEN) {
      showNotice('内容超过 ' + MAX_LEN + ' 字了', 'error');
      return;
    }

    var post = {
      id: createId(),
      content: text,
      createdAt: Date.now()
    };

    posts.unshift(post);

    var persisted = savePosts();
    render(post.id);

    input.value = '';
    syncComposer();
    input.focus();

    if (persisted) {
      showNotice('已发布，只保存在这台设备的浏览器里', 'ok');
    } else if (storageAvailable) {
      showNotice('已发布，但本地存储不可用，刷新后会丢失', 'error');
    }
  }

  function refreshTimes() {
    // 每分钟刷新一次相对时间，仅更新文本，不重建列表
    var times = listEl.querySelectorAll('time.post__time');
    if (times.length !== posts.length) return;

    for (var i = 0; i < times.length; i += 1) {
      var post = posts[i];
      if (!post) continue;
      var next = formatTime(post.createdAt);
      if (times[i].textContent !== next) {
        times[i].textContent = next;
      }
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    storageAvailable = detectStorage();
    posts = loadPosts();

    render();
    syncComposer();

    if (!storageAvailable) {
      showNotice('当前浏览器无法使用本地存储，内容刷新后会丢失', 'error');
    }

    input.addEventListener('input', syncComposer);
    form.addEventListener('submit', handleSubmit);

    window.setInterval(refreshTimes, 60 * 1000);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refreshTimes();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
