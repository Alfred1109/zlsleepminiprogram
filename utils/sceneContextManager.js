// 场景上下文管理器
// 负责管理用户的场景导航状态，区分场景分类入口和底部菜单入口

class SceneContextManager {
  constructor() {
    this.storageKey = 'scene_context'
    this.currentContext = null
    this.listeners = []
    
    // 从存储中恢复状态
    this.restoreFromStorage()
  }

  /**
   * 设置场景上下文
   * @param {Object} context 场景上下文信息
   * @param {number} context.sceneId 场景ID
   * @param {string} context.sceneName 场景名称
   * @param {string} context.scaleType 关联的量表类型
   * @param {string} context.sceneTheme 场景主题
   * @param {string} context.source 来源页面路径
   */
  setSceneContext(context) {
    console.log('🎯 设置场景上下文:', context)
    
    this.currentContext = {
      ...context,
      timestamp: Date.now(),
      active: true
    }
    
    // 保存到本地存储
    this.saveToStorage()
    
    // 通知监听器
    this.notifyListeners('contextSet', this.currentContext)
  }

  /**
   * 清除场景上下文
   */
  clearSceneContext() {
    console.log('🔄 清除场景上下文')
    
    const previousContext = this.currentContext
    this.currentContext = null
    
    // 清除本地存储
    wx.removeStorageSync(this.storageKey)
    
    // 通知监听器
    this.notifyListeners('contextCleared', previousContext)
  }

  /**
   * 获取当前场景上下文
   * @returns {Object|null} 当前场景上下文
   */
  getCurrentContext() {
    // 检查上下文是否过期（24小时）
    if (this.currentContext && this.currentContext.timestamp) {
      const age = Date.now() - this.currentContext.timestamp
      const maxAge = 24 * 60 * 60 * 1000 // 24小时
      
      if (age > maxAge) {
        console.log('⏰ 场景上下文已过期，自动清除')
        this.clearSceneContext()
        return null
      }
    }
    
    return this.currentContext
  }

  /**
   * 检查是否在场景模式下
   * @returns {boolean}
   */
  isInSceneMode() {
    const context = this.getCurrentContext()
    return context && context.active
  }

  /**
   * 获取场景过滤器
   * @returns {Object|null} 场景过滤器信息
   */
  getSceneFilter() {
    const context = this.getCurrentContext()
    if (!context) return null
    
    return {
      sceneId: context.sceneId,
      sceneName: context.sceneName,
      scaleType: context.scaleType,
      sceneTheme: context.sceneTheme
    }
  }

  /**
   * 添加上下文变化监听器
   * @param {Function} listener 监听器函数
   */
  addListener(listener) {
    this.listeners.push(listener)
  }

  /**
   * 移除监听器
   * @param {Function} listener 监听器函数
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * 通知所有监听器
   * @param {string} event 事件类型
   * @param {*} data 事件数据
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data)
      } catch (error) {
        console.error('场景上下文监听器错误:', error)
      }
    })
  }

  /**
   * 保存到本地存储
   */
  saveToStorage() {
    try {
      if (this.currentContext) {
        wx.setStorageSync(this.storageKey, this.currentContext)
      }
    } catch (error) {
      console.error('保存场景上下文失败:', error)
    }
  }

  /**
   * 从本地存储恢复
   */
  restoreFromStorage() {
    try {
      const stored = wx.getStorageSync(this.storageKey)
      if (stored && typeof stored === 'object') {
        this.currentContext = stored
        console.log('📱 从本地存储恢复场景上下文:', this.currentContext)
      }
    } catch (error) {
      console.error('恢复场景上下文失败:', error)
    }
  }

  /**
   * 更新场景上下文（部分更新）
   * @param {Object} updates 要更新的字段
   */
  updateContext(updates) {
    if (!this.currentContext) return
    
    this.currentContext = {
      ...this.currentContext,
      ...updates,
      timestamp: Date.now()
    }
    
    this.saveToStorage()
    this.notifyListeners('contextUpdated', this.currentContext)
  }

  /**
   * 获取场景导航提示文本
   * @returns {string}
   */
  getSceneNavigationHint() {
    const context = this.getCurrentContext()
    if (!context) return ''
    
    return `当前在「${context.sceneName}」场景模式下`
  }

  /**
   * 检查量表是否匹配当前场景
   * @param {string} scaleType 量表类型
   * @returns {boolean}
   */
  isScaleMatchingScene(scaleType) {
    const context = this.getCurrentContext()
    if (!context || !context.scaleType) return true
    
    return context.scaleType === scaleType
  }

  /**
   * 获取调试信息
   * @returns {Object}
   */
  getDebugInfo() {
    return {
      currentContext: this.currentContext,
      isInSceneMode: this.isInSceneMode(),
      sceneFilter: this.getSceneFilter(),
      listenerCount: this.listeners.length
    }
  }
}

// 创建单例实例
const sceneContextManager = new SceneContextManager()

module.exports = {
  sceneContextManager
}
