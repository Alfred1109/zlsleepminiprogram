// 主题切换组件 - 基于色彩心理学的智能主题切换
Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    // 是否显示主题切换器
    showThemeSwitcher: {
      type: Boolean,
      value: true
    },
    // 当前页面类型，用于智能推荐
    pageType: {
      type: String,
      value: 'default'
    }
  },

  data: {
    isVisible: false,
    isPanelVisible: false,
    currentTheme: 'default',
    recommendedTheme: null,
    autoRecommend: false,
    
    // 主题配置
    themeConfig: {
      'default': {
        name: '🌸 默认主题（平静）',
        desc: '蓝绿色调，降低心率',
        class: 'calm-mode',
        colors: {
          primary: '#14B8A6',
          brand: '#10B981',
          healing: '#E0F2F1'
        }
      },
      'calm-mode': {
        name: '🧘 平静模式',
        desc: '蓝绿色调，降低心率',
        class: 'calm-mode',
        colors: {
          primary: '#14B8A6',
          secondary: '#10B981',
          background: '#E0F2F1'
        }
      },
      'energy-mode': {
        name: '⚡ 活力模式',
        desc: '暖橙色调，激发活力',
        class: 'energy-mode',
        colors: {
          primary: '#EA580C',
          secondary: '#F97316',
          background: '#FFF4E6'
        }
      },
      'evening-theme': {
        name: '🌇 暮间主题',
        desc: '柔和紫蓝，准备休息',
        class: 'evening-theme',
        colors: {
          primary: '#3730A3',
          background: '#E0E7FF'
        }
      },
      
    }
  },

  lifetimes: {
    attached() {
      this.initializeTheme();
      this.setupIntelligentRecommendation();
      this.loadAutoRecommend();
      
      // 延迟显示组件，避免影响页面加载
      setTimeout(() => {
        this.setData({ isVisible: true });
      }, 1000);
    },
    detached() {
      this.stopAutoRecommendTimer && this.stopAutoRecommendTimer();
    }
  },

  methods: {
    /**
     * 初始化主题
     */
    initializeTheme() {
      // 从本地存储获取用户偏好主题
      let savedTheme = wx.getStorageSync('user_preferred_theme');
      // 将历史default映射到calm-mode
      if (savedTheme === 'default') savedTheme = 'calm-mode';
      if (savedTheme && this.data.themeConfig[savedTheme]) {
        this.setData({ currentTheme: savedTheme });
        this.applyTheme(savedTheme);
      } else {
        // 根据时间自动推荐主题
        const timeBasedTheme = this.getTimeBasedRecommendation();
        this.setData({ 
          currentTheme: timeBasedTheme,
          recommendedTheme: {
            key: timeBasedTheme,
            name: this.data.themeConfig[timeBasedTheme].name
          }
        });
      }
    },

    /**
     * 设置智能推荐系统
     */
    setupIntelligentRecommendation() {
      // 基于时间的智能推荐
      const hour = new Date().getHours();
      let recommendedTheme = null;

      if (hour >= 6 && hour < 10) {
        // 早晨 6-10点：推荐活力模式
        recommendedTheme = 'energy-mode';
      } else if (hour >= 10 && hour < 14) {
        // 上午 10-14点：推荐平静模式
        recommendedTheme = 'calm-mode';
      } else if (hour >= 14 && hour < 18) {
        // 下午 14-18点：推荐平静模式
        recommendedTheme = 'calm-mode';
      } else if (hour >= 18 && hour < 22) {
        // 傍晚 18-22点：推荐暮间主题
        recommendedTheme = 'evening-theme';
      } else {
        // 夜晚 22-6点：推荐暮间主题
        recommendedTheme = 'evening-theme';
      }

      // 如果推荐主题与当前主题不同，显示推荐
      if (recommendedTheme && recommendedTheme !== this.data.currentTheme) {
        this.setData({
          recommendedTheme: {
            key: recommendedTheme,
            name: this.data.themeConfig[recommendedTheme].name
          }
        });
      }
    },

    /**
     * 加载并应用“智能推荐自动切换”
     */
    loadAutoRecommend() {
      try {
        const saved = wx.getStorageSync('theme_auto_recommend');
        const enabled = !!saved;
        this.setData({ autoRecommend: enabled });
        if (enabled) {
          this.applyAutoRecommendation(true);
        }
      } catch (_) {}
    },

    /**
     * 切换智能推荐开关
     */
    onAutoRecommendChange(e) {
      const enabled = !!e.detail.value;
      this.setData({ autoRecommend: enabled });
      try { wx.setStorageSync('theme_auto_recommend', enabled); } catch(_) {}
      if (enabled) {
        this.applyAutoRecommendation(true);
      } else {
        this.stopAutoRecommendTimer();
      }
    },

    /**
     * 立即应用一次推荐主题并启动定时器
     */
    applyAutoRecommendation(immediate) {
      if (immediate) {
        const rec = this.getPersonalizedRecommendation();
        if (rec && rec !== this.data.currentTheme) {
          this.setData({ currentTheme: rec });
          this.applyTheme(rec);
        }
      }
      this.startAutoRecommendTimer();
    },

    startAutoRecommendTimer() {
      this.stopAutoRecommendTimer();
      // 每10分钟检查一次
      this._autoTimer = setInterval(() => {
        if (!this.data.autoRecommend) return;
        const rec = this.getPersonalizedRecommendation();
        if (rec && rec !== this.data.currentTheme) {
          this.setData({ currentTheme: rec });
          this.applyTheme(rec);
          try { wx.setStorageSync('user_preferred_theme', rec); } catch(_) {}
        }
      }, 600000);
    },

    stopAutoRecommendTimer() {
      if (this._autoTimer) {
        clearInterval(this._autoTimer);
        this._autoTimer = null;
      }
    },

    /**
     * 获取基于时间的主题推荐
     */
    getTimeBasedRecommendation() {
      const hour = new Date().getHours();
      
      if (hour >= 6 && hour < 12) return 'energy-mode';
      if (hour >= 12 && hour < 18) return 'calm-mode';
      if (hour >= 18 && hour < 24) return 'evening-theme';
      return 'evening-theme';
    },

    /**
     * 切换主题选择器显示状态
     */
    toggleThemeSwitcher() {
      this.setData({
        isPanelVisible: !this.data.isPanelVisible
      });

      // 触觉反馈
      wx.vibrateShort({
        type: 'light'
      });
    },

    /**
     * 切换播放器显示状态
     */
    togglePlayer() {
      // 触觉反馈
      wx.vibrateShort({
        type: 'light'
      });

      // 触发播放器切换事件，让父页面处理
      this.triggerEvent('toggleplayer', {
        timestamp: Date.now()
      });

      console.log('播放器切换事件已触发');
    },

    /**
     * 关闭主题面板
     */
    closeThemePanel() {
      this.setData({
        isPanelVisible: false
      });
    },

    /**
     * 切换主题
     */
    switchTheme(e) {
      const theme = e.currentTarget.dataset.theme;
      if (!theme || theme === this.data.currentTheme) return;

      // 更新当前主题
      this.setData({ 
        currentTheme: theme,
        isPanelVisible: false 
      });

      // 应用主题
      this.applyTheme(theme);

      // 保存用户偏好
      wx.setStorageSync('user_preferred_theme', theme);

      // 触觉反馈
      wx.vibrateShort({
        type: 'medium'
      });

      // 触发主题切换事件，通知父组件
      this.triggerEvent('themechange', {
        theme: theme,
        config: this.data.themeConfig[theme]
      });
    },

    /**
     * 应用主题到页面
     */
    applyTheme(theme) {
      const themeConfig = this.data.themeConfig[theme];
      if (!themeConfig) return;

      try {
        // 使用全局App实例的统一广播方法
        const app = getApp();
        if (app.globalData) {
          app.globalData.currentTheme = theme;
          app.globalData.themeConfig = themeConfig;
          
          // 调用全局广播方法，确保所有页面同步
          if (typeof app.globalData.broadcastThemeChange === 'function') {
            app.globalData.broadcastThemeChange(theme, themeConfig);
          }
        }

        // 更新全局主题变量
        this.updateGlobalThemeVariables(themeConfig);

        console.log('✅ 主题应用成功:', theme, themeConfig);

      } catch (error) {
        console.error('❌ 主题应用失败:', error);
      }
    },

    /**
     * 更新全局主题变量
     */
    updateGlobalThemeVariables(themeConfig) {
      // 这里可以通过动态修改CSS变量来实现主题切换
      // 由于小程序的限制，主要通过类名切换来实现
      
      // 记录主题切换日志，用于用户行为分析
      this.logThemeUsage(themeConfig);
    },

    /**
     * 显示主题切换提示
     */
    showThemeChangeToast(theme) {
      const themeConfig = this.data.themeConfig[theme];
      
      wx.showToast({
        title: `已切换到${themeConfig.name}`,
        icon: 'none',
        duration: 2000,
        mask: false
      });
    },

    /**
     * 记录主题使用情况（用于改进推荐算法）
     */
    logThemeUsage(themeConfig) {
      try {
        // 获取当前使用情况
        const usageLog = wx.getStorageSync('theme_usage_log') || {};
        // 使用ISO格式日期，避免iOS兼容性问题
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式
        const hour = new Date().getHours();

        if (!usageLog[today]) {
          usageLog[today] = {};
        }

        const themeKey = Object.keys(this.data.themeConfig)
          .find(key => this.data.themeConfig[key] === themeConfig);

        if (!usageLog[today][themeKey]) {
          usageLog[today][themeKey] = [];
        }

        usageLog[today][themeKey].push({
          hour: hour,
          timestamp: Date.now(),
          pageType: this.data.pageType
        });

        // 只保留最近7天的数据
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoString = sevenDaysAgo.toISOString().split('T')[0];

        Object.keys(usageLog).forEach(date => {
          // 使用字符串比较，避免Date构造函数兼容性问题
          if (date < sevenDaysAgoString) {
            delete usageLog[date];
          }
        });

        wx.setStorageSync('theme_usage_log', usageLog);
      } catch (error) {
        console.error('主题使用记录失败:', error);
      }
    },

    /**
     * 基于使用历史的智能推荐（高级功能）
     */
    getPersonalizedRecommendation() {
      try {
        const usageLog = wx.getStorageSync('theme_usage_log') || {};
        const currentHour = new Date().getHours();
        
        // 分析用户在当前时间段的主题偏好
        const hourlyPreferences = {};
        
        Object.values(usageLog).forEach(dayLog => {
          Object.keys(dayLog).forEach(theme => {
            dayLog[theme].forEach(usage => {
              if (Math.abs(usage.hour - currentHour) <= 1) {
                hourlyPreferences[theme] = (hourlyPreferences[theme] || 0) + 1;
              }
            });
          });
        });

        // 找到最常用的主题
        const preferredTheme = Object.keys(hourlyPreferences)
          .reduce((a, b) => hourlyPreferences[a] > hourlyPreferences[b] ? a : b);

        return preferredTheme || this.getTimeBasedRecommendation();
      } catch (error) {
        return this.getTimeBasedRecommendation();
      }
    }
  }
});
