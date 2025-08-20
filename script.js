// McFATE - FATE计时器主脚本
(function() {
  'use strict';

  // DOM元素
  const elements = {
    themeToggle: document.getElementById('themeToggle'),
    listToggle: document.getElementById('listToggle'),
    hideCompletedBtn: document.getElementById('hideCompletedBtn'),
    settingsToggle: document.getElementById('settingsToggle'),
    eorzeaTime: document.getElementById('eorzeaTime'),
    weatherCountdown: document.getElementById('weatherCountdown'),
    fateList: document.getElementById('fateList'),
    currentStatus: document.getElementById('currentStatus')
  };

  // 应用状态
  let state = {
    theme: 'light',
    listView: false, // 列表视图状态
    hideCompleted: false, // 隐藏已完成状态
    fateData: [], // 倒计时列表使用的特殊FATE数据
    allFateData: [], // 全部FATE数据，用于列表视图和统计
    // 以  地图|名称|goal|idx|weather|time 为唯一标识，单目标标记
    completedGoals: new Set(),
    // 快速筛选状态
    quickFilters: {
      timeLimit: false,
      rune: false,
      lucky: false,
      highRisk: false,
      weather: false,
      time: false
    },
    // 统计显示模式：true为目标模式，false为FATE模式
    completionDisplayMode: true, // 全局统计显示模式
    filterCompletionDisplayMode: true // 筛选区域统计显示模式
  };

  // 列表顺序缓存：在没有"开始/结束"状态变化前保持相对稳定
  let lastOrderIds = [];
  const lastStatusById = new Map(); // id -> hasActive

  // 导出数据的键列表
  const EXPORT_KEYS = [
    'mcfate-theme',
    'mcfate-list-view',
    'mcfate-hide-completed',
    'mcfate-completed-goals',
    'mcfate-filter-state',
    'mcfate-quick-filters'
  ];

  function resetListOrderCache() {
    lastOrderIds = [];
    lastStatusById.clear();
  }

  // 重置其他快速筛选按钮
  function resetOtherQuickFilters(activeFilter) {
    const filterButtons = {
      timeLimit: document.getElementById('timeLimitBtn'),
      rune: document.getElementById('runeBtn'),
      lucky: document.getElementById('luckyBtn'),
      highRisk: document.getElementById('highRiskBtn'),
      weather: document.getElementById('weatherBtn'),
      time: document.getElementById('timeBtn')
    };

    Object.keys(state.quickFilters).forEach(key => {
      if (key !== activeFilter) {
        state.quickFilters[key] = false;
        if (filterButtons[key]) {
          filterButtons[key].classList.remove('active');
        }
      }
    });
  }

  // 快速筛选逻辑
  function applyQuickFilters(fate) {
    // 限时筛选：检查目标中是否包含时间关键词
    if (state.quickFilters.timeLimit) {
      const timeKeywords = ['10秒', '90秒', '120秒', '180秒', '240秒', '300秒', '600秒'];
      const goalsText = String(fate.危命目标 || '').toLowerCase();
      const hasTimeLimit = timeKeywords.some(keyword => goalsText.includes(keyword.toLowerCase()));
      if (!hasTimeLimit) return false;
    }

    // 其他筛选条件（待实现）
    if (state.quickFilters.rune) {
      // 符文筛选：检查目标中是否包含"符文"关键词
      const goalsText = String(fate.危命目标 || '').toLowerCase();
      const hasRune = goalsText.includes('符文');
      if (!hasRune) return false;
    }

    if (state.quickFilters.lucky) {
      // 幸运筛选：检查目标中是否包含"幸运"关键词
      const goalsText = String(fate.危命目标 || '').toLowerCase();
      const hasLucky = goalsText.includes('幸运');
      if (!hasLucky) return false;
    }

    if (state.quickFilters.highRisk) {
      // 高危筛选：检查目标中是否包含"高危"关键词
      const goalsText = String(fate.危命目标 || '').toLowerCase();
      const hasHighRisk = goalsText.includes('高危');
      if (!hasHighRisk) return false;
    }

    if (state.quickFilters.weather) {
      // 天气筛选：检查目标中是否包含天气相关关键词
      const weatherKeywords = ['天气', '雨天', '晴天'];
      const goalsText = String(fate.危命目标 || '').toLowerCase();
      const hasWeatherKeyword = weatherKeywords.some(keyword => goalsText.includes(keyword.toLowerCase()));
      if (!hasWeatherKeyword) return false;
    }

    if (state.quickFilters.time) {
      // 时间筛选：检查是否包含"白天"或"夜晚"关键词
      const goalsText = String(fate.危命目标 || '').toLowerCase();
      const hasTimeKeyword = goalsText.includes('白天') || goalsText.includes('夜晚');
      if (!hasTimeKeyword) return false;
    }

    return true; // 没有筛选条件时返回true
  }

  // 导出本地数据
  function exportLocalData() {
    const data = {};
    // 导出所有配置数据
    for (const k of EXPORT_KEYS) {
      try { 
        const value = localStorage.getItem(k);
        if (value !== null) {
          data[k] = value; 
        }
      } catch(e) {
        console.warn(`导出键 ${k} 失败:`, e);
      }
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = 'mcfate-backup.json';
    document.body.appendChild(a); 
    a.click(); 
    a.remove();
    URL.revokeObjectURL(url);
    
    console.log('FATE数据已导出');
  }

  // 导入本地数据
  function importLocalData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result || '{}'));
        let importedCount = 0;
        
        Object.keys(obj).forEach(k => {
          try { 
            localStorage.setItem(k, obj[k]); 
            importedCount++;
          } catch(e) {
            console.warn(`导入键 ${k} 失败:`, e);
          }
        });
        
        // 重新载入状态
        loadPreferences();
        loadFilterState();
        updateFilterChips();
        renderFateList();
        
        console.log(`成功导入 ${importedCount} 个配置项`);
        alert('数据已导入，页面已刷新');
      } catch (e) {
        console.error('导入失败:', e);
        alert('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
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
  let currentGoalPopoverAnchor = null;
  function hideGoalPopover() {
    if (currentGoalPopover) {
      currentGoalPopover.remove();
      currentGoalPopover = null;
      currentGoalPopoverAnchor = null;
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
    currentGoalPopoverAnchor = anchorEl;
    // 关闭事件
    setTimeout(() => document.addEventListener('click', onDocClickForPopover, true), 0);
    window.addEventListener('scroll', hideGoalPopover, true);
    window.addEventListener('resize', hideGoalPopover, true);
  }

  // 初始化应用
  function init() {
    loadPreferences();
    setupEventListeners();
    // 立即开始加载数据，不等待DOM完全加载
    loadFateData();
    setupPeriodicUpdates();
    updateCurrentStatus();
  }

  // 加载用户偏好设置
  function loadPreferences() {
    state.theme = localStorage.getItem('mcfate-theme') || 'light';
    state.listView = localStorage.getItem('mcfate-list-view') === 'true';
    state.hideCompleted = localStorage.getItem('mcfate-hide-completed') === 'true';
    
    // 加载快速筛选状态
    try {
      const savedFilters = JSON.parse(localStorage.getItem('mcfate-quick-filters') || '{}');
      Object.keys(state.quickFilters).forEach(key => {
        if (savedFilters.hasOwnProperty(key)) {
          state.quickFilters[key] = savedFilters[key];
        }
      });
    } catch (e) {
      console.warn('加载快速筛选状态失败:', e);
    }
    
    // 加载统计显示模式
    const savedCompletionMode = localStorage.getItem('mcfate-completion-display-mode');
    if (savedCompletionMode !== null) {
      state.completionDisplayMode = savedCompletionMode === 'true';
    }
    
    const savedFilterCompletionMode = localStorage.getItem('mcfate-filter-completion-display-mode');
    if (savedFilterCompletionMode !== null) {
      state.filterCompletionDisplayMode = savedFilterCompletionMode === 'true';
    }
    
    // 读取已完成目标记录
    try {
      const saved = JSON.parse(localStorage.getItem('mcfate-completed-goals') || '[]');
      if (Array.isArray(saved)) {
        // 验证数据格式，确保所有项目都是字符串
        const validItems = saved.filter(item => typeof item === 'string');
        state.completedGoals = new Set(validItems);
        
        // 如果数据被过滤了，保存清理后的数据
        if (validItems.length !== saved.length) {
          console.log(`清理了 ${saved.length - validItems.length} 个无效的已完成目标记录`);
          localStorage.setItem('mcfate-completed-goals', JSON.stringify(validItems));
        }
      } else {
        state.completedGoals = new Set();
      }
    } catch (e) { 
      console.warn('加载已完成目标记录失败:', e);
      state.completedGoals = new Set(); 
    }

    // 应用主题
    document.body.setAttribute('data-theme', state.theme);
    updateThemeButtonIcon();
    
    // 应用列表视图状态
    elements.listToggle.classList.toggle('active', state.listView);
    document.getElementById('fateContainer').classList.toggle('list-view', state.listView);
    
    // 应用隐藏已完成状态
    elements.hideCompletedBtn.classList.toggle('active', state.hideCompleted);
    updateHideButtonIcon();

    // 应用快速筛选按钮状态
    const timeLimitBtn = document.getElementById('timeLimitBtn');
    if (timeLimitBtn) {
      timeLimitBtn.classList.toggle('active', state.quickFilters.timeLimit);
    }
    
    const runeBtn = document.getElementById('runeBtn');
    if (runeBtn) {
      runeBtn.classList.toggle('active', state.quickFilters.rune);
    }
    
    const luckyBtn = document.getElementById('luckyBtn');
    if (luckyBtn) {
      luckyBtn.classList.toggle('active', state.quickFilters.lucky);
    }
    
    const highRiskBtn = document.getElementById('highRiskBtn');
    if (highRiskBtn) {
      highRiskBtn.classList.toggle('active', state.quickFilters.highRisk);
    }

    const timeBtn = document.getElementById('timeBtn');
    if (timeBtn) {
      timeBtn.classList.toggle('active', state.quickFilters.time);
    }
    
    const weatherBtn = document.getElementById('weatherBtn');
    if (weatherBtn) {
      weatherBtn.classList.toggle('active', state.quickFilters.weather);
    }

    // 应用筛选面板状态
    // 无筛选界面
  }

  function persistCompleted() {
    try { 
      // 保存所有类型的已完成目标（倒计时列表和全部FATE列表）
      const completedArray = Array.from(state.completedGoals);
      localStorage.setItem('mcfate-completed-goals', JSON.stringify(completedArray)); 
      
      // 记录保存的数据数量（用于调试）
      console.log(`已保存 ${completedArray.length} 个已完成目标记录`);
    } catch (e) {
      console.warn('保存已完成目标失败:', e);
    }
    // 更新已完成目标统计
    updateCompletionCount();
  }

  // 保存快速筛选状态
  function persistQuickFilters() {
    try {
      localStorage.setItem('mcfate-quick-filters', JSON.stringify(state.quickFilters));
    } catch (e) {
      console.warn('保存快速筛选状态失败:', e);
    }
  }

  // 更新主题按钮图标
  function updateThemeButtonIcon() {
    const icon = elements.themeToggle.querySelector('.theme-icon');
    if (state.theme === 'light') {
      icon.src = './assets/icons/button/light.png';
      icon.alt = '白天';
      elements.themeToggle.title = '切换到夜晚模式';
    } else {
      icon.src = './assets/icons/button/dark.png';
      icon.alt = '夜晚';
      elements.themeToggle.title = '切换到白天模式';
    }
  }

  // 更新隐藏按钮图标
  function updateHideButtonIcon() {
    const icon = elements.hideCompletedBtn.querySelector('.hide-icon');
    if (state.hideCompleted) {
      icon.src = './assets/icons/button/hide.png';
      icon.alt = '隐藏已完成';
      elements.hideCompletedBtn.title = '隐藏已完成';
    } else {
      icon.src = './assets/icons/button/present.png';
      icon.alt = '显示已完成';
      elements.hideCompletedBtn.title = '显示已完成';
    }
  }

  // 设置事件监听器
  function setupEventListeners() {

    // 主题切换
    elements.themeToggle.addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      document.body.setAttribute('data-theme', state.theme);
      updateThemeButtonIcon();
      localStorage.setItem('mcfate-theme', state.theme);
    });

    // 列表视图切换
    elements.listToggle.addEventListener('click', () => {
      state.listView = !state.listView;
      elements.listToggle.classList.toggle('active', state.listView);
      document.getElementById('fateContainer').classList.toggle('list-view', state.listView);
      localStorage.setItem('mcfate-list-view', state.listView);
      // 重新渲染列表
      renderFateList();
    });

    // 隐藏已完成切换
    elements.hideCompletedBtn.addEventListener('click', () => {
      state.hideCompleted = !state.hideCompleted;
      elements.hideCompletedBtn.classList.toggle('active', state.hideCompleted);
      localStorage.setItem('mcfate-hide-completed', state.hideCompleted);
      updateHideButtonIcon();
      // 重新渲染列表
      renderFateList();
    });

    // 设置按钮
    if (elements.settingsToggle) {
      elements.settingsToggle.addEventListener('click', () => {
        // 设置菜单：导出 / 导入（垂直排列，纯色底，高层级）
        const menu = document.createElement('div');
        menu.style.position = 'fixed';
        menu.style.top = '72px';
        menu.style.right = '18px';
        // 纯色底：使用主题主色，不透明
        menu.style.background = 'var(--color-primary)';
        menu.style.opacity = '1';
        menu.style.backdropFilter = 'none';
        menu.style.border = '2px solid var(--color-border-main)';
        menu.style.borderRadius = '12px';
        menu.style.boxShadow = '0 14px 34px rgba(0,0,0,.28)';
        menu.style.padding = '12px';
        menu.style.zIndex = '2147483647';
        menu.style.minWidth = '180px';
        menu.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:10px;">
            <button id="mcf-export" class="btn btn-primary">导出本地数据</button>
            <button id="mcf-import" class="btn btn-secondary">导入本地数据</button>
          </div>
        `;
        document.body.appendChild(menu);
        const close = () => menu.remove();
        setTimeout(() => document.addEventListener('click', (ev) => {
          if (!menu.contains(ev.target) && ev.target !== elements.settingsToggle) close();
        }, { once: true }), 0);
        menu.querySelector('#mcf-export').onclick = () => { exportLocalData(); close(); };
        menu.querySelector('#mcf-import').onclick = () => { const f = document.getElementById('importDataInput'); if (f) f.click(); close(); };
      });
    }

    // 导入文件输入
    const importInput = document.getElementById('importDataInput');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) importLocalData(file);
        importInput.value = '';
      });
    }

    // 快速筛选按钮事件监听器
    const timeLimitBtn = document.getElementById('timeLimitBtn');
    if (timeLimitBtn) {
      timeLimitBtn.addEventListener('click', () => {
        state.quickFilters.timeLimit = !state.quickFilters.timeLimit;
        timeLimitBtn.classList.toggle('active', state.quickFilters.timeLimit);
        // 重置其他筛选按钮
        resetOtherQuickFilters('timeLimit');
        persistQuickFilters();
        updateFilterCompletionCount();
        renderFateList();
      });
    }

    const runeBtn = document.getElementById('runeBtn');
    if (runeBtn) {
      runeBtn.addEventListener('click', () => {
        state.quickFilters.rune = !state.quickFilters.rune;
        runeBtn.classList.toggle('active', state.quickFilters.rune);
        // 重置其他筛选按钮
        resetOtherQuickFilters('rune');
        persistQuickFilters();
        updateFilterCompletionCount();
        renderFateList();
      });
    }

    const luckyBtn = document.getElementById('luckyBtn');
    if (luckyBtn) {
      luckyBtn.addEventListener('click', () => {
        state.quickFilters.lucky = !state.quickFilters.lucky;
        luckyBtn.classList.toggle('active', state.quickFilters.lucky);
        // 重置其他筛选按钮
        resetOtherQuickFilters('lucky');
        persistQuickFilters();
        updateFilterCompletionCount();
        renderFateList();
      });
    }

    const highRiskBtn = document.getElementById('highRiskBtn');
    if (highRiskBtn) {
      highRiskBtn.addEventListener('click', () => {
        state.quickFilters.highRisk = !state.quickFilters.highRisk;
        highRiskBtn.classList.toggle('active', state.quickFilters.highRisk);
        // 重置其他筛选按钮
        resetOtherQuickFilters('highRisk');
        persistQuickFilters();
        updateFilterCompletionCount();
        renderFateList();
      });
    }

    const timeBtn = document.getElementById('timeBtn');
    if (timeBtn) {
      timeBtn.addEventListener('click', () => {
        state.quickFilters.time = !state.quickFilters.time;
        timeBtn.classList.toggle('active', state.quickFilters.time);
        // 重置其他筛选按钮
        resetOtherQuickFilters('time');
        persistQuickFilters();
        updateFilterCompletionCount();
        renderFateList();
      });
    }

    const weatherBtn = document.getElementById('weatherBtn');
    if (weatherBtn) {
      weatherBtn.addEventListener('click', () => {
        state.quickFilters.weather = !state.quickFilters.weather;
        weatherBtn.classList.toggle('active', state.quickFilters.weather);
        // 重置其他筛选按钮
        resetOtherQuickFilters('weather');
        persistQuickFilters();
        updateFilterCompletionCount();
        renderFateList();
      });
    }

    // 统计显示模式切换按钮
    const completionToggleBtn = document.getElementById('completionToggleBtn');
    if (completionToggleBtn) {
      completionToggleBtn.addEventListener('click', () => {
        state.completionDisplayMode = !state.completionDisplayMode;
        localStorage.setItem('mcfate-completion-display-mode', state.completionDisplayMode);
        updateCompletionCount();
      });
    }

    const filterCompletionToggleBtn = document.getElementById('filterCompletionToggleBtn');
    if (filterCompletionToggleBtn) {
      filterCompletionToggleBtn.addEventListener('click', () => {
        state.filterCompletionDisplayMode = !state.filterCompletionDisplayMode;
        localStorage.setItem('mcfate-filter-completion-display-mode', state.filterCompletionDisplayMode);
        updateFilterCompletionCount();
      });
    }

    // 无筛选事件

    // 黄底"目标区域"仅用于显示危命目标弹窗，不做标记
    // 标记已完成的交互统一放在左侧白底"标题栏"

    // 点击左侧白底"标题栏"：对该FATE下的所有目标批量切换
    elements.fateList.addEventListener('click', (ev) => {
      const header = ev.target.closest('.fate-header-info');
      if (!header) return;
      // 防止在黄色块区域（目标块）触发
      if (ev.target.closest('.goal-block')) return;
      const item = header.closest('.fate-item');
      if (!item) return;
      const goals = Array.from(item.querySelectorAll('.goal-block'));
      if (goals.length === 0) return;
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
      // 显示加载状态
      if (elements.fateList) {
        elements.fateList.innerHTML = `
          <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>正在加载FATE数据...</p>
          </div>
        `;
      }
      
      // 并行加载两个数据文件以提高速度
      const [specialResponse, allResponse] = await Promise.all([
        fetch('./src/fate_data.json', {
          cache: 'force-cache', // 使用缓存以提高加载速度
          headers: {
            'Cache-Control': 'max-age=3600' // 缓存1小时
          }
        }),
        fetch('./src/fate_common_data.json', {
          cache: 'force-cache',
          headers: {
            'Cache-Control': 'max-age=3600'
          }
        })
      ]);
      
      if (!specialResponse.ok) throw new Error('Failed to load special FATE data');
      if (!allResponse.ok) throw new Error('Failed to load all FATE data');
      
      // 并行解析JSON
      const [fateData, allFateData] = await Promise.all([
        specialResponse.json(),
        allResponse.json()
      ]);
      
      state.fateData = fateData;
      state.allFateData = allFateData;
      
      populateMapSelect();
      resetListOrderCache();
      renderFateList();
      // 初始化已完成目标统计
      updateCompletionCount();
      // 初始化筛选区域完成度统计
      updateFilterCompletionCount();
      
    } catch (error) {
      console.error('Error loading FATE data:', error);
      if (elements.fateList) {
        elements.fateList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>无法加载FATE数据，请检查网络连接后刷新页面</p>
          </div>
        `;
      }
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
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    
    if (days > 0) {
      return `${days}天${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
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
  function getWeatherRequirementCountdown(mapName, requirement, isAppearance = false) {
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
            const text = isAppearance ? `距离出现还有 ${formatMsFull(ms)}` : `距离可完成还有 ${formatMsFull(ms)}`;
            return { active: false, msLeft: ms, text };
          }
          t += EORZEA_8_HOUR_MS; guard++;
        }
      }
      const text = isAppearance ? `可完成剩余时间 ${formatMsFull(msLeft)}` : `可完成剩余时间 ${formatMsFull(msLeft)}`;
      return { active: true, msLeft, text };
    }

    // 查找下一个满足的天气区间
    let t = currentStart + EORZEA_8_HOUR_MS;
    let guard = 0;
    while (guard < 2000) {
      const w = pickWeatherByValue(zoneKey, calculateWeatherValue(t));
      if (allowWeathers.includes(w.name)) {
        const msLeft = Math.max(0, t - now);
        const text = isAppearance ? `距离出现还有 ${formatMsFull(msLeft)}` : `距离可完成还有 ${formatMsFull(msLeft)}`;
        return { active: false, msLeft, text };
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
  function getTimeRequirementCountdown(requirement, isAppearance = false) {
    if (!requirement) return { active: false, msLeft: 0, text: '未知' };
    const now = Date.now();
    const bell = Math.floor(now / EORZEA_HOUR_MS) % 24;
    const minute = Math.floor((now % EORZEA_HOUR_MS) / EORZEA_MINUTE_MS);
    const curMin = bell * 60 + minute;
    const inDay = curMin >= 360 && curMin < 1080; // 6:00-18:00

    if (requirement.includes('白天')) {
      if (inDay) {
        const msLeft = (1080 - curMin) * EORZEA_MINUTE_MS;
        const text = isAppearance ? `可完成剩余时间 ${formatMsFull(msLeft)}` : `可完成剩余时间 ${formatMsFull(msLeft)}`;
        return { active: true, msLeft, text };
      }
      // 距离下一个白天6:00
      const msLeft = msToEtTime(6, 0);
      const text = isAppearance ? `距离出现还有 ${formatMsFull(msLeft)}` : `距离可完成还有 ${formatMsFull(msLeft)}`;
      return { active: false, msLeft, text };
    }

    if (requirement.includes('夜晚')) {
      const inNight = !inDay; // 18:00-次日6:00
      if (inNight) {
        // 到下一个6:00结束
        const endMin = curMin < 360 ? 360 : 1440; // 当前是00:00-06:00 -> 6:00， 否则到24:00
        const msLeft = (endMin - curMin) * EORZEA_MINUTE_MS;
        const text = isAppearance ? `可完成剩余时间 ${formatMsFull(msLeft)}` : `可完成剩余时间 ${formatMsFull(msLeft)}`;
        return { active: true, msLeft, text };
      }
      // 距离18:00
      const msLeft = msToEtTime(18, 0);
      const text = isAppearance ? `距离出现还有 ${formatMsFull(msLeft)}` : `距离可完成还有 ${formatMsFull(msLeft)}`;
      return { active: false, msLeft, text };
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
    // 兼容 "11:10 - 12:10" 一行写法
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
    return { active: false, msLeft: nextStartMs, text: `距离出现还有 ${formatMsFull(nextStartMs)}` };
  }

  // 出现时间窗口 + 指定出现天气 的综合倒计时（例如：乌合之众）
  function getAppearanceWithWeatherCountdown(mapName, appearStr, disappearStr, appearWeatherStr, extraTimeReq = '', extraWeatherStr = '') {

    
    const zoneKey = MAP_NAMES[mapName];
    if (!zoneKey) {
      return null;
    }
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

    // 特殊处理：如果只有出现天气条件，没有目标需求，需要计算时间窗口内的天气
    if (appearWeatherKeys.length > 0 && extraWeatherKeys.length === 0 && !extraTimeReq && appear && disappear) {
      // 这种情况是"乌合之众"模式：只有出现时间窗口+出现天气，没有目标需求
      // 需要计算在时间窗口内什么时候会出现指定天气
      const now = Date.now();
      


      // 查找未来本地时间3天内的所有艾欧泽亚时间窗口
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000; // 3天的毫秒数
      const endTime = now + threeDaysMs;
      
      // 从当前时间开始，每次增加一个艾欧泽亚天，直到超过3天
      let currentTime = now;
      let dayCount = 0;
      
      while (currentTime < endTime && dayCount < 100) { // 防止无限循环
        // 计算当前艾欧泽亚天的ET 8:00开始的天气区间
        const et8Start = currentTime + msToEtTime(8, 0); // ET 8:00对应的真实时间
        const et8End = et8Start + EORZEA_8_HOUR_MS; // ET 16:00
        
        // 检查ET 8:00-16:00区间的天气
        const weather = pickWeatherByValue(zoneKey, calculateWeatherValue(et8Start));
        

        
        // 如果ET 8:00-16:00区间是阴云天气，那么11:10-12:10就在这个区间内
        if (allowWeatherSet.has(weather.name)) {
          // 计算11:10-12:10在真实时间中的位置
          // 注意：这里应该基于et8Start来计算，而不是currentTime
          const windowStart = et8Start + (11 * 60 + 10) * EORZEA_MINUTE_MS; // ET 11:10
          const windowEnd = et8Start + (12 * 60 + 10) * EORZEA_MINUTE_MS;   // ET 12:10
          

          
          // 如果当前时间在11:10-12:10区间内
          if (now >= windowStart && now < windowEnd) {
            const msLeft = windowEnd - now;
            return { active: true, msLeft, text: `可完成剩余时间 ${formatMsFull(msLeft)}` };
          }
          
          // 如果当前时间在11:10-12:10区间之前
          if (now < windowStart) {
            const msLeft = windowStart - now;
            return { active: false, msLeft, text: `距离出现还有 ${formatMsFull(msLeft)}` };
          }
        }
        
        // 移动到下一个艾欧泽亚天
        currentTime += EORZEA_DAY_MS;
        dayCount++;
      }
      
      return { active: false, msLeft: 0, text: '等待中' };
    }

    if (!appear && !disappear) {
      // 没有出现时间窗口：只计算天气或时间目标的倒计时
      const weatherStr = (extraWeatherStr || appearWeatherStr || '').trim();
      if (weatherStr) {
        // 如果有出现天气要求，使用出现倒计时格式
        if (appearWeatherStr) {
          return getWeatherRequirementCountdown(mapName, weatherStr, true);
        }
        // 否则使用目标倒计时格式
        return getWeatherRequirementCountdown(mapName, weatherStr);
      }
      if (extraTimeReq) {
        // 如果有出现时间要求，使用出现倒计时格式
        if (appearStr || disappearStr) {
          return getTimeRequirementCountdown(extraTimeReq, true);
        }
        // 否则使用目标倒计时格式
        return getTimeRequirementCountdown(extraTimeReq);
      }
      return { active: false, msLeft: 0, text: '等待中' };
    }

    // 简化逻辑：有出现天气或出现时间的FATE只计算出现倒计时
    if (appearWeatherKeys.length > 0) {
      // 有出现天气要求，计算天气倒计时
      return getWeatherRequirementCountdown(mapName, appearWeatherStr, true);
    }
    
    if (appear && disappear) {
      // 有出现时间窗口，计算时间窗口倒计时
      return getAppearanceWindowCountdown(appearStr, disappearStr);
    }
    
    return { active: false, msLeft: 0, text: '等待中' };
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
    let tCursor = currentStart + EORZEA_8_HOUR_MS; // 从"下一个"8h区间开始搜索，避免出现 00:00:00 的边界卡住
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

    // 更新已完成目标统计
    updateCompletionCount();
  }

  // 更新已完成目标统计
  function updateCompletionCount() {
    if (!state.allFateData) return;
    
    const completionLabelElement = document.getElementById('completionLabel');
    const completionElement = document.getElementById('completionCount');
    
    if (state.completionDisplayMode) {
      // 目标模式
      let totalGoals = 0;
      let completedGoals = 0;
      
      // 使用全部FATE数据进行统计，每个FATE有4个目标
      state.allFateData.forEach(fate => {
        totalGoals += 4; // 每个FATE固定4个目标
        
        // 检查每个目标的完成状态
        for (let idx = 0; idx < 4; idx++) {
          const listGoalKey = `${fate.地图}|${fate.名称}|list-goal|${idx}`;
          if (state.completedGoals.has(listGoalKey)) {
            completedGoals++;
          }
        }
      });
      
      if (completionLabelElement) completionLabelElement.textContent = '已完成目标：';
      if (completionElement) completionElement.textContent = `${completedGoals}/${totalGoals}`;
    } else {
      // FATE模式
      let totalFates = state.allFateData.length;
      let completedFates = 0;
      
      // 统计已完成的FATE数量（4个目标都完成的FATE）
      state.allFateData.forEach(fate => {
        let allGoalsCompleted = true;
        for (let idx = 0; idx < 4; idx++) {
          const listGoalKey = `${fate.地图}|${fate.名称}|list-goal|${idx}`;
          if (!state.completedGoals.has(listGoalKey)) {
            allGoalsCompleted = false;
            break;
          }
        }
        if (allGoalsCompleted) {
          completedFates++;
        }
      });
      
      if (completionLabelElement) completionLabelElement.textContent = '已完成FATE：';
      if (completionElement) completionElement.textContent = `${completedFates}/${totalFates}`;
    }
    
    // 更新筛选区域完成度统计
    updateFilterCompletionCount();
  }

  // 更新筛选区域完成度统计
  function updateFilterCompletionCount() {
    if (!state.allFateData) return;
    
    const filterCompletionLabelElement = document.getElementById('filterCompletionLabel');
    const filterCompletionElement = document.getElementById('filterCompletionCount');
    
    if (state.filterCompletionDisplayMode) {
      // 目标模式
      let totalFilterGoals = 0;
      let completedFilterGoals = 0;
      
      // 只统计当前筛选地图的FATE
      state.allFateData.forEach(fate => {
        // 检查地图是否在筛选范围内
        if (filterState.maps[fate.地图]) {
          totalFilterGoals += 4; // 每个FATE固定4个目标
          
          // 检查每个目标的完成状态
          for (let idx = 0; idx < 4; idx++) {
            const listGoalKey = `${fate.地图}|${fate.名称}|list-goal|${idx}`;
            if (state.completedGoals.has(listGoalKey)) {
              completedFilterGoals++;
            }
          }
        }
      });
      
      if (filterCompletionLabelElement) filterCompletionLabelElement.textContent = '筛选区域完成度：';
      if (filterCompletionElement) filterCompletionElement.textContent = `${completedFilterGoals}/${totalFilterGoals}`;
    } else {
      // FATE模式
      let totalFilterFates = 0;
      let completedFilterFates = 0;
      
      // 只统计当前筛选地图的FATE
      state.allFateData.forEach(fate => {
        // 检查地图是否在筛选范围内
        if (filterState.maps[fate.地图]) {
          totalFilterFates++;
          
          // 检查FATE是否所有目标都完成
          let allGoalsCompleted = true;
          for (let idx = 0; idx < 4; idx++) {
            const listGoalKey = `${fate.地图}|${fate.名称}|list-goal|${idx}`;
            if (!state.completedGoals.has(listGoalKey)) {
              allGoalsCompleted = false;
              break;
            }
          }
          if (allGoalsCompleted) {
            completedFilterFates++;
          }
        }
      });
      
      if (filterCompletionLabelElement) filterCompletionLabelElement.textContent = '筛选FATE完成度：';
      if (filterCompletionElement) filterCompletionElement.textContent = `${completedFilterFates}/${totalFilterFates}`;
    }
  }

  // 筛选FATE数据
  function filterFateData() {
    if (!state.fateData) return [];
    
    let filteredFates = state.fateData.filter(fate => {
      // 检查搜索关键词
      if (searchKeyword) {
        const nameMatch = fate.名称.toLowerCase().includes(searchKeyword);
        const mapMatch = fate.地图.toLowerCase().includes(searchKeyword);
        const goalMatch = (fate.目标需求天气 || '').toLowerCase().includes(searchKeyword) ||
                         (fate.目标需求时间 || '').toLowerCase().includes(searchKeyword) ||
                         (fate.危命目标 || '').toLowerCase().includes(searchKeyword);
        
        if (!nameMatch && !mapMatch && !goalMatch) {
          return false;
        }
      }
      
      // 检查地图筛选
      if (!filterState.maps[fate.地图]) {
        return false;
      }
      
      // 检查完成状态筛选
      // 需要检查该FATE的所有目标是否都已完成
      const goals = [];
      
      // 组装目标集合（与renderFateList中的逻辑一致）
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

      // 若没有任何目标，则也添加一个普通条目
      if (goals.length === 0) {
        goals.push({});
      }
      

      
      // 检查每个目标的完成状态
      const allCompleted = goals.every((g, idx) => {
        const goalKey = `${fate.地图}|${fate.名称}|goal|${idx}|${g.weatherReq || ''}|${g.timeReq || ''}`;
        return state.completedGoals.has(goalKey);
      });
      
      const hasUncompleted = goals.some((g, idx) => {
        const goalKey = `${fate.地图}|${fate.名称}|goal|${idx}|${g.weatherReq || ''}|${g.timeReq || ''}`;
        return !state.completedGoals.has(goalKey);
      });
      
      // 如果只显示已完成，但FATE有未完成的目标，则过滤掉
      if (filterState.completion['已完成'] && !filterState.completion['未完成'] && hasUncompleted) {
        return false;
      }
      
      // 如果只显示未完成，但FATE所有目标都已完成，则过滤掉
      if (filterState.completion['未完成'] && !filterState.completion['已完成'] && allCompleted) {
        return false;
      }
      
      return true;
    });

    // 如果启用了隐藏已完成，则过滤掉已完成的FATE
    if (state.hideCompleted && !state.listView) {
      filteredFates = filteredFates.filter(fate => {
        // 组装目标集合
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

        // 若没有任何目标，则也添加一个普通条目
        if (goals.length === 0) {
          goals.push({});
        }

        // 检查是否所有目标都已完成
        const allCompleted = goals.every((g, idx) => {
          const goalKey = `${fate.地图}|${fate.名称}|goal|${idx}|${g.weatherReq || ''}|${g.timeReq || ''}`;
          return state.completedGoals.has(goalKey);
        });

        // 返回未完成的FATE
        return !allCompleted;
      });
    }

    return filteredFates;
  }

  // 渲染FATE列表
  function renderFateList() {
    // 如果是列表视图，使用全部FATE数据
    if (state.listView) {
      if (!state.allFateData || state.allFateData.length === 0) {
        elements.fateList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>无法加载全部FATE数据</p>
          </div>
        `;
        return;
      }
      // 列表视图：使用全部FATE数据，renderListView内部会处理筛选和隐藏
      renderListView(state.allFateData);
      // 根据是否启用隐藏，决定是否让容器高度收缩
      document.getElementById('fateContainer').classList.toggle('shrink-list', !!state.hideCompleted);
      return;
    }

    // 倒计时列表：使用筛选后的特殊FATE数据
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

      // 组装"目标"集合，并在渲染时将"出现条件"并入每个目标的倒计时计算
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
        
        // 只对有意义的配置进行倒计时计算
        const hasMeaningfulConfig = (appearStart && appearEnd) || g.weatherReq || g.timeReq || appearWeather;
        let cd = null;
        
        if (!isCompleted && hasMeaningfulConfig) {

          
          cd = getAppearanceWithWeatherCountdown(
            fate.地图,
            appearStart,
            appearEnd,
            appearWeather,
            g.timeReq || '',
            g.weatherReq || ''
          );
          

        }

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
        // 目标标签：天气 与 白天/夜晚；若同时存在，用"{天气}的{时间}"
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

    // 倒计时列表：若启用隐藏，直接从DOM中移除已完成的条目
    const visibleHtml = state.hideCompleted ? items.filter(i => !i.isCompleted).map(i => i.html).join('') : items.map(i => i.html).join('');
    elements.fateList.innerHTML = visibleHtml;

    // 根据是否启用隐藏，决定是否让容器高度收缩
    document.getElementById('fateContainer').classList.toggle('shrink-list', !!state.hideCompleted);

    // 绑定"目标"详情弹窗（点击整行"目标"区域，不影响完成标记）
    const bindShowGoals = (triggerEl) => {
      // 若当前已打开，且点击同一触发元素，则切换为关闭
      if (currentGoalPopover && currentGoalPopoverAnchor === triggerEl) {
        hideGoalPopover();
        return;
      }
      const itemEl = triggerEl.closest('.fate-item');
      if (!itemEl) return;
      const nameEl = itemEl.querySelector('.fate-name');
      const locEl = itemEl.querySelector('.fate-location');
      const name = nameEl ? nameEl.textContent.trim() : '';
      const mapText = locEl ? (locEl.textContent || '').split('-')[0].trim() : '';
      const fate = state.fateData.find(f => f.名称 === name && (f.地图 && mapText && f.地图.indexOf(mapText) !== -1));
      if (!fate) return;
      showGoalPopover(triggerEl, fate);
    };

    elements.fateList.querySelectorAll('.goal-line.goal-detail-trigger').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); bindShowGoals(el); });
    });
    // 保障：点击整个黄色块也只显示弹窗，不触发标记
    elements.fateList.querySelectorAll('.goal-block').forEach(block => {
      block.addEventListener('click', (e) => { e.stopPropagation(); bindShowGoals(block); });
    });
  }

  // 时钟更新函数
  function updateClock() {
    const eorzeaTimeElement = document.getElementById('eorzeaTimeValue');
    const localTimeElement = document.getElementById('localTimeValue');
    
    if (eorzeaTimeElement && localTimeElement) {
      // 更新本地时间
      const now = new Date();
      const localTime = now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      localTimeElement.textContent = localTime;

      // 更新艾欧泽亚时间
      const eorzeaTime = calculateEorzeaTime(now);
      eorzeaTimeElement.textContent = eorzeaTime;
    }
  }

  // 计算艾欧泽亚时间
  function calculateEorzeaTime(realTime) {
    // 使用与主内容区域相同的艾欧泽亚时间计算方法
    const eorzeaTime = getEorzeaTime(realTime.getTime());
    return formatEorzeaTime(eorzeaTime.bell, eorzeaTime.minute);
  }

  // 设置定时更新
  function setupPeriodicUpdates() {
    // 每秒更新时钟
    updateClock();
    setInterval(updateClock, 1000);
    
    // 每秒更新当前状态
    setInterval(updateCurrentStatus, 1000);
    
    // 每秒更新FATE列表以刷新倒计时
    setInterval(renderFateList, 1000);
    
  }

  // 筛选功能
  let filterState = {
    maps: {
      '西萨纳兰': true,
      '中萨纳兰': true,
      '东萨纳兰': true,
      '南萨纳兰': true,
      '北萨纳兰': true,
      '乌尔达哈': true,
      '黑衣森林中部林区': true,
      '黑衣森林东部林区': true,
      '黑衣森林南部林区': true,
      '黑衣森林北部林区': true,
      '格里达尼亚': true,
      '中拉诺西亚': true,
      '拉诺西亚低地': true,
      '东拉诺西亚': true,
      '西拉诺西亚': true,
      '拉诺西亚高地': true,
      '拉诺西亚外地': true,
      '利姆萨·罗敏萨': true,
      '库尔札斯中央高地': true,
      '摩杜纳': true
    },
    completion: {
      '未完成': true,
      '已完成': true
    }
  };

  // 地区分组配置
  const regionGroups = {
    '萨纳兰': ['西萨纳兰', '中萨纳兰', '东萨纳兰', '南萨纳兰', '北萨纳兰', '乌尔达哈'],
    '黑衣森林': ['黑衣森林中部林区', '黑衣森林东部林区', '黑衣森林南部林区', '黑衣森林北部林区', '格里达尼亚'],
    '拉诺西亚': ['中拉诺西亚', '拉诺西亚低地', '东拉诺西亚', '西拉诺西亚', '拉诺西亚高地', '拉诺西亚外地', '利姆萨·罗敏萨'],
    '伊修加德': ['库尔札斯中央高地'],
    '其他': ['摩杜纳']
  };

  // 搜索关键词
  let searchKeyword = '';

  // 保存筛选状态到localStorage
  function saveFilterState() {
    try {
      localStorage.setItem('mcfate-filter-state', JSON.stringify(filterState));
    } catch (e) {
      console.warn('保存筛选状态失败:', e);
    }
  }

  // 从localStorage加载筛选状态
  function loadFilterState() {
    try {
      const saved = localStorage.getItem('mcfate-filter-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 合并保存的状态，确保新添加的地图也有默认值
        filterState.maps = { ...filterState.maps, ...parsed.maps };
        filterState.completion = { ...filterState.completion, ...parsed.completion };
      }
    } catch (e) {
      console.warn('加载筛选状态失败:', e);
    }
  }

  // 更新筛选按钮的视觉状态
  function updateFilterChips() {
    document.querySelectorAll('.chip').forEach(chip => {
      const key = chip.dataset.key;
      const value = chip.dataset.value;
      
      if (key === 'map') {
        if (filterState.maps[value]) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      } else if (key === 'completion') {
        if (filterState.completion[value]) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      }
    });
  }

  // 批量选择/取消选择地区
  function toggleRegionSelection(region) {
    const maps = regionGroups[region];
    if (!maps) return;
    
    // 检查该地区是否全部选中
    const allSelected = maps.every(map => filterState.maps[map]);
    
    // 如果全部选中，则全部取消；否则全部选中
    maps.forEach(map => {
      filterState.maps[map] = !allSelected;
    });
    
    // 更新视觉状态
    updateFilterChips();
    // 保存状态
    saveFilterState();
    // 更新筛选区域完成度统计
    updateFilterCompletionCount();
    // 重新渲染列表
    renderFateList();
  }

  // 初始化筛选功能
  function initFilter() {
    const filterBtn = document.getElementById('filterBtn');
    const filterDropdown = document.getElementById('filterDropdown');
    const fateSearch = document.getElementById('fateSearch');
    const clearSearch = document.getElementById('clearSearch');

    // 筛选按钮点击事件
    if (filterBtn) {
      filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = filterDropdown.classList.contains('hidden');
        filterDropdown.classList.toggle('hidden');
        // 更新按钮激活状态
        filterBtn.classList.toggle('active', !isHidden);
      });
    }

    // 点击外部关闭筛选框
    document.addEventListener('click', (e) => {
      if (!filterDropdown.contains(e.target) && !filterBtn.contains(e.target)) {
        filterDropdown.classList.add('hidden');
        // 移除按钮激活状态
        filterBtn.classList.remove('active');
      }
    });

    // 搜索功能
    if (fateSearch) {
      fateSearch.addEventListener('input', (e) => {
        searchKeyword = e.target.value.toLowerCase().trim();
        renderFateList(); // 重新渲染列表以应用搜索
        
        // 控制清除按钮的显示
        if (clearSearch) {
          clearSearch.style.display = searchKeyword ? 'flex' : 'none';
        }
      });
    }
    
    // 清除搜索功能
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        if (fateSearch) {
          fateSearch.value = '';
          searchKeyword = '';
          renderFateList(); // 重新渲染列表
          clearSearch.style.display = 'none';
          fateSearch.focus(); // 重新聚焦到搜索框
        }
      });
    }

    // 绑定分组折叠事件
    document.querySelectorAll('.section-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const section = toggle.dataset.section;
        const content = document.getElementById(`section-${section}`);
        const icon = toggle.querySelector('i');
        
        toggle.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
        
        if (toggle.classList.contains('collapsed')) {
          icon.style.transform = 'rotate(-90deg)';
        } else {
          icon.style.transform = 'rotate(0deg)';
        }
      });
    });

    // 绑定筛选选项点击事件
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.key;
        const value = chip.dataset.value;
        
        if (key === 'map') {
          filterState.maps[value] = !filterState.maps[value];
        } else if (key === 'completion') {
          filterState.completion[value] = !filterState.completion[value];
        }
        
        chip.classList.toggle('active');
        saveFilterState(); // 保存筛选状态
        updateFilterCompletionCount(); // 更新筛选区域完成度统计
        renderFateList(); // 重新渲染列表以应用筛选
      });
    });

    // 绑定批量选择按钮事件
    document.querySelectorAll('.section-toggle-all').forEach(btn => {
      btn.addEventListener('click', () => {
        const region = btn.dataset.section;
        toggleRegionSelection(region);
      });
    });
  }

  // 列表视图渲染函数
  function renderListView(fates) {
    // 先进行筛选
    let filteredFates = fates.filter(fate => {
      // 检查搜索关键词
      if (searchKeyword) {
        const nameMatch = fate.名称.toLowerCase().includes(searchKeyword);
        const mapMatch = fate.地图.toLowerCase().includes(searchKeyword);
        const goalMatch = (fate.危命目标 || '').toLowerCase().includes(searchKeyword);
        
        if (!nameMatch && !mapMatch && !goalMatch) {
          return false;
        }
      }
      
      // 检查地图筛选
      if (!filterState.maps[fate.地图]) {
        return false;
      }
      
      // 检查快速筛选
      if (!applyQuickFilters(fate)) {
        return false;
      }
      
      return true;
    });

    if (filteredFates.length === 0) {
      elements.fateList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <p>没有找到符合条件的FATE</p>
        </div>
      `;
      return;
    }

    // 解析危命目标，提取4个目标
    let fateItems = filteredFates.map(fate => {
      const goalsText = String(fate.危命目标 || '').trim();
      const goals = goalsText ? goalsText.split(/\n+/).map(s => s.replace(/^\d+\./, '').trim()).filter(Boolean) : [];
      
      // 确保有4个目标，不足的用空字符串填充
      while (goals.length < 4) {
        goals.push('');
      }
      
      // 检查每个目标的完成状态
      let completedGoals = goals.map((goal, idx) => {
        const goalKey = `${fate.地图}|${fate.名称}|list-goal|${idx}`;
        return {
          text: goal,
          completed: state.completedGoals.has(goalKey),
          key: goalKey,
          originalIndex: idx
        };
      });
      
      // 如果启用了限时筛选，只显示包含时间关键词的目标
      if (state.quickFilters.timeLimit) {
        const timeKeywords = ['10秒', '90秒', '120秒', '180秒', '240秒', '300秒', '600秒'];
        completedGoals = completedGoals.filter(goal => {
          const goalText = goal.text.toLowerCase();
          return timeKeywords.some(keyword => goalText.includes(keyword.toLowerCase()));
        });
      }
      
      // 如果启用了符文筛选，只显示包含"符文"关键词的目标
      if (state.quickFilters.rune) {
        completedGoals = completedGoals.filter(goal => {
          const goalText = goal.text.toLowerCase();
          return goalText.includes('符文');
        });
      }
      
      // 如果启用了幸运筛选，只显示包含"幸运"关键词的目标
      if (state.quickFilters.lucky) {
        completedGoals = completedGoals.filter(goal => {
          const goalText = goal.text.toLowerCase();
          return goalText.includes('幸运');
        });
      }
      
      // 如果启用了高危筛选，只显示包含"高危"关键词的目标
      if (state.quickFilters.highRisk) {
        completedGoals = completedGoals.filter(goal => {
          const goalText = goal.text.toLowerCase();
          return goalText.includes('高危');
        });
      }
      
      // 如果启用了时间筛选，只显示包含"白天/夜晚"关键词的目标
      if (state.quickFilters.time) {
        completedGoals = completedGoals.filter(goal => {
          const goalText = goal.text.toLowerCase();
          return goalText.includes('白天') || goalText.includes('夜晚');
        });
      }
      
      // 如果启用了天气筛选，只显示包含天气相关关键词的目标
      if (state.quickFilters.weather) {
        const weatherKeywords = ['天气', '雨天', '晴天'];
        completedGoals = completedGoals.filter(goal => {
          const goalText = goal.text.toLowerCase();
          return weatherKeywords.some(keyword => goalText.includes(keyword.toLowerCase()));
        });
      }
      
      // 检查是否所有目标都已完成
      const allCompleted = completedGoals.every(g => g.completed);
      
      return {
        fate,
        goals: completedGoals,
        allCompleted
      };
    });

    // 如果启用了隐藏已完成，则过滤掉已完成的FATE和已完成的目标
    if (state.hideCompleted) {
      fateItems = fateItems.filter(item => {
        // 如果所有目标都已完成，隐藏整个FATE
        if (item.allCompleted) {
          return false;
        }
        
        // 过滤掉已完成的目标
        item.goals = item.goals.filter(goal => !goal.completed);
        
        return true;
      });
    }
    
    // 应用已完成/未完成筛选（仅在全部FATE列表中生效）
    if (state.listView) {
      fateItems = fateItems.filter(item => {
        // 如果只显示已完成，但FATE有未完成的目标，则过滤掉
        if (filterState.completion['已完成'] && !filterState.completion['未完成'] && !item.allCompleted) {
          return false;
        }
        
        // 如果只显示未完成，但FATE所有目标都已完成，则过滤掉
        if (filterState.completion['未完成'] && !filterState.completion['已完成'] && item.allCompleted) {
          return false;
        }
        
        return true;
      });
    }
    
    // 排序：按地图、等级从低到高，已完成的放最后
    fateItems.sort((a, b) => {
      // 首先按完成状态排序（未完成的在前）
      if (a.allCompleted !== b.allCompleted) {
        return a.allCompleted ? 1 : -1;
      }
      
      // 然后按地图名称排序
      const mapCompare = a.fate.地图.localeCompare(b.fate.地图);
      if (mapCompare !== 0) return mapCompare;
      
      // 最后按等级从低到高排序
      return (a.fate.等级 || 0) - (b.fate.等级 || 0);
    });
    
    // 生成HTML
    const html = fateItems.map(item => {
      const fate = item.fate;
      const goals = item.goals;
      
      const fateClass = item.allCompleted ? 'fate-item-list completed' : 'fate-item-list';
      
      const goalsHtml = goals.map((goal, idx) => {
        const goalClass = goal.completed ? 'goal-item completed' : 'goal-item';
        const goalText = goal.completed ? `<span class="goal-text-strikethrough">${goal.text}</span>` : goal.text;
        
        return `
          <div class="${goalClass}" data-goal-key="${goal.key}">
            <span class="goal-number">${goal.originalIndex + 1}.</span>
            <span class="goal-text">${goalText}</span>
          </div>
        `;
      }).join('');
      
      return `
        <div class="${fateClass}">
          <div class="fate-header-list" data-fate-key="${fate.地图}|${fate.名称}">
            <div class="fate-name-list">${fate.名称}</div>
            <div class="fate-location-list">
              <i class="fas fa-map-marker-alt"></i>
              ${fate.地图} - 等级 ${fate.等级}
            </div>
          </div>
          <div class="goals-container">
            ${goalsHtml}
          </div>
        </div>
      `;
    }).join('');
    
    elements.fateList.innerHTML = html;
    
    // 绑定事件
    bindListViewEvents();
  }

  // 绑定列表视图事件
  function bindListViewEvents() {
    // 点击FATE名称，标记所有目标为已完成
    document.querySelectorAll('.fate-header-list').forEach(header => {
      header.addEventListener('click', () => {
        const fateKey = header.dataset.fateKey;
        const fateItem = header.closest('.fate-item-list');
        const goals = fateItem.querySelectorAll('.goal-item');
        
        // 检查是否所有目标都已完成
        const allCompleted = Array.from(goals).every(goal => goal.classList.contains('completed'));
        
        // 切换所有目标的完成状态
        goals.forEach(goal => {
          const goalKey = goal.dataset.goalKey;
          if (allCompleted) {
            state.completedGoals.delete(goalKey);
            goal.classList.remove('completed');
            goal.querySelector('.goal-text').innerHTML = goal.querySelector('.goal-text').textContent;
          } else {
            state.completedGoals.add(goalKey);
            goal.classList.add('completed');
            const goalText = goal.querySelector('.goal-text');
            goalText.innerHTML = `<span class="goal-text-strikethrough">${goalText.textContent}</span>`;
          }
        });
        
        // 更新FATE项的完成状态
        if (allCompleted) {
          fateItem.classList.remove('completed');
        } else {
          fateItem.classList.add('completed');
        }
        
        // 保存状态并重新排序
        persistCompleted();
        renderFateList();
      });
    });
    
    // 点击单个目标，切换完成状态
    document.querySelectorAll('.goal-item').forEach(goal => {
      goal.addEventListener('click', (e) => {
        e.stopPropagation(); // 防止触发FATE名称的点击事件
        
        const goalKey = goal.dataset.goalKey;
        const isCompleted = goal.classList.contains('completed');
        
        if (isCompleted) {
          state.completedGoals.delete(goalKey);
          goal.classList.remove('completed');
          goal.querySelector('.goal-text').innerHTML = goal.querySelector('.goal-text').textContent;
        } else {
          state.completedGoals.add(goalKey);
          goal.classList.add('completed');
          const goalText = goal.querySelector('.goal-text');
          goalText.innerHTML = `<span class="goal-text-strikethrough">${goalText.textContent}</span>`;
        }
        
        // 检查FATE是否所有目标都已完成
        const fateItem = goal.closest('.fate-item-list');
        const allGoals = fateItem.querySelectorAll('.goal-item');
        const allCompleted = Array.from(allGoals).every(g => g.classList.contains('completed'));
        
        if (allCompleted) {
          fateItem.classList.add('completed');
        } else {
          fateItem.classList.remove('completed');
        }
        
        // 保存状态并重新排序
        persistCompleted();
        renderFateList();
      });
    });
  }

  // 启动应用
  document.addEventListener('DOMContentLoaded', () => {
    init();
    loadFilterState(); // 加载筛选状态
    initFilter();
    updateFilterChips(); // 更新筛选按钮的视觉状态
    
    // 确保筛选按钮初始状态正确
    const filterBtn = document.getElementById('filterBtn');
    const filterDropdown = document.getElementById('filterDropdown');
    if (filterBtn && filterDropdown) {
      filterBtn.classList.toggle('active', !filterDropdown.classList.contains('hidden'));
    }
  });

})();
