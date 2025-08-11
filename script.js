// McFATE - FATE计时器主脚本
(function() {
  'use strict';

  // DOM元素
  const elements = {
    themeToggle: document.getElementById('themeToggle'),
    eorzeaTime: document.getElementById('eorzeaTime'),
    weatherCountdown: document.getElementById('weatherCountdown'),
    fateList: document.getElementById('fateList'),
    currentStatus: document.getElementById('currentStatus')
  };

  // 应用状态
  let state = {
    theme: 'light',
    fateData: [],
    // 以  地图|名称|goal|idx|weather|time 为唯一标识，单目标标记
    completedGoals: new Set()
  };

  // 列表顺序缓存：在没有“开始/结束”状态变化前保持相对稳定
  let lastOrderIds = [];
  const lastStatusById = new Map(); // id -> hasActive

  function resetListOrderCache() {
    lastOrderIds = [];
    lastStatusById.clear();
  }

  // 艾欧泽亚时间常量（与McWeather一致）
  const EORZEA_HOUR_MS = 175000; // 1艾欧泽亚小时 = 175秒 = 175000毫秒
  const EORZEA_8_HOUR_MS = 8 * EORZEA_HOUR_MS; // 8艾欧泽亚小时
  const EORZEA_DAY_MS = 24 * EORZEA_HOUR_MS; // 1艾欧泽亚天
  const EORZEA_MINUTE_MS = EORZEA_HOUR_MS / 60; // 1艾欧泽亚分钟对应的现实毫秒

  // 天气系统常量（从McWeather继承）
  const WEATHER_DATA = {
    uldah: [{ name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 25 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 }],
    westernThanalan: [{ name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 25 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 }],
    centralThanalan: [{ name: 'dustStorms', chance: 15 }, { name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 }],
    easternThanalan: [{ name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 5 }, { name: 'showers', chance: 15 }],
    southernThanalan: [{ name: 'heatWaves', chance: 20 }, { name: 'clearSkies', chance: 40 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 10 }, { name: 'fog', chance: 10 }],
    northernThanalan: [{ name: 'clearSkies', chance: 5 }, { name: 'fairSkies', chance: 15 }, { name: 'clouds', chance: 30 }, { name: 'fog', chance: 50 }],
    gridania: [{ name: 'rain', chance: 20 }, { name: 'fog', chance: 10 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 15 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 15 }],
    centralShroud: [{ name: 'thunder', chance: 5 }, { name: 'rain', chance: 15 }, { name: 'fog', chance: 10 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 15 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 15 }],
    eastShroud: [{ name: 'thunder', chance: 5 }, { name: 'rain', chance: 15 }, { name: 'fog', chance: 10 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 15 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 15 }],
    southShroud: [{ name: 'fog', chance: 5 }, { name: 'thunderstorms', chance: 5 }, { name: 'thunder', chance: 15 }, { name: 'fog', chance: 5 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 30 }, { name: 'clearSkies', chance: 30 }],
    northShroud: [{ name: 'fog', chance: 5 }, { name: 'showers', chance: 5 }, { name: 'rain', chance: 15 }, { name: 'fog', chance: 5 }, { name: 'clouds', chance: 10 }, { name: 'fairSkies', chance: 30 }, { name: 'clearSkies', chance: 30 }],
    limsaLominsa: [{ name: 'clouds', chance: 20 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 30 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 10 }],
    middleLaNoscea: [{ name: 'clouds', chance: 20 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'wind', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 10 }],
    lowerLaNoscea: [{ name: 'clouds', chance: 20 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'wind', chance: 10 }, { name: 'fog', chance: 10 }, { name: 'rain', chance: 10 }],
    easternLaNoscea: [{ name: 'fog', chance: 5 }, { name: 'clearSkies', chance: 45 }, { name: 'fairSkies', chance: 30 }, { name: 'clouds', chance: 10 }, { name: 'rain', chance: 5 }, { name: 'showers', chance: 5 }],
    westernLaNoscea: [{ name: 'fog', chance: 10 }, { name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 20 }, { name: 'wind', chance: 10 }, { name: 'gales', chance: 10 }],
    upperLaNoscea: [{ name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 20 }, { name: 'fog', chance: 10 }, { name: 'thunder', chance: 10 }, { name: 'thunderstorms', chance: 10 }],
    outerLaNoscea: [{ name: 'clearSkies', chance: 30 }, { name: 'fairSkies', chance: 20 }, { name: 'clouds', chance: 20 }, { name: 'fog', chance: 15 }, { name: 'rain', chance: 15 }],
    coerthasCentralHighlands: [{ name: 'blizzard', chance: 20 }, { name: 'snow', chance: 40 }, { name: 'fairSkies', chance: 10 }, { name: 'clearSkies', chance: 5 }, { name: 'clouds', chance: 15 }, { name: 'fog', chance: 10 }],
    morDhona: [{ name: 'clouds', chance: 15 }, { name: 'fog', chance: 15 }, { name: 'gloom', chance: 30 }, { name: 'clearSkies', chance: 15 }, { name: 'fairSkies', chance: 25 }]
  };

  // 地图名称映射
  const MAP_NAMES = {
    '西萨纳兰': 'westernThanalan',
    '中萨纳兰': 'centralThanalan',
    '东萨纳兰': 'easternThanalan',
    '南萨纳兰': 'southernThanalan',
    '北萨纳兰': 'northernThanalan',
    '乌尔达哈': 'uldah',
    '黑衣森林中部林区': 'centralShroud',
    '黑衣森林东部林区': 'eastShroud',
    '黑衣森林南部林区': 'southShroud',
    '黑衣森林北部林区': 'northShroud',
    '格里达尼亚': 'gridania',
    '中拉诺西亚': 'middleLaNoscea',
    '拉诺西亚低地': 'lowerLaNoscea',
    '东拉诺西亚': 'easternLaNoscea',
    '西拉诺西亚': 'westernLaNoscea',
    '拉诺西亚高地': 'upperLaNoscea',
    '拉诺西亚外地': 'outerLaNoscea',
    '利姆萨·罗敏萨': 'limsaLominsa',
    '库尔札斯中央高地': 'coerthasCentralHighlands',
    '摩杜纳': 'morDhona'
  };

  // 天气名称映射
  const WEATHER_NAMES_CN = {
    clearSkies: '碧空',
    fairSkies: '晴朗',
    clouds: '阴云',
    fog: '薄雾',
    rain: '小雨',
    showers: '暴雨',
    wind: '微风',
    gales: '强风',
    thunder: '打雷',
    thunderstorms: '雷雨',
    snow: '小雪',
    blizzard: '暴雪',
    gloom: '妖雾',
    heatWaves: '热浪',
    dustStorms: '扬沙'
  };

  // 反向天气名称映射（中文到英文）
  const WEATHER_NAMES_EN = {};
  Object.keys(WEATHER_NAMES_CN).forEach(key => {
    WEATHER_NAMES_EN[WEATHER_NAMES_CN[key]] = key;
  });

  // 规则：天气集合中文合并显示
  function normalizeWeatherLabel(cn) {
    const s = String(cn || '').trim();
    if (!s) return '';
    // 小雨|雷雨|暴雨 → 雨天
    if (/(小雨\|雷雨\|暴雨)|(小雨\|暴雨\|雷雨)/.test(s)) return '雨天';
    // 碧空|晴朗 → 晴天
    if (/碧空\|晴朗|晴朗\|碧空/.test(s)) return '晴天';
    return s;
  }

  // HTML转义（弹窗列表安全输出）
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // 目标说明弹出层
  let currentGoalPopover = null;
  function hideGoalPopover() {
    if (currentGoalPopover) {
      currentGoalPopover.remove();
      currentGoalPopover = null;
      document.removeEventListener('click', onDocClickForPopover, true);
      window.removeEventListener('scroll', hideGoalPopover, true);
      window.removeEventListener('resize', hideGoalPopover, true);
    }
  }
  function onDocClickForPopover(e) {
    if (!currentGoalPopover) return;
    if (!currentGoalPopover.contains(e.target)) hideGoalPopover();
  }
  function showGoalPopover(anchorEl, fate) {
    hideGoalPopover();
    const pop = document.createElement('div');
    pop.className = 'goal-popover';
    const goalsText = String(fate.危命目标 || '').trim();
    const lines = goalsText ? goalsText.split(/\n+/).map(s => s.replace(/^\d+\./, '').trim()).filter(Boolean) : [];
    const listHtml = lines.length ? lines.map(l => `<li>${escapeHtml(l)}</li>`).join('') : '<li>No target requirements</li>';
    pop.innerHTML = `<div class="gp-title">${escapeHtml(fate.名称)} · 危命目标</div><ul class="gp-list">${listHtml}</ul>`;
    document.body.appendChild(pop);
    // 定位：元素下方
    const rect = anchorEl.getBoundingClientRect();
    const top = rect.bottom + 8;
    let left = rect.left;
    const maxLeft = window.innerWidth - pop.offsetWidth - 12;
    if (left > maxLeft) left = Math.max(12, maxLeft);
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    currentGoalPopover = pop;
    // 关闭事件
    setTimeout(() => document.addEventListener('click', onDocClickForPopover, true), 0);
    window.addEventListener('scroll', hideGoalPopover, true);
    window.addEventListener('resize', hideGoalPopover, true);
  }

  // 初始化应用
  function init() {
    loadPreferences();
    setupEventListeners();
    loadFateData();
    setupPeriodicUpdates();
    updateCurrentStatus();
  }

  // 加载用户偏好设置
  function loadPreferences() {
    state.theme = localStorage.getItem('mcfate-theme') || 'light';
    // 读取已完成目标记录
    try {
      const saved = JSON.parse(localStorage.getItem('mcfate-completed-goals') || '[]');
      if (Array.isArray(saved)) state.completedGoals = new Set(saved);
    } catch (e) { state.completedGoals = new Set(); }

    // 应用主题
    document.body.setAttribute('data-theme', state.theme);
    elements.themeToggle.querySelector('i').className = state.theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';

    // 应用筛选面板状态
    // 无筛选界面
  }

  function persistCompleted() {
    try { localStorage.setItem('mcfate-completed-goals', JSON.stringify(Array.from(state.completedGoals))); } catch (e) {}
  }

  // 设置事件监听器
  function setupEventListeners() {

    // 主题切换
    elements.themeToggle.addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      document.body.setAttribute('data-theme', state.theme);
      elements.themeToggle.querySelector('i').className = state.theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
      localStorage.setItem('mcfate-theme', state.theme);
    });

    // 无筛选事件

    // 仅允许点击右侧倒计时区域切换完成状态（单目标标记/撤销）
    elements.fateList.addEventListener('click', (ev) => {
      const right = ev.target.closest('.goal-right');
      if (!right) return;
      const block = right.closest('.goal-block');
      if (!block) return;
      const goalKey = block.getAttribute('data-goal');
      if (!goalKey) return;
      if (state.completedGoals.has(goalKey)) state.completedGoals.delete(goalKey); else state.completedGoals.add(goalKey);
      persistCompleted();
      renderFateList();
    });

    // 点击标题栏：对该FATE下的所有目标批量切换（便于快速标记/撤销）
    elements.fateList.addEventListener('click', (ev) => {
      const header = ev.target.closest('.fate-header-info');
      if (!header) return;
      const item = header.closest('.fate-item');
      if (!item) return;
      const goals = Array.from(item.querySelectorAll('.goal-block'));
      if (goals.length === 0) return;
      // 若存在任意未完成，则全部设为完成；否则全部撤销
      const anyUnfinished = goals.some(g => !state.completedGoals.has(g.getAttribute('data-goal')));
      goals.forEach(g => {
        const k = g.getAttribute('data-goal');
        if (!k) return;
        if (anyUnfinished) state.completedGoals.add(k); else state.completedGoals.delete(k);
      });
      persistCompleted();
      renderFateList();
    });
  }

  // 加载FATE数据
  async function loadFateData() {
    try {
      // 添加时间戳参数防止缓存，确保获取最新数据
      const timestamp = new Date().getTime();
      const response = await fetch(`./src/fate_data.json?t=${timestamp}`, {
        cache: 'no-cache', // 强制不使用缓存
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) throw new Error('Failed to load FATE data');
      
      state.fateData = await response.json();
      populateMapSelect();
      resetListOrderCache();
      renderFateList();
      
      console.log(`✅ FATE数据加载成功，共${state.fateData.length}个FATE`);
    } catch (error) {
      console.error('Error loading FATE data:', error);
      elements.fateList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>无法加载FATE数据，请检查网络连接后刷新页面</p>
        </div>
      `;
    }
  }

  // 填充地图选择器
  function populateMapSelect() {
    // 无地图选择器
  }

  // 艾欧泽亚时间计算（与McWeather一致）
  function getEorzeaTime(unixMs = Date.now()) {
    const eorzeaMs = Math.floor(unixMs / EORZEA_HOUR_MS) * EORZEA_HOUR_MS;
    const bell = Math.floor(unixMs / EORZEA_HOUR_MS) % 24;
    const minute = Math.floor((unixMs % EORZEA_HOUR_MS) / (EORZEA_HOUR_MS / 60));
    return { bell, minute, eorzeaMs };
  }

  // 格式化艾欧泽亚时间
  function formatEorzeaTime(bell, minute) {
    return `${String(bell).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function formatMsFull(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function formatMsHHMM(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // 判断是否是白天（6:00-18:00）
  function isDaytime(bell) {
    return bell >= 6 && bell < 18;
  }

  // 天气值计算（与McWeather一致）
  function calculateWeatherValue(unixMs) {
    const ms = Math.floor(unixMs);
    const bell = Math.floor(ms / EORZEA_HOUR_MS) % 24;
    const increment = (bell + 8 - (bell % 8)) % 24;
    const totalDays = Math.floor(ms / EORZEA_DAY_MS);
    const calcBase = totalDays * 100 + increment;
    const step1 = ((calcBase << 11) ^ calcBase) >>> 0;
    const step2 = ((step1 >>> 8) ^ step1) >>> 0;
    return step2 % 100;
  }

  // 获取最近的8小时间隔开始时间
  function nearestIntervalStart(unixMs) {
    const bell = Math.floor(unixMs / EORZEA_HOUR_MS);
    const alignedBell = bell - (bell % 8);
    return alignedBell * EORZEA_HOUR_MS;
  }

  // 根据天气值选择天气
  function pickWeatherByValue(zoneKey, value) {
    const table = WEATHER_DATA[zoneKey] || [];
    let cursor = 0;
    for (let i = 0; i < table.length; i++) {
      cursor += table[i].chance;
      if (value < cursor) return table[i];
    }
    return table[table.length - 1] || { name: 'clearSkies', chance: 100 };
  }

  // 获取指定地图的当前天气
  function getCurrentWeather(mapName) {
    const zoneKey = MAP_NAMES[mapName];
    if (!zoneKey) return null;

    const now = Date.now();
    const intervalStart = nearestIntervalStart(now);
    const weatherValue = calculateWeatherValue(intervalStart);
    const weather = pickWeatherByValue(zoneKey, weatherValue);
    
    return {
      name: weather.name,
      nameCN: WEATHER_NAMES_CN[weather.name] || weather.name,
      intervalStart,
      intervalEnd: intervalStart + EORZEA_8_HOUR_MS
    };
  }

  // 计算天气目标的倒计时（可完成剩余时间 / 距离可完成还有）
  function getWeatherRequirementCountdown(mapName, requirement) {
    const zoneKey = MAP_NAMES[mapName];
    if (!zoneKey || !requirement) return { active: false, msLeft: 0, text: '未知' };

    const now = Date.now();
    const currentStart = nearestIntervalStart(now);
    const currentWeather = pickWeatherByValue(zoneKey, calculateWeatherValue(currentStart));
    // 如果是复合与条件（多个天气都需要完成），不适合用单一倒计时表达
    if (requirement.includes('&')) {
      return { active: false, msLeft: 0, text: '多目标（按次完成）' };
    }
    const allowWeathers = requirement.split('|').map(w => WEATHER_NAMES_EN[w.trim()]).filter(Boolean);

    // 当前是否满足
    const isActive = allowWeathers.includes(currentWeather.name);
    if (isActive) {
      const end = currentStart + EORZEA_8_HOUR_MS;
      const msLeft = Math.max(0, end - now);
      if (msLeft === 0) {
        // 当前区间刚结束，跳到下一次满足的时间
        let t = currentStart + EORZEA_8_HOUR_MS;
        let guard = 0;
        while (guard < 2000) {
          const w = pickWeatherByValue(zoneKey, calculateWeatherValue(t));
          if (allowWeathers.includes(w.name)) {
            const ms = Math.max(0, t - now);
            return { active: false, msLeft: ms, text: `距离可完成还有 ${formatMsFull(ms)}` };
          }
          t += EORZEA_8_HOUR_MS; guard++;
        }
      }
      return { active: true, msLeft, text: `可完成剩余时间 ${formatMsFull(msLeft)}` };
    }

    // 查找下一个满足的天气区间
    let t = currentStart + EORZEA_8_HOUR_MS;
    let guard = 0;
    while (guard < 2000) {
      const w = pickWeatherByValue(zoneKey, calculateWeatherValue(t));
      if (allowWeathers.includes(w.name)) {
        const msLeft = Math.max(0, t - now);
        return { active: false, msLeft, text: `距离可完成还有 ${formatMsFull(msLeft)}` };
      }
      t += EORZEA_8_HOUR_MS;
      guard++;
    }
    return { active: false, msLeft: 0, text: '等待中' };
  }

  // 计算到指定ET时间的现实毫秒
  function msToEtTime(targetBell, targetMinute) {
    const now = Date.now();
    const bell = Math.floor(now / EORZEA_HOUR_MS) % 24;
    const minute = Math.floor((now % EORZEA_HOUR_MS) / EORZEA_MINUTE_MS);
    const curMin = bell * 60 + minute;
    const tgtMin = targetBell * 60 + targetMinute;
    const deltaMin = (tgtMin - curMin + 1440) % 1440;
    return deltaMin * EORZEA_MINUTE_MS;
  }

  // 计算时间目标的倒计时（白天/夜晚）
  function getTimeRequirementCountdown(requirement) {
    if (!requirement) return { active: false, msLeft: 0, text: '未知' };
    const now = Date.now();
    const bell = Math.floor(now / EORZEA_HOUR_MS) % 24;
    const minute = Math.floor((now % EORZEA_HOUR_MS) / EORZEA_MINUTE_MS);
    const curMin = bell * 60 + minute;
    const inDay = curMin >= 360 && curMin < 1080; // 6:00-18:00

    if (requirement.includes('白天')) {
      if (inDay) {
        const msLeft = (1080 - curMin) * EORZEA_MINUTE_MS;
        return { active: true, msLeft, text: `可完成剩余时间 ${formatMsFull(msLeft)}` };
      }
      // 距离下一个白天6:00
      const msLeft = msToEtTime(6, 0);
      return { active: false, msLeft, text: `距离可完成还有 ${formatMsFull(msLeft)}` };
    }

    if (requirement.includes('夜晚')) {
      const inNight = !inDay; // 18:00-次日6:00
      if (inNight) {
        // 到下一个6:00结束
        const endMin = curMin < 360 ? 360 : 1440; // 当前是00:00-06:00 -> 6:00， 否则到24:00
        const msLeft = (endMin - curMin) * EORZEA_MINUTE_MS;
        return { active: true, msLeft, text: `可完成剩余时间 ${formatMsFull(msLeft)}` };
      }
      // 距离18:00
      const msLeft = msToEtTime(18, 0);
      return { active: false, msLeft, text: `距离可完成还有 ${formatMsFull(msLeft)}` };
    }

    return { active: false, msLeft: 0, text: '未知' };
  }

  // 解析形如 HH:MM 或 HH:MM:SS 的ET时间
  function parseEtTimeStr(str) {
    if (str === null || str === undefined || str === '') return null;
    // 数字/数字字符串（如 1110 或 "1110"）视为 HHMM
    if (typeof str === 'number') {
      const n = Math.max(0, Math.floor(str));
      const h = Math.floor(n / 100) % 24;
      const mi = n % 100;
      if (mi >= 60) return null;
      return { h, m: mi };
    }
    const raw = String(str).trim();
    if (/^\d{3,4}$/.test(raw)) {
      const n = parseInt(raw, 10);
      const h = Math.floor(n / 100) % 24;
      const mi = n % 100;
      if (mi >= 60) return null;
      return { h, m: mi };
    }
    const s = raw.replace(/\uFF1A/g, ':'); // 全角冒号 → 半角
    const m = s.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
    if (!m) return null;
    const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
    const mi = Math.max(0, Math.min(59, parseInt(m[2], 10)));
    return { h, m: mi };
  }

  function formatEtTimeHm(str) {
    const t = parseEtTimeStr(str);
    if (!t) return '--:--';
    return `${String(t.h).padStart(2,'0')}:${String(t.m).padStart(2,'0')}`;
  }

  function splitEtRangeMaybe(str) {
    if (!str) return [ '', '' ];
    const s = String(str).trim().replace(/\uFF1A/g, ':');
    // 支持 11:10-12:10 / 11:10 - 12:10 / 11：10-12：10 等
    const m = s.match(/^(\d{1,2}:\d{1,2})(?:\s*[\-–—]\s*(\d{1,2}:\d{1,2}))?$/);
    if (m) {
      return [ m[1], m[2] || '' ];
    }
    return [ s, '' ];
  }

  // 出现/消失时间窗口倒计时（只考虑时间窗口）
  function getAppearanceWindowCountdown(appearStr, disappearStr) {
    // 兼容 “11:10 - 12:10” 一行写法
    let aStr = appearStr, dStr = disappearStr;
    if (!dStr && aStr && /-|–|—/.test(String(aStr))) {
      const [s1, s2] = splitEtRangeMaybe(String(aStr));
      aStr = s1; dStr = s2;
    }
    const appear = parseEtTimeStr(aStr);
    const disappear = parseEtTimeStr(dStr);
    if (!appear && !disappear) return null;

    const now = Date.now();
    const bell = Math.floor(now / EORZEA_HOUR_MS) % 24;
    const minute = Math.floor((now % EORZEA_HOUR_MS) / EORZEA_MINUTE_MS);
    const curMin = bell * 60 + minute;

    let startMin = appear ? (appear.h * 60 + appear.m) : 0;
    let endMin = disappear ? (disappear.h * 60 + disappear.m) : 1440;
    // 跨日处理
    if (endMin <= startMin) endMin += 1440;

    // 计算当前相对到开始/结束的分钟
    let relCur = curMin;
    if (curMin < startMin % 1440) relCur += (curMin <= endMin % 1440 ? 0 : 1440);

    if (relCur >= startMin && relCur < endMin) {
      const msLeft = (endMin - relCur) * EORZEA_MINUTE_MS;
      return { active: true, msLeft, text: `可完成剩余时间 ${formatMsFull(msLeft)}` };
    }
    // 距离下一个开始
    const nextStartMs = msToEtTime(appear ? appear.h : 0, appear ? appear.m : 0);
    return { active: false, msLeft: nextStartMs, text: `距离可完成还有 ${formatMsFull(nextStartMs)}` };
  }

  // 出现时间窗口 + 指定出现天气 的综合倒计时（例如：乌合之众）
  function getAppearanceWithWeatherCountdown(mapName, appearStr, disappearStr, appearWeatherStr, extraTimeReq = '', extraWeatherStr = '') {
    const zoneKey = MAP_NAMES[mapName];
    if (!zoneKey) return null;
    // 先解析出现时间窗口，避免未初始化变量被引用
    const appear = parseEtTimeStr(appearStr);
    const disappear = parseEtTimeStr(disappearStr);
    const appearWeatherKeys = (appearWeatherStr || '')
      .split('|')
      .map(s => WEATHER_NAMES_EN[s.trim()])
      .filter(Boolean);
    const extraWeatherKeys = (extraWeatherStr || '')
      .split('|')
      .map(s => WEATHER_NAMES_EN[s.trim()])
      .filter(Boolean);

    // 允许天气集合：若两者都存在则取交集，否则取存在的一方；都没有则表示不限制
    let allowWeatherSet = null; // null 表示不限制
    if (appearWeatherKeys.length > 0 && extraWeatherKeys.length > 0) {
      const setExtra = new Set(extraWeatherKeys);
      allowWeatherSet = new Set(appearWeatherKeys.filter(w => setExtra.has(w)));
    } else if (appearWeatherKeys.length > 0) {
      allowWeatherSet = new Set(appearWeatherKeys);
    } else if (extraWeatherKeys.length > 0) {
      allowWeatherSet = new Set(extraWeatherKeys);
    }

    if (!appear && !disappear) {
      // 没有出现时间窗口：只根据天气/时间目标联合判断
      const hasTime = extraTimeReq && (extraTimeReq.includes('白天') || extraTimeReq.includes('夜晚'));
      const weatherStr = (extraWeatherStr || appearWeatherStr || '').trim();
      const hasWeather = !!weatherStr;
      if (hasWeather && hasTime) {
        // 复用组合倒计时
        return getCombinedWeatherTimeCountdown(mapName, weatherStr, `&${extraTimeReq}`);
      }
      if (hasWeather) return getWeatherRequirementCountdown(mapName, weatherStr);
      if (hasTime) return getTimeRequirementCountdown(extraTimeReq);
      return { active: false, msLeft: 0, text: '等待中' };
    }

    if (!allowWeatherSet) {
      // 仅出现时间窗口
      return getAppearanceWindowCountdown(appearStr, disappearStr);
    }

    // 已确认存在出现窗口
    if (!appear && !disappear) return null;

    // 计算未来若干个时间窗口内与天气区间的第一次相交（两者必须同时满足）
    const now = Date.now();
    const startMin = (appear ? appear.h * 60 + appear.m : 0) % 1440;
    const endMinRaw = disappear ? disappear.h * 60 + disappear.m : 1440;
    const endMin = endMinRaw <= startMin ? endMinRaw + 1440 : endMinRaw; // 跨日处理

    // 辅助：给定一个真实时间，找到与窗口的下一次相交区间（若存在）
    function findIntersectionFrom(t0) {
      // 迭代未来N天的窗口
      for (let day = 0; day < 5; day++) {
        const dayOffsetMs = day * EORZEA_DAY_MS;
        // 窗口开始(相对现在)与结束的真实时间
        const msToStart = msToEtTime((startMin / 60) | 0, startMin % 60) + dayOffsetMs;
        const winStart = now + Math.max(0, msToStart);
        let winEnd = winStart + (endMin - startMin) * EORZEA_MINUTE_MS;
        if (winEnd - winStart > EORZEA_DAY_MS) winEnd = winStart + EORZEA_DAY_MS; // 安全限制

        // 从 max(t0, winStart) 开始，搜索天气区间
        let cursor = Math.max(t0, winStart);
        let guard = 0;
        while (cursor < winEnd && guard < 64) {
          const intStart = nearestIntervalStart(cursor);
          const w = pickWeatherByValue(zoneKey, calculateWeatherValue(intStart));
          const intEnd = intStart + EORZEA_8_HOUR_MS;
          const has = allowWeatherSet.has(w.name);
          if (has) {
            const interStart = Math.max(intStart, winStart);
            const interEnd = Math.min(intEnd, winEnd);
            if (interStart < interEnd) {
              // 额外时间条件（白天/夜晚）
              const needDay = extraTimeReq.includes('白天');
              const needNight = extraTimeReq.includes('夜晚');
              const isOkTime = (t) => {
                if (!needDay && !needNight) return true;
                const bell = Math.floor(t / EORZEA_HOUR_MS) % 24;
                const inDay = bell >= 6 && bell < 18;
                return needDay ? inDay : !inDay;
              };

              // 如果当前时间落在交集区间内
              if (now >= interStart && now < interEnd && isOkTime(now)) {
                const msLeft = interEnd - now;
                return { active: true, msLeft, text: `可完成剩余时间 ${formatMsFull(msLeft)}` };
              }

              // 计算从现在起到该交集区间开始的等待时间
              const waitToInterStart = Math.max(0, interStart - now);
              if (now < interStart) {
                // 如果需要白天/夜晚，则对齐到交集区间内第一个满足的ET边界
                if (needDay || needNight) {
                  // 以交集起点为基准，若其不满足时间条件，则推到下一次6:00或18:00
                  const tmpNow = interStart;
                  const bell = Math.floor(tmpNow / EORZEA_HOUR_MS) % 24;
                  const inDay = bell >= 6 && bell < 18;
                  const ok = needDay ? inDay : !inDay;
                  if (!ok) {
                    const bump = needDay ? msToEtTime(6, 0) : msToEtTime(18, 0);
                    const candidate = interStart + bump;
                    if (candidate < interEnd) {
                      return { active: false, msLeft: candidate - now, text: `距离可完成还有 ${formatMsFull(candidate - now)}` };
                    }
                  }
                }
                return { active: false, msLeft: waitToInterStart, text: `距离可完成还有 ${formatMsFull(waitToInterStart)}` };
              }
            }
          }
          cursor = intEnd + 1;
          guard++;
        }
      }
      return { active: false, msLeft: 0, text: '等待中' };
    }

    return findIntersectionFrom(now);
  }

  // 天气+时间双目标（时间字段以&开头）
  function getCombinedWeatherTimeCountdown(mapName, weatherReq, timeReq) {
    const pureTime = timeReq.replace(/^&\s*/, '');
    // 如果当前同时满足：剩余时间取两者剩余的较小值
    const w = getWeatherRequirementCountdown(mapName, weatherReq);
    const t = getTimeRequirementCountdown(pureTime);
    if (w.active && t.active) {
      const msLeft = Math.min(w.msLeft, t.msLeft);
      return { active: true, msLeft, text: `可完成剩余时间 ${formatMsFull(msLeft)}` };
    }
    // 查找下一个满足的天气区间，且落在时间窗口内
    const zoneKey = MAP_NAMES[mapName];
    if (!zoneKey) return { active: false, msLeft: 0, text: '等待中' };
    const now = Date.now();
    const currentStart = nearestIntervalStart(now);
    let tCursor = currentStart + EORZEA_8_HOUR_MS; // 从“下一个”8h区间开始搜索，避免出现 00:00:00 的边界卡住
    let guard = 0;
    const allowWeathers = weatherReq.split('|').map(wk => WEATHER_NAMES_EN[wk.trim()]).filter(Boolean);
    while (guard < 2000) {
      const wname = pickWeatherByValue(zoneKey, calculateWeatherValue(tCursor)).name;
      if (allowWeathers.includes(wname)) {
        // 检查该区间开始时是否处于时间窗口
        const bell = Math.floor(tCursor / EORZEA_HOUR_MS) % 24;
        const inDay = bell >= 6 && bell < 18;
        const needDay = pureTime.includes('白天');
        const ok = needDay ? inDay : !inDay;
        if (ok) {
          const msLeft = Math.max(0, tCursor - now);
          return { active: false, msLeft, text: `距离可完成还有 ${formatMsFull(msLeft)}` };
        }
      }
      tCursor += EORZEA_8_HOUR_MS;
      guard++;
    }
    return { active: false, msLeft: 0, text: '等待中' };
  }

  // 计算到下次天气变化的倒计时
  function getWeatherCountdown() {
    const now = Date.now();
    const currentInterval = nearestIntervalStart(now);
    const nextInterval = currentInterval + EORZEA_8_HOUR_MS;
    const remaining = nextInterval - now;

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    return {
      remaining,
      text: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
  }

  // 更新当前状态显示
  function updateCurrentStatus() {
    const now = Date.now();
    const eorzeaTime = getEorzeaTime(now);
    const countdown = getWeatherCountdown();

    // 更新艾欧泽亚时间
    elements.eorzeaTime.textContent = formatEorzeaTime(eorzeaTime.bell, eorzeaTime.minute);

    // 更新天气倒计时
    elements.weatherCountdown.textContent = countdown.text;
  }

  // 筛选FATE数据
  function filterFateData() {
    // 直接返回全部FATE
    return state.fateData || [];
  }

  // 渲染FATE列表
  function renderFateList() {
    const filteredFates = filterFateData();

    if (filteredFates.length === 0) {
      elements.fateList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <p>没有找到符合条件的FATE</p>
        </div>
      `;
      return;
    }

    const items = filteredFates.flatMap(fate => {
      // 组装“目标”集合，并在渲染时将“出现条件”并入每个目标的倒计时计算
      const goals = [];

      const appearWeather = fate.出现天气 || '';
      const appearStart = fate.出现时间 || '';
      const appearEnd = fate.消失时间 || '';

      // 组合型目标：天气+时间（时间以&开头）
      if (fate.目标需求天气 && /^\s*&/.test(String(fate.目标需求时间 || ''))) {
        const pureTime = String(fate.目标需求时间).replace(/^\s*&\s*/, '');
        goals.push({ weatherReq: String(fate.目标需求天气).trim(), timeReq: pureTime, isCombined: true });
      }

      // 天气 AND 拆分、天气 OR 保持一项
      if (fate.目标需求天气 && !/^\s*&/.test(String(fate.目标需求时间 || ''))) {
        const weatherStr = String(fate.目标需求天气).trim();
        if (weatherStr.includes('&')) {
          weatherStr.split('&').map(s => s.trim()).filter(Boolean).forEach(part => {
            goals.push({ weatherReq: part });
          });
        } else {
          goals.push({ weatherReq: weatherStr });
        }
      }

      // 时间（非&）目标
      if (fate.目标需求时间 && !/^\s*&/.test(String(fate.目标需求时间))) {
        goals.push({ timeReq: String(fate.目标需求时间).trim() });
      }

      // 若没有任何目标，则也渲染一个普通条目
      if (goals.length === 0) {
        goals.push({});
      }

      const rows = [];
      const baseInfoHtml = () => `
        <div class=\"fate-header-info\"> 
          <div class=\"fate-main-info\"> 
            <div class=\"fate-name\">${fate.名称}</div>
            <div class=\"fate-location\"> 
              <i class=\"fas fa-map-marker-alt\"></i>
              ${fate.地图} - 等级 ${fate.等级}
            </div>
          </div>
        </div>`;

      goals.forEach((g, idx) => {
        const goalKey = `${fate.地图}|${fate.名称}|goal|${idx}|${g.weatherReq || ''}|${g.timeReq || ''}`;
        const isCompleted = state.completedGoals.has(goalKey);
        const cd = isCompleted ? null : getAppearanceWithWeatherCountdown(
          fate.地图,
          appearStart,
          appearEnd,
          appearWeather,
          g.timeReq || '',
          g.weatherReq || ''
        );

        const leftLines = [];
        if (appearWeather) {
          const show = normalizeWeatherLabel(appearWeather);
          const tag = `<span class="tag tag-weather">${show}</span>`;
          leftLines.push(`<div class="goal-line"><span class="goal-label">出现天气</span><span class="goal-value">${tag}</span></div>`);
        }
        if (appearStart || appearEnd) {
          // 展示原始区间（兼容单列写法）
          let aLabel = appearStart, dLabel = appearEnd;
          if (!dLabel && aLabel && /-|–|—/.test(String(aLabel))) {
            const [s1, s2] = splitEtRangeMaybe(String(aLabel)); aLabel = s1; dLabel = s2;
          }
          const timeLabel = `ET ${formatEtTimeHm(aLabel)}` + (dLabel ? ` - ${formatEtTimeHm(dLabel)}` : '');
          leftLines.push(`<div class=\"goal-line\"><span class=\"goal-label\">出现时间</span><span class=\"goal-value\"><span class=\"tag tag-time\">${timeLabel}</span></span></div>`);
        }
        // 目标标签：天气 与 白天/夜晚；若同时存在，用“{天气}的{时间}”
        const goalWeather = normalizeWeatherLabel(g.weatherReq || '');
        const goalTime = String(g.timeReq || '');
        const timeTag = /白天/.test(goalTime) ? '<span class="tag tag-day">白天</span>' : (/夜晚/.test(goalTime) ? '<span class="tag tag-night">夜晚</span>' : '');
        let goalVal = '';
        if (goalWeather && timeTag) {
          goalVal = `<span class="tag tag-weather">${goalWeather}</span>${timeTag}`;
        } else {
          const pieces = [];
          if (goalWeather) pieces.push(`<span class="tag tag-weather">${goalWeather}</span>`);
          if (timeTag) pieces.push(timeTag);
          goalVal = pieces.join('');
        }
        if (goalVal.trim().length > 0) {
          leftLines.push(`<div class="goal-line goal-detail-trigger"><span class="goal-label">目标</span><span class="goal-value">${goalVal}</span></div>`);
        }

        const statusClass = isCompleted ? 'completed' : (cd ? (cd.active ? 'active' : 'pending') : 'pending');
        const text = isCompleted ? '已完成' : (cd ? cd.text : '—');
        const id = goalKey;
        const html = `
          <div class=\"fate-item ${isCompleted ? 'goal-completed' : ''}\"> 
            ${baseInfoHtml()} 
            <div class=\"goal-block ${isCompleted ? 'completed' : ''}\" data-goal=\"${goalKey}\"> 
              <div class=\"goal-left\">${leftLines.join('')}</div>
              <div class=\"goal-right\"><span class=\"goal-countdown ${statusClass}\">${text}</span></div>
            </div>
          </div>`;
        rows.push({ id, html, hasActive: !isCompleted && !!(cd && cd.active), sortValue: isCompleted ? Infinity : (cd ? cd.msLeft : Infinity), isCompleted });
      });

      return rows;
    });

    // 检查是否需要重新排序（仅当有条目开始/结束，即 hasActive 状态变化时）
    const currentIds = items.map(i => i.id);
    const needFullResort =
      lastOrderIds.length === 0 ||
      lastOrderIds.length !== currentIds.length ||
      currentIds.some(id => !lastOrderIds.includes(id));

    let anyStatusChanged = false;
    for (const it of items) {
      const prev = lastStatusById.get(it.id);
      if (prev === undefined || prev !== it.hasActive) {
        anyStatusChanged = true;
      }
    }

    if (needFullResort || anyStatusChanged) {
      // 重新排序：已完成放最后；然后可完成优先；其次剩余/距离时间；最后按id
      items.sort((a, b) => {
        if (!!a.isCompleted !== !!b.isCompleted) return a.isCompleted ? 1 : -1;
        if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1;
        const av = a.sortValue ?? Infinity;
        const bv = b.sortValue ?? Infinity;
        if (av !== bv) return av - bv;
        return a.id.localeCompare(b.id);
      });
      lastOrderIds = items.map(i => i.id);
    } else {
      // 没有开始/结束变化，保持之前顺序
      items.sort((a, b) => {
        // 若用户手动标记完成/撤销但没有活跃状态变化，也需要把完成项放到最后
        if (!!a.isCompleted !== !!b.isCompleted) return a.isCompleted ? 1 : -1;
        return lastOrderIds.indexOf(a.id) - lastOrderIds.indexOf(b.id);
      });
    }

    // 更新状态缓存
    lastStatusById.clear();
    for (const it of items) lastStatusById.set(it.id, it.hasActive);

    elements.fateList.innerHTML = items.map(i => i.html).join('');

    // 绑定“目标”详情弹窗（点击整行“目标”区域，不影响完成标记）
    elements.fateList.querySelectorAll('.goal-line.goal-detail-trigger').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemEl = el.closest('.fate-item');
        if (!itemEl) return;
        // 通过标题获取 fate
        const nameEl = itemEl.querySelector('.fate-name');
        const locEl = itemEl.querySelector('.fate-location');
        const name = nameEl ? nameEl.textContent.trim() : '';
        // 通过地图与名称匹配 fate 对象
        const mapText = locEl ? (locEl.textContent || '').split('-')[0].trim() : '';
        const fate = state.fateData.find(f => f.名称 === name && (f.地图 && mapText && f.地图.indexOf(mapText) !== -1));
        if (!fate) return;
        showGoalPopover(el, fate);
      });
    });
  }

  // 设置定时更新
  function setupPeriodicUpdates() {
    // 每秒更新当前状态
    setInterval(updateCurrentStatus, 1000);
    
    // 每秒更新FATE列表以刷新倒计时
    setInterval(renderFateList, 1000);
  }

  // 启动应用
  document.addEventListener('DOMContentLoaded', init);

})();
