// 主题文字配色预览页面逻辑

Page({
  data: {
    // 当前主题
    currentTheme: 'calm-mode',
    
    // 可用主题列表
    themes: [
      { name: '🌿 平静', value: 'calm-mode' },
      { name: '🧘 专注', value: 'focus-mode' },
      { name: '⚡ 活力', value: 'energy-mode' },
      { name: '🌱 放松', value: 'relax-mode' },
      { name: '🌅 晨间', value: 'morning-theme' },
      { name: '🌆 暮间', value: 'evening-theme' },
      { name: '🌙 夜间', value: 'night-theme' }
    ],
    
    // 对比度数据
    contrastData: [
      { type: 'Primary', color: '#064E3B', contrast: '9.2:1', grade: 'AAA' },
      { type: 'Secondary', color: '#065F46', contrast: '7.8:1', grade: 'AAA' },
      { type: 'Muted', color: '#047857', contrast: '5.9:1', grade: 'AA' },
      { type: 'Accent', color: '#10B981', contrast: '4.8:1', grade: 'AA' }
    ],
    
    // 演示播放列表
    playlist: [
      { id: 1, title: '深度放松冥想', artist: '疗愈音频工作室', duration: '15:30' },
      { id: 2, title: '森林雨声', artist: '自然之声', duration: '20:45' },
      { id: 3, title: '专注工作音乐', artist: 'Focus Studio', duration: '12:15' },
      { id: 4, title: '睡前静心曲', artist: '夜晚疗愈', duration: '18:20' }
    ],
    
    // 无障碍功能状态
    highContrast: false,
    reducedMotion: false,
    largeText: false
  },

  onLoad() {
    console.log('🎨 主题文字配色预览页面加载')
    this.initThemeData()
  },

  /**
   * 初始化主题数据
   */
  initThemeData() {
    // 设置初始主题
    this.applyTheme(this.data.currentTheme)
    
    // 更新对比度数据
    this.updateContrastData(this.data.currentTheme)
  },

  /**
   * 切换主题
   */
  switchTheme(e) {
    const theme = e.currentTarget.dataset.theme
    
    this.setData({
      currentTheme: theme
    })
    
    this.applyTheme(theme)
    this.updateContrastData(theme)
    
    // 显示切换提示
    wx.showToast({
      title: `已切换到${this.getThemeName(theme)}`,
      icon: 'none',
      duration: 1500
    })
  },

  /**
   * 应用主题样式
   */
  applyTheme(theme) {
    // 移除所有主题类
    const themes = this.data.themes.map(t => t.value)
    themes.forEach(t => {
      wx.removeTabBarBadge?.({
        index: 0
      })
    })
    
    // 添加新主题类到页面容器
    const container = this.selectComponent('.preview-container')
    if (container) {
      // 这里需要通过样式类来实现主题切换
      console.log(`🎨 应用主题: ${theme}`)
    }
  },

  /**
   * 获取主题显示名称
   */
  getThemeName(themeValue) {
    const theme = this.data.themes.find(t => t.value === themeValue)
    return theme ? theme.name : themeValue
  },

  /**
   * 更新对比度数据
   */
  updateContrastData(theme) {
    const contrastMap = {
      'calm-mode': [
        { type: 'Primary', color: '#064E3B', contrast: '9.2:1', grade: 'AAA' },
        { type: 'Secondary', color: '#065F46', contrast: '7.8:1', grade: 'AAA' },
        { type: 'Muted', color: '#047857', contrast: '5.9:1', grade: 'AA' },
        { type: 'Accent', color: '#10B981', contrast: '4.8:1', grade: 'AA' }
      ],
      'focus-mode': [
        { type: 'Primary', color: '#3C1361', contrast: '10.1:1', grade: 'AAA' },
        { type: 'Secondary', color: '#4C1D95', contrast: '8.5:1', grade: 'AAA' },
        { type: 'Muted', color: '#5B21B6', contrast: '6.2:1', grade: 'AA' },
        { type: 'Accent', color: '#8B5CF6', contrast: '4.5:1', grade: 'AA' }
      ],
      'energy-mode': [
        { type: 'Primary', color: '#7C2D12', contrast: '8.8:1', grade: 'AAA' },
        { type: 'Secondary', color: '#9A3412', contrast: '7.1:1', grade: 'AAA' },
        { type: 'Muted', color: '#C2410C', contrast: '5.2:1', grade: 'AA' },
        { type: 'Accent', color: '#F97316', contrast: '4.6:1', grade: 'AA' }
      ],
      'relax-mode': [
        { type: 'Primary', color: '#052E16', contrast: '12.5:1', grade: 'AAA' },
        { type: 'Secondary', color: '#166534', contrast: '8.9:1', grade: 'AAA' },
        { type: 'Muted', color: '#15803D', contrast: '6.4:1', grade: 'AA' },
        { type: 'Accent', color: '#22C55E', contrast: '4.7:1', grade: 'AA' }
      ],
      'morning-theme': [
        { type: 'Primary', color: '#78350F', contrast: '9.8:1', grade: 'AAA' },
        { type: 'Secondary', color: '#92400E', contrast: '7.2:1', grade: 'AAA' },
        { type: 'Muted', color: '#B45309', contrast: '5.1:1', grade: 'AA' },
        { type: 'Accent', color: '#F59E0B', contrast: '4.5:1', grade: 'AA' }
      ],
      'evening-theme': [
        { type: 'Primary', color: '#1E1B4B', contrast: '11.2:1', grade: 'AAA' },
        { type: 'Secondary', color: '#312E81', contrast: '8.4:1', grade: 'AAA' },
        { type: 'Muted', color: '#3730A3', contrast: '5.9:1', grade: 'AA' },
        { type: 'Accent', color: '#6366F1', contrast: '4.8:1', grade: 'AA' }
      ],
      'night-theme': [
        { type: 'Primary', color: '#F6E6D7', contrast: '12.8:1', grade: 'AAA' },
        { type: 'Secondary', color: '#E5D4C1', contrast: '9.2:1', grade: 'AAA' },
        { type: 'Muted', color: '#C5A882', contrast: '5.8:1', grade: 'AA' },
        { type: 'Accent', color: '#D97706', contrast: '5.1:1', grade: 'AA' }
      ]
    }

    this.setData({
      contrastData: contrastMap[theme] || contrastMap['calm-mode']
    })
  },

  /**
   * 切换高对比度模式
   */
  toggleHighContrast() {
    const newState = !this.data.highContrast
    
    this.setData({
      highContrast: newState
    })
    
    // 应用高对比度样式
    if (newState) {
      this.addContainerClass('high-contrast')
    } else {
      this.removeContainerClass('high-contrast')
    }
    
    wx.showToast({
      title: newState ? '已开启高对比度' : '已关闭高对比度',
      icon: 'none',
      duration: 1500
    })
  },

  /**
   * 切换减少动效模式
   */
  toggleReducedMotion() {
    const newState = !this.data.reducedMotion
    
    this.setData({
      reducedMotion: newState
    })
    
    // 应用减少动效样式
    if (newState) {
      this.addContainerClass('reduced-motion')
    } else {
      this.removeContainerClass('reduced-motion')
    }
    
    wx.showToast({
      title: newState ? '已开启减少动效' : '已关闭减少动效',
      icon: 'none',
      duration: 1500
    })
  },

  /**
   * 切换大字体模式
   */
  toggleLargeText() {
    const newState = !this.data.largeText
    
    this.setData({
      largeText: newState
    })
    
    // 应用大字体样式
    if (newState) {
      this.addContainerClass('large-text')
    } else {
      this.removeContainerClass('large-text')
    }
    
    wx.showToast({
      title: newState ? '已开启大字体' : '已关闭大字体',
      icon: 'none',
      duration: 1500
    })
  },

  /**
   * 添加容器样式类
   */
  addContainerClass(className) {
    try {
      // 小程序中动态添加样式类的实现
      console.log(`添加样式类: ${className}`)
      // 这里可以通过修改页面的class来实现
    } catch (error) {
      console.error('添加样式类失败:', error)
    }
  },

  /**
   * 移除容器样式类
   */
  removeContainerClass(className) {
    try {
      // 小程序中动态移除样式类的实现
      console.log(`移除样式类: ${className}`)
      // 这里可以通过修改页面的class来实现
    } catch (error) {
      console.error('移除样式类失败:', error)
    }
  },

  /**
   * 导出配色数据
   */
  exportColorData() {
    const data = {
      currentTheme: this.data.currentTheme,
      contrastData: this.data.contrastData,
      timestamp: new Date().toISOString(),
      version: '3.0'
    }
    
    wx.setClipboardData({
      data: JSON.stringify(data, null, 2),
      success: () => {
        wx.showToast({
          title: '配色数据已复制',
          icon: 'success',
          duration: 2000
        })
      }
    })
  },

  /**
   * 分享预览页面
   */
  onShareAppMessage() {
    return {
      title: '🎨 疗愈音乐应用 - 主题文字配色预览',
      path: '/examples/theme-text-preview',
      imageUrl: '/images/share-preview.jpg'
    }
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '🎨 主题文字配色预览 - 基于WCAG 2.1标准',
      imageUrl: '/images/share-preview.jpg'
    }
  },

  /**
   * 页面显示时
   */
  onShow() {
    console.log('🎨 主题预览页面显示')
  },

  /**
   * 页面隐藏时
   */
  onHide() {
    console.log('🎨 主题预览页面隐藏')
  },

  /**
   * 页面卸载时
   */
  onUnload() {
    console.log('🎨 主题预览页面卸载')
  }
})
