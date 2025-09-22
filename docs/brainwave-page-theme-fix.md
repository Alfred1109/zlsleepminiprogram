# 脑波库页面主题切换修复说明

## 问题描述

脑波库页面（`pages/music/library/library.js`）无法响应跨页面的主题切换，只有在该页面内切换主题时才会生效。

## 根本原因

脑波库页面缺少**全局主题变化监听器**，虽然有 `forceRefreshTheme()` 方法在 `onShow()` 中执行，但没有注册事件监听器来响应其他页面的主题切换。

## 修复内容

### 1. 完善主题初始化逻辑

**修复前：**
```javascript
initTheme() {
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
}
```

**修复后：**
```javascript
initTheme() {
  try {
    // 从全局数据获取当前主题
    const app = getApp()
    const currentTheme = app.globalData.currentTheme || 'default'
    const themeConfig = app.globalData.themeConfig
    
    this.setData({
      currentTheme: currentTheme,
      themeClass: themeConfig?.class || '',
      themeConfig: themeConfig
    })

    // 初始化事件总线
    wx.$emitter = wx.$emitter || {
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

    // 注册全局主题变化监听器 - 关键修复！
    this.themeChangeHandler = (data) => {
      if (data && data.theme && data.config) {
        this.setData({
          currentTheme: data.theme,
          themeClass: data.config?.class || '',
          themeConfig: data.config
        })
        console.log('🎨 脑波库页面主题已更新:', data.theme)
      }
    }

    wx.$emitter.on('themeChanged', this.themeChangeHandler)
    console.log('✅ 脑波库页面主题监听器已注册')

  } catch (error) {
    console.error('初始化主题失败:', error);
  }
}
```

### 2. 新增页面卸载清理逻辑

**新增方法：**
```javascript
/**
 * 页面卸载时清理资源
 */
onUnload() {
  // 清理主题监听器
  if (wx.$emitter && this.themeChangeHandler) {
    wx.$emitter.off('themeChanged', this.themeChangeHandler);
    console.log('🧹 脑波库页面主题监听器已清理');
  }
  
  // 清理播放器
  this.cleanupPlayer();
}
```

## 修复原理

1. **事件总线初始化**：确保 `wx.$emitter` 事件系统正确初始化
2. **监听器注册**：在 `initTheme()` 中注册 `themeChanged` 事件监听器
3. **状态同步**：监听器收到事件后，立即更新页面的主题状态
4. **资源清理**：页面卸载时清理监听器，防止内存泄漏

## 测试方案

### 测试步骤：

1. **进入脑波库页面**
   - 确认页面正常显示当前主题

2. **切换到其他页面（如首页）**
   - 点击主题切换器，更改主题

3. **返回脑波库页面**
   - 确认页面立即应用新主题，无需重新加载

4. **在脑波库页面内切换主题**
   - 确认切换功能正常工作
   - 切换到其他页面验证主题已同步

### 预期结果：

- ✅ 脑波库页面能实时响应跨页面主题切换
- ✅ 页面内主题切换正常工作
- ✅ 控制台显示相应的主题同步日志

## 技术细节

### 关键变化：

1. **添加事件监听器**：`wx.$emitter.on('themeChanged', this.themeChangeHandler)`
2. **防止内存泄漏**：`onUnload()` 中清理监听器
3. **错误处理**：监听器执行时的异常捕获
4. **日志增强**：添加详细的主题同步日志

### 与其他页面保持一致：

现在脑波库页面的主题切换逻辑与首页、个人页面等保持一致，都采用相同的事件监听机制。

## 修复文件

- `pages/music/library/library.js` - 主要修复文件

## 后续优化建议

1. 考虑将主题监听逻辑封装为通用混入（mixin）
2. 统一所有页面的主题初始化流程
3. 添加主题切换动画效果
