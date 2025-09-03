// pages/settings/settings.js
const app = getApp()
const AuthService = require('../../services/AuthService')

Page({
  data: {
    // 基础设置
    settings: {
      theme: 'auto', // auto, light, dark
      volume: 0.7,
      autoSleep: 30,
      vibrationEnabled: true,
      notificationEnabled: true,
      autoPlay: false,
      downloadOnlyWifi: true,
      cacheLimit: 500 // MB
    },

    // 音频设置
    audioSettings: {
      quality: 'high', // low, medium, high
      enableFadeInOut: true,
      crossfadeTime: 3, // 秒
      backgroundPlay: true,
      autoDownload: false
    },

    // 隐私设置
    privacySettings: {
      dataCollection: true,
      analyticsEnabled: true,
      crashReporting: true,
      personalizedRecommendation: true
    },

    // 主题选项
    themeOptions: [
      { value: 'auto', label: '跟随系统', icon: '🔄' },
      { value: 'light', label: '浅色模式', icon: '☀️' },
      { value: 'dark', label: '深色模式', icon: '🌙' }
    ],

    // 音质选项
    qualityOptions: [
      { value: 'low', label: '标准音质', desc: '128kbps，节省流量' },
      { value: 'medium', label: '高音质', desc: '320kbps，推荐' },
      { value: 'high', label: '无损音质', desc: 'FLAC，最佳体验' }
    ],

    // 定时休眠选项
    sleepOptions: [
      { value: 15, label: '15分钟' },
      { value: 30, label: '30分钟' },
      { value: 45, label: '45分钟' },
      { value: 60, label: '60分钟' },
      { value: 90, label: '90分钟' },
      { value: 0, label: '不自动休眠' }
    ],

    // 缓存大小选项
    cacheOptions: [
      { value: 100, label: '100MB' },
      { value: 250, label: '250MB' },
      { value: 500, label: '500MB' },
      { value: 1000, label: '1GB' },
      { value: 2000, label: '2GB' }
    ],

    // 页面状态
    loading: false,
    saving: false,
    hasChanges: false,

    // 弹窗状态
    showThemeSelector: false,
    showQualitySelector: false,
    showSleepSelector: false,
    showCacheSelector: false,

    // 缓存信息
    cacheInfo: {
      used: 0,
      total: 500,
      fileCount: 0
    },

    // 计算属性
    volumePercent: 70,
    cacheUsagePercent: 0
  },

  onLoad() {
    this.loadSettings()
    this.loadCacheInfo()
  },

  onShow() {
    // 如果有变更，提示用户保存
    if (this.data.hasChanges) {
      wx.showModal({
        title: '设置变更',
        content: '检测到未保存的设置变更，是否保存？',
        confirmText: '保存',
        cancelText: '丢弃',
        success: (res) => {
          if (res.confirm) {
            this.saveSettings()
          } else {
            this.loadSettings() // 重新加载设置
          }
        }
      })
    }
  },

  /**
   * 加载设置
   */
  loadSettings() {
    try {
      // 从缓存加载设置
      const savedSettings = wx.getStorageSync('appSettings') || {}
      const savedAudioSettings = wx.getStorageSync('audioSettings') || {}
      const savedPrivacySettings = wx.getStorageSync('privacySettings') || {}

      this.setData({
        settings: { ...this.data.settings, ...savedSettings },
        audioSettings: { ...this.data.audioSettings, ...savedAudioSettings },
        privacySettings: { ...this.data.privacySettings, ...savedPrivacySettings },
        hasChanges: false
      })

      // 更新计算属性
      this.updateComputedProperties()

      console.log('设置加载完成')
    } catch (error) {
      console.error('加载设置失败:', error)
      wx.showToast({
        title: '加载设置失败',
        icon: 'none'
      })
    }
  },

  /**
   * 保存设置
   */
  async saveSettings() {
    if (!this.data.hasChanges) return

    this.setData({ saving: true })

    try {
      // 保存到本地存储
      wx.setStorageSync('appSettings', this.data.settings)
      wx.setStorageSync('audioSettings', this.data.audioSettings)
      wx.setStorageSync('privacySettings', this.data.privacySettings)

      // 应用设置到全局
      await this.applySettings()

      this.setData({ 
        hasChanges: false,
        saving: false 
      })

      wx.showToast({
        title: '设置已保存',
        icon: 'success'
      })

      console.log('设置保存成功')
    } catch (error) {
      console.error('保存设置失败:', error)
      this.setData({ saving: false })
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  /**
   * 应用设置到全局
   */
  async applySettings() {
    const { settings, audioSettings } = this.data

    // 应用主题设置
    this.applyTheme(settings.theme)

    // 应用音频设置
    this.applyAudioSettings(audioSettings)

    // 更新全局设置
    if (app.globalData) {
      app.globalData.settings = {
        ...app.globalData.settings,
        ...settings,
        ...audioSettings
      }
    }
  },

  /**
   * 应用主题设置
   */
  applyTheme(theme) {
    try {
      let actualTheme = theme
      
      if (theme === 'auto') {
        // 获取系统主题
        const systemInfo = wx.getSystemInfoSync()
        actualTheme = systemInfo.theme || 'light'
      }

      // 设置页面样式
      if (actualTheme === 'dark') {
        wx.setNavigationBarColor({
          frontColor: '#ffffff',
          backgroundColor: '#1a1a1a'
        })
      } else {
        wx.setNavigationBarColor({
          frontColor: '#000000',
          backgroundColor: '#ffffff'
        })
      }

      console.log('主题应用成功:', actualTheme)
    } catch (error) {
      console.error('应用主题失败:', error)
    }
  },

  /**
   * 应用音频设置
   */
  applyAudioSettings(audioSettings) {
    try {
      // 更新全局音频播放器设置
      const { getGlobalPlayer } = require('../../utils/musicPlayer')
      const globalPlayer = getGlobalPlayer()

      if (globalPlayer) {
        // 设置音量
        globalPlayer.setVolume(this.data.settings.volume)

        // 应用其他音频设置
        if (app.globalData) {
          app.globalData.audioSettings = audioSettings
        }
      }

      console.log('音频设置应用成功')
    } catch (error) {
      console.error('应用音频设置失败:', error)
    }
  },

  /**
   * 基础设置变更
   */
  onSettingChange(e) {
    const { key } = e.currentTarget.dataset
    const { value } = e.detail

    this.setData({
      [`settings.${key}`]: value,
      hasChanges: true
    })
  },

  /**
   * 音频设置变更
   */
  onAudioSettingChange(e) {
    const { key } = e.currentTarget.dataset
    const { value } = e.detail

    this.setData({
      [`audioSettings.${key}`]: value,
      hasChanges: true
    })
  },

  /**
   * 隐私设置变更
   */
  onPrivacySettingChange(e) {
    const { key } = e.currentTarget.dataset
    const { value } = e.detail

    this.setData({
      [`privacySettings.${key}`]: value,
      hasChanges: true
    })
  },

  /**
   * 音量滑块变更
   */
  onVolumeChange(e) {
    const volume = e.detail.value / 100
    this.setData({
      'settings.volume': volume,
      hasChanges: true
    })

    // 更新计算属性
    this.updateComputedProperties()

    // 实时应用音量变化
    const { getGlobalPlayer } = require('../../utils/musicPlayer')
    const globalPlayer = getGlobalPlayer()
    if (globalPlayer) {
      globalPlayer.setVolume(volume)
    }
  },

  /**
   * 交叉淡入淡出时间变更
   */
  onCrossfadeTimeChange(e) {
    const time = e.detail.value
    this.setData({
      'audioSettings.crossfadeTime': time,
      hasChanges: true
    })
  },

  /**
   * 显示主题选择器
   */
  showThemeSelector() {
    this.setData({ showThemeSelector: true })
  },

  /**
   * 选择主题
   */
  selectTheme(e) {
    const theme = e.currentTarget.dataset.value
    this.setData({
      'settings.theme': theme,
      showThemeSelector: false,
      hasChanges: true
    })

    // 立即应用主题
    this.applyTheme(theme)
  },

  /**
   * 显示音质选择器
   */
  showQualitySelector() {
    this.setData({ showQualitySelector: true })
  },

  /**
   * 选择音质
   */
  selectQuality(e) {
    const quality = e.currentTarget.dataset.value
    this.setData({
      'audioSettings.quality': quality,
      showQualitySelector: false,
      hasChanges: true
    })
  },

  /**
   * 显示休眠选择器
   */
  showSleepSelector() {
    this.setData({ showSleepSelector: true })
  },

  /**
   * 选择休眠时间
   */
  selectSleep(e) {
    const time = parseInt(e.currentTarget.dataset.value)
    this.setData({
      'settings.autoSleep': time,
      showSleepSelector: false,
      hasChanges: true
    })
  },

  /**
   * 显示缓存选择器
   */
  showCacheSelector() {
    this.setData({ showCacheSelector: true })
  },

  /**
   * 选择缓存大小
   */
  selectCache(e) {
    const size = parseInt(e.currentTarget.dataset.value)
    this.setData({
      'settings.cacheLimit': size,
      showCacheSelector: false,
      hasChanges: true
    })
  },

  /**
   * 关闭所有选择器
   */
  closeSelectors() {
    this.setData({
      showThemeSelector: false,
      showQualitySelector: false,
      showSleepSelector: false,
      showCacheSelector: false
    })
  },

  /**
   * 加载缓存信息
   */
  async loadCacheInfo() {
    try {
      // 这里可以实现真实的缓存大小计算
      // 暂时使用模拟数据
      const cacheInfo = {
        used: Math.floor(Math.random() * 200), // MB
        total: this.data.settings.cacheLimit,
        fileCount: Math.floor(Math.random() * 50)
      }

      this.setData({ cacheInfo })
      
      // 更新计算属性
      this.updateComputedProperties()
    } catch (error) {
      console.error('加载缓存信息失败:', error)
    }
  },

  /**
   * 更新计算属性
   */
  updateComputedProperties() {
    // 更新音量百分比
    const volumePercent = Math.round((this.data.settings?.volume || 0.7) * 100)
    
    // 更新缓存使用百分比
    const cacheUsagePercent = this.data.cacheInfo.total > 0 
      ? Math.round((this.data.cacheInfo.used / this.data.cacheInfo.total * 100) * 10) / 10
      : 0

    this.setData({
      volumePercent: volumePercent,
      cacheUsagePercent: cacheUsagePercent
    })
  },

  /**
   * 清理缓存
   */
  clearCache() {
    wx.showModal({
      title: '清理缓存',
      content: `将清理所有缓存的音频文件（约${this.data.cacheInfo.used}MB），是否继续？`,
      confirmText: '清理',
      confirmColor: '#ff4444',
      success: (res) => {
        if (res.confirm) {
          this.performClearCache()
        }
      }
    })
  },

  /**
   * 执行清理缓存
   */
  async performClearCache() {
    wx.showLoading({ title: '清理中...' })

    try {
      // 这里实现真实的缓存清理逻辑
      // 可以调用缓存管理器的清理方法
      
      // 模拟清理过程
      await new Promise(resolve => setTimeout(resolve, 1000))

      this.setData({
        cacheInfo: {
          used: 0,
          total: this.data.settings.cacheLimit,
          fileCount: 0
        }
      })
      
      // 更新计算属性
      this.updateComputedProperties()

      wx.hideLoading()
      wx.showToast({
        title: '缓存清理完成',
        icon: 'success'
      })

      console.log('缓存清理完成')
    } catch (error) {
      wx.hideLoading()
      console.error('清理缓存失败:', error)
      wx.showToast({
        title: '清理失败',
        icon: 'none'
      })
    }
  },

  /**
   * 重置所有设置
   */
  resetSettings() {
    wx.showModal({
      title: '重置设置',
      content: '将恢复所有设置为默认值，是否继续？',
      confirmText: '重置',
      confirmColor: '#ff4444',
      success: (res) => {
        if (res.confirm) {
          this.performResetSettings()
        }
      }
    })
  },

  /**
   * 执行重置设置
   */
  performResetSettings() {
    try {
      // 重置为默认值
      this.setData({
        settings: {
          theme: 'auto',
          volume: 0.7,
          autoSleep: 30,
          vibrationEnabled: true,
          notificationEnabled: true,
          autoPlay: false,
          downloadOnlyWifi: true,
          cacheLimit: 500
        },
        audioSettings: {
          quality: 'high',
          enableFadeInOut: true,
          crossfadeTime: 3,
          backgroundPlay: true,
          autoDownload: false
        },
        privacySettings: {
          dataCollection: true,
          analyticsEnabled: true,
          crashReporting: true,
          personalizedRecommendation: true
        },
        hasChanges: true
      })

      wx.showToast({
        title: '设置已重置',
        icon: 'success'
      })

      console.log('设置重置完成')
    } catch (error) {
      console.error('重置设置失败:', error)
      wx.showToast({
        title: '重置失败',
        icon: 'none'
      })
    }
  },

  /**
   * 页面返回时保存设置
   */
  onUnload() {
    if (this.data.hasChanges) {
      this.saveSettings()
    }
  }
})
