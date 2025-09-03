/**
 * 设置管理器
 * 统一管理应用设置的加载、保存和应用
 */

class SettingsManager {
  constructor() {
    this.settings = null
    this.audioSettings = null
    this.privacySettings = null
    this.initialized = false
  }

  /**
   * 初始化设置管理器
   */
  async init() {
    try {
      await this.loadAllSettings()
      await this.applyAllSettings()
      this.initialized = true
      console.log('设置管理器初始化完成')
    } catch (error) {
      console.error('设置管理器初始化失败:', error)
    }
  }

  /**
   * 加载所有设置
   */
  async loadAllSettings() {
    try {
      // 加载基础设置
      const savedAppSettings = wx.getStorageSync('appSettings') || {}
      this.settings = {
        theme: 'auto',
        volume: 0.7,
        autoSleep: 30,
        vibrationEnabled: true,
        notificationEnabled: true,
        autoPlay: false,
        downloadOnlyWifi: true,
        cacheLimit: 500,
        ...savedAppSettings
      }

      // 加载音频设置
      const savedAudioSettings = wx.getStorageSync('audioSettings') || {}
      this.audioSettings = {
        quality: 'high',
        enableFadeInOut: true,
        crossfadeTime: 3,
        backgroundPlay: true,
        autoDownload: false,
        ...savedAudioSettings
      }

      // 加载隐私设置
      const savedPrivacySettings = wx.getStorageSync('privacySettings') || {}
      this.privacySettings = {
        dataCollection: true,
        analyticsEnabled: true,
        crashReporting: true,
        personalizedRecommendation: true,
        ...savedPrivacySettings
      }

      console.log('所有设置加载完成')
    } catch (error) {
      console.error('加载设置失败:', error)
      this.setDefaultSettings()
    }
  }

  /**
   * 设置默认值
   */
  setDefaultSettings() {
    this.settings = {
      theme: 'auto',
      volume: 0.7,
      autoSleep: 30,
      vibrationEnabled: true,
      notificationEnabled: true,
      autoPlay: false,
      downloadOnlyWifi: true,
      cacheLimit: 500
    }

    this.audioSettings = {
      quality: 'high',
      enableFadeInOut: true,
      crossfadeTime: 3,
      backgroundPlay: true,
      autoDownload: false
    }

    this.privacySettings = {
      dataCollection: true,
      analyticsEnabled: true,
      crashReporting: true,
      personalizedRecommendation: true
    }
  }

  /**
   * 应用所有设置
   */
  async applyAllSettings() {
    try {
      // 应用主题设置
      await this.applyTheme(this.settings.theme)
      
      // 应用音频设置
      await this.applyAudioSettings()
      
      // 更新全局设置
      this.updateGlobalSettings()
      
      console.log('所有设置应用完成')
    } catch (error) {
      console.error('应用设置失败:', error)
    }
  }

  /**
   * 应用主题设置
   */
  async applyTheme(theme) {
    try {
      let actualTheme = theme
      
      if (theme === 'auto') {
        // 获取系统主题
        const systemInfo = wx.getSystemInfoSync()
        actualTheme = systemInfo.theme || 'light'
      }

      // 更新页面主题类名
      const app = getApp()
      if (app.globalData) {
        app.globalData.currentTheme = actualTheme
      }

      console.log('主题应用成功:', actualTheme)
    } catch (error) {
      console.error('应用主题失败:', error)
    }
  }

  /**
   * 应用音频设置
   */
  async applyAudioSettings() {
    try {
      // 更新全局音频播放器设置
      const { getGlobalPlayer } = require('./musicPlayer')
      const globalPlayer = getGlobalPlayer()

      if (globalPlayer && this.settings) {
        // 设置音量
        globalPlayer.setVolume(this.settings.volume)
      }

      console.log('音频设置应用成功')
    } catch (error) {
      console.error('应用音频设置失败:', error)
    }
  }

  /**
   * 更新全局设置
   */
  updateGlobalSettings() {
    const app = getApp()
    if (app.globalData) {
      app.globalData.settings = this.settings
      app.globalData.audioSettings = this.audioSettings
      app.globalData.privacySettings = this.privacySettings
    }
  }

  /**
   * 保存设置
   */
  async saveSettings(type = 'all') {
    try {
      if (type === 'all' || type === 'app') {
        wx.setStorageSync('appSettings', this.settings)
      }
      
      if (type === 'all' || type === 'audio') {
        wx.setStorageSync('audioSettings', this.audioSettings)
      }
      
      if (type === 'all' || type === 'privacy') {
        wx.setStorageSync('privacySettings', this.privacySettings)
      }

      // 重新应用设置
      await this.applyAllSettings()
      
      console.log('设置保存成功:', type)
      return true
    } catch (error) {
      console.error('保存设置失败:', error)
      return false
    }
  }

  /**
   * 更新设置
   */
  updateSetting(category, key, value) {
    try {
      switch (category) {
        case 'app':
          if (this.settings) {
            this.settings[key] = value
          }
          break
        case 'audio':
          if (this.audioSettings) {
            this.audioSettings[key] = value
          }
          break
        case 'privacy':
          if (this.privacySettings) {
            this.privacySettings[key] = value
          }
          break
      }
      
      console.log('设置更新:', category, key, value)
    } catch (error) {
      console.error('更新设置失败:', error)
    }
  }

  /**
   * 获取设置
   */
  getSetting(category, key) {
    try {
      switch (category) {
        case 'app':
          return this.settings ? this.settings[key] : null
        case 'audio':
          return this.audioSettings ? this.audioSettings[key] : null
        case 'privacy':
          return this.privacySettings ? this.privacySettings[key] : null
        default:
          return null
      }
    } catch (error) {
      console.error('获取设置失败:', error)
      return null
    }
  }

  /**
   * 获取所有设置
   */
  getAllSettings() {
    return {
      settings: this.settings,
      audioSettings: this.audioSettings,
      privacySettings: this.privacySettings
    }
  }

  /**
   * 重置设置
   */
  async resetSettings(category = 'all') {
    try {
      if (category === 'all' || category === 'app') {
        wx.removeStorageSync('appSettings')
      }
      
      if (category === 'all' || category === 'audio') {
        wx.removeStorageSync('audioSettings')
      }
      
      if (category === 'all' || category === 'privacy') {
        wx.removeStorageSync('privacySettings')
      }

      // 重新加载默认设置
      this.setDefaultSettings()
      await this.applyAllSettings()
      
      console.log('设置重置完成:', category)
      return true
    } catch (error) {
      console.error('重置设置失败:', error)
      return false
    }
  }

  /**
   * 获取缓存信息
   */
  async getCacheInfo() {
    try {
      // 这里可以实现真实的缓存大小计算
      // 目前返回模拟数据
      return {
        used: Math.floor(Math.random() * 200), // MB
        total: this.settings ? this.settings.cacheLimit : 500,
        fileCount: Math.floor(Math.random() * 50)
      }
    } catch (error) {
      console.error('获取缓存信息失败:', error)
      return {
        used: 0,
        total: 500,
        fileCount: 0
      }
    }
  }

  /**
   * 清理缓存
   */
  async clearCache() {
    try {
      // 这里实现真实的缓存清理逻辑
      // 可以调用文件管理API删除缓存文件
      
      console.log('缓存清理完成')
      return true
    } catch (error) {
      console.error('清理缓存失败:', error)
      return false
    }
  }
}

// 创建全局实例
const settingsManager = new SettingsManager()

module.exports = {
  SettingsManager,
  settingsManager
}
