// 主题切换组件 - 基于色彩心理学的智能主题切换
Component({
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
    
    // 主题配置
    themeConfig: {
      'default': {
        name: '🌸 默认主题',
        desc: '温暖平衡的疗愈配色',
        class: '',
        colors: {
          primary: '#C0A9BD',
          brand: '#FF6B35',
          healing: '#7DD3C0'
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
      'focus-mode': {
        name: '🎯 专注模式',
        desc: '深紫色调，提升注意力',
        class: 'focus-mode',
        colors: {
          primary: '#7C3AED',
          secondary: '#8B5CF6',
          background: '#EEE7F4'
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
      'relax-mode': {
        name: '🌿 放松模式',
        desc: '柔和绿调，缓解压力',
        class: 'relax-mode',
        colors: {
          primary: '#22C55E',
          secondary: '#16A34A',
          background: '#F0FDF4'
        }
      },
      'morning-theme': {
        name: '🌅 晨间主题',
        desc: '温暖明亮，模拟日出',
        class: 'morning-theme',
        colors: {
          primary: '#F59E0B',
          background: '#FEF3C7'
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
      'night-theme': {
        name: '🌙 夜间主题',
        desc: '深色护眼，减少蓝光',
        class: 'night-theme',
        colors: {
          primary: '#6366F1',
          background: '#1F2937'
        }
      }
    }
  },

  lifetimes: {
    attached() {
      this.initializeTheme();
      this.setupIntelligentRecommendation();
      
      // 延迟显示组件，避免影响页面加载
      setTimeout(() => {
        this.setData({ isVisible: true });
      }, 1000);
    }
  },

  methods: {
    /**
     * 初始化主题
     */
    initializeTheme() {
      // 从本地存储获取用户偏好主题
      const savedTheme = wx.getStorageSync('user_preferred_theme');
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
        // 早晨 6-10点：推荐活力模式或晨间主题
        recommendedTheme = Math.random() > 0.5 ? 'energy-mode' : 'morning-theme';
      } else if (hour >= 10 && hour < 14) {
        // 上午 10-14点：推荐专注模式
        recommendedTheme = 'focus-mode';
      } else if (hour >= 14 && hour < 18) {
        // 下午 14-18点：推荐平静模式
        recommendedTheme = 'calm-mode';
      } else if (hour >= 18 && hour < 22) {
        // 傍晚 18-22点：推荐放松模式或暮间主题
        recommendedTheme = Math.random() > 0.5 ? 'relax-mode' : 'evening-theme';
      } else {
        // 夜晚 22-6点：推荐夜间主题
        recommendedTheme = 'night-theme';
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
     * 获取基于时间的主题推荐
     */
    getTimeBasedRecommendation() {
      const hour = new Date().getHours();
      
      if (hour >= 6 && hour < 12) return 'morning-theme';
      if (hour >= 12 && hour < 18) return 'default';
      if (hour >= 18 && hour < 22) return 'evening-theme';
      return 'night-theme';
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

      // 显示切换成功提示
      this.showThemeChangeToast(theme);

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
        // 获取页面实例
        const pages = getCurrentPages();
        const currentPage = pages[pages.length - 1];

        if (currentPage) {
          // 移除所有主题类
          const allThemeClasses = Object.values(this.data.themeConfig)
            .map(config => config.class)
            .filter(cls => cls);

          // 获取页面根元素（这里需要根据实际情况调整）
          const pageContainer = currentPage.selectComponent('.container') || 
                               currentPage.selectComponent('.page-container');

          if (pageContainer) {
            // 移除旧主题类，添加新主题类
            allThemeClasses.forEach(cls => {
              pageContainer.removeClass(cls);
            });
            
            if (themeConfig.class) {
              pageContainer.addClass(themeConfig.class);
            }
          }
        }

        // 更新全局主题变量（如果使用CSS变量）
        this.updateGlobalThemeVariables(themeConfig);

      } catch (error) {
        console.error('主题应用失败:', error);
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
        const today = new Date().toDateString();
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

        Object.keys(usageLog).forEach(date => {
          if (new Date(date) < sevenDaysAgo) {
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
