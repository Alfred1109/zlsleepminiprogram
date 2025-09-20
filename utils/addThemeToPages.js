// utils/addThemeToPages.js - 为页面添加主题支持的工具脚本

/**
 * 为页面添加主题支持的通用方法
 * 在页面的onLoad中调用
 */
function addThemeSupport(pageInstance) {
  // 确保页面数据中有主题相关字段
  if (!pageInstance.data) {
    pageInstance.data = {};
  }

  // 添加主题相关数据
  const themeData = {
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null
  };

  // 合并到页面数据中
  Object.assign(pageInstance.data, themeData);

  // 初始化主题
  const initTheme = function() {
    try {
      const app = getApp();
      if (app.globalData && app.globalData.currentTheme) {
        this.setData({
          currentTheme: app.globalData.currentTheme,
          themeClass: app.globalData.themeConfig?.class || '',
          themeConfig: app.globalData.themeConfig
        });
      }
    } catch (error) {
      console.error('初始化主题失败:', error);
    }
  };

  // 主题切换事件处理
  const onThemeChange = function(e) {
    try {
      if (!e || !e.detail) {
        console.error('主题切换事件参数错误:', e);
        return;
      }

      const { theme, config } = e.detail;
      
      if (!theme || !config) {
        console.error('主题切换缺少必要参数:', { theme, config });
        return;
      }

      console.log('页面主题切换到:', theme, config);
      
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

      // 显示主题切换反馈
      wx.showToast({
        title: `已应用${config.name}`,
        icon: 'none',
        duration: 1500
      });
    } catch (error) {
      console.error('页面主题切换处理失败:', error);
    }
  };

  // 添加方法到页面实例
  pageInstance.initTheme = initTheme;
  pageInstance.onThemeChange = onThemeChange;

  // 监听全局主题变化
  const registerGlobalThemeListener = function() {
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

    this.themeChangeHandler = (data) => {
      if (data && data.theme && data.config) {
        this.setData({
          currentTheme: data.theme,
          themeClass: data.config.class || '',
          themeConfig: data.config
        });
      }
    };

    wx.$emitter.on('themeChanged', this.themeChangeHandler);
  };

  pageInstance.registerGlobalThemeListener = registerGlobalThemeListener;

  // 页面卸载时清理监听器
  const originalOnUnload = pageInstance.onUnload;
  pageInstance.onUnload = function() {
    if (wx.$emitter && this.themeChangeHandler) {
      wx.$emitter.off('themeChanged', this.themeChangeHandler);
    }
    if (originalOnUnload) {
      originalOnUnload.call(this);
    }
  };

  return pageInstance;
}

module.exports = {
  addThemeSupport
};
