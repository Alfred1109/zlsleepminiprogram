// utils/themeMixin.js - 全局主题混入
// 提供统一的主题管理功能给所有页面使用

const themeMixin = {
  data: {
    // 主题相关数据
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null
  },

  onLoad() {
    // 页面加载时初始化主题
    this.initPageTheme();
  },

  onShow() {
    // 页面显示时同步主题状态
    this.syncThemeFromGlobal();
  },

  methods: {
    /**
     * 初始化页面主题
     */
    initPageTheme() {
      try {
        const app = getApp();
        if (app.globalData && app.globalData.currentTheme) {
          this.setData({
            currentTheme: app.globalData.currentTheme,
            themeClass: app.globalData.themeConfig?.class || '',
            themeConfig: app.globalData.themeConfig
          });
        }

        // 注册全局主题变化监听
        this.registerThemeListener();
      } catch (error) {
        console.error('初始化页面主题失败:', error);
      }
    },

    /**
     * 从全局同步主题状态
     */
    syncThemeFromGlobal() {
      try {
        const app = getApp();
        if (app.globalData && app.globalData.currentTheme) {
          const globalTheme = app.globalData.currentTheme;
          const globalConfig = app.globalData.themeConfig;
          
          if (globalTheme !== this.data.currentTheme) {
            this.setData({
              currentTheme: globalTheme,
              themeClass: globalConfig?.class || '',
              themeConfig: globalConfig
            });
          }
        }
      } catch (error) {
        console.error('同步全局主题失败:', error);
      }
    },

    /**
     * 注册全局主题变化监听器
     */
    registerThemeListener() {
      // 初始化全局事件系统
      if (!wx.$emitter) {
        wx.$emitter = {
          listeners: {},
          on(event, callback) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(callback);
          },
          off(event, callback) {
            if (this.listeners[event]) {
              const index = this.listeners[event].indexOf(callback);
              if (index > -1) {
                this.listeners[event].splice(index, 1);
              }
            }
          },
          emit(event, data) {
            if (this.listeners[event]) {
              this.listeners[event].forEach(callback => {
                try {
                  callback(data);
                } catch (error) {
                  console.error('主题监听器执行失败:', error);
                }
              });
            }
          }
        };
      }

      // 监听主题变化事件
      this.themeChangeHandler = (data) => {
        if (data && data.theme && data.config) {
          this.setData({
            currentTheme: data.theme,
            themeClass: data.config.class || '',
            themeConfig: data.config
          });

          // 如果页面有自定义主题变化处理方法，调用它
          if (typeof this.onThemeChange === 'function') {
            this.onThemeChange({
              detail: {
                theme: data.theme,
                config: data.config
              }
            });
          }
        }
      };

      wx.$emitter.on('themeChanged', this.themeChangeHandler);
    },

    /**
     * 应用主题到当前页面
     */
    applyTheme(theme, config) {
      try {
        this.setData({
          currentTheme: theme,
          themeClass: config.class || '',
          themeConfig: config
        });

        // 更新全局状态
        const app = getApp();
        if (app.globalData) {
          app.globalData.currentTheme = theme;
          app.globalData.themeConfig = config;
        }

        // 广播主题变化事件
        if (wx.$emitter) {
          wx.$emitter.emit('themeChanged', { theme, config });
        }

        console.log('✅ 页面主题应用成功:', theme);
      } catch (error) {
        console.error('应用页面主题失败:', error);
      }
    }
  },

  onUnload() {
    // 页面卸载时清理监听器
    if (wx.$emitter && this.themeChangeHandler) {
      wx.$emitter.off('themeChanged', this.themeChangeHandler);
    }
  }
};

module.exports = themeMixin;
