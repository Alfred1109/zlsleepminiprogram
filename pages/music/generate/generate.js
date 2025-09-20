// pages/music/generate/generate.js
// 音乐生成页面
const app = getApp()
const { AssessmentAPI, MusicAPI } = require('../../../utils/healingApi')
const { requireSubscription, getSubscriptionInfo } = require('../../../utils/subscription')
const { getGlobalPlayer, formatTime } = require('../../../utils/musicPlayer')
const themeMixin = require('../../../utils/themeMixin')

Page({
  data: {
    userInfo: null,
    recentAssessments: [],
    selectedAssessment: null,
    generating: false,
    musicResult: null,
    loading: false,
    subscriptionInfo: null,
    canUseFeature: true,
    // 全局播放器相关
    showGlobalPlayer: false,
    isPlaying: false,
    player: null,
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null
  },

  onLoad() {
    console.log('音乐生成页面加载')
    this.initTheme()
    this.initPlayer()
    this.checkUserLogin()
    this.loadRecentAssessments()
    this.loadSubscriptionInfo()
  },

  onShow() {
    this.loadRecentAssessments()
    this.refreshSubscriptionStatus()
  },

  /**
   * 检查用户登录状态
   */
  async checkUserLogin() {
    try {
      const AuthService = require('../../../services/AuthService')
      const userInfo = AuthService.getCurrentUser()
      if (userInfo) {
        this.setData({ userInfo })
      } else {
        // 跳转到登录页面或自动登录
        wx.showToast({
          title: '请先登录',
          icon: 'error'
        })
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }, 2000)
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
    }
  },

  /**
   * 加载最近的评测记录
   */
  async loadRecentAssessments() {
    if (!this.data.userInfo) return

    this.setData({ loading: true })

    try {
      const result = await AssessmentAPI.getHistory(this.data.userInfo.id)
      
      if (result.success) {
        // 后端已经只返回已完成的评测，无需再次过滤
        const completedAssessments = result.data || []

        this.setData({
          recentAssessments: completedAssessments.slice(0, 5) // 最近5条
        })

        // 如果有评测记录，默认选择最新的
        if (completedAssessments.length > 0) {
          this.setData({
            selectedAssessment: completedAssessments[0]
          })
        }
      }
    } catch (error) {
      console.error('加载评测历史失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 选择评测记录
   */
  onSelectAssessment(e) {
    const { assessment } = e.currentTarget.dataset
    this.setData({ selectedAssessment: assessment })
  },

  /**
   * 加载订阅信息
   */
  async loadSubscriptionInfo() {
    try {
      const subscriptionInfo = await getSubscriptionInfo()
      this.setData({ 
        subscriptionInfo,
        canUseFeature: subscriptionInfo.is_subscribed
      })
    } catch (error) {
      console.error('加载订阅信息失败:', error)
    }
  },

  /**
   * 刷新订阅状态
   */
  async refreshSubscriptionStatus() {
    try {
      const subscriptionInfo = await getSubscriptionInfo(true) // 强制刷新
      this.setData({ 
        subscriptionInfo,
        canUseFeature: subscriptionInfo.is_subscribed
      })
    } catch (error) {
      console.error('刷新订阅状态失败:', error)
    }
  },

  /**
   * 生成音乐
   */
  async onGenerateMusic() {
    if (!this.data.selectedAssessment) {
      wx.showToast({
        title: '请选择评测记录',
        icon: 'error'
      })
      return
    }

    // 检查订阅权限
    const permissionCheck = await requireSubscription('music_generate', {
      modalTitle: 'AI音乐生成',
      modalContent: 'AI音乐生成功能需要订阅后使用，订阅用户可无限次生成个性化音乐。',
      onConfirm: async (action) => {
        if (action === 'trial') {
          // 试用成功后继续生成音乐
          setTimeout(() => {
            this.generateMusicProcess()
          }, 1000)
        } else if (action === 'subscribe') {
          // 用户选择订阅，跳转到订阅页面
          // 订阅成功后用户可以回到这个页面继续操作
        }
      }
    })

    if (!permissionCheck.allowed) {
      return // 用户取消或需要订阅
    }

    // 有权限，继续生成音乐
    await this.generateMusicProcess()
  },

  /**
   * 音乐生成核心流程
   */
  async generateMusicProcess() {
    this.setData({ generating: true })

    try {
      const result = await MusicAPI.generateMusic(this.data.selectedAssessment.id)
      
      if (result.success) {
        this.setData({ musicResult: result.data })
        
        wx.showToast({
          title: '音乐生成成功',
          icon: 'success'
        })

        // 跳转到播放页面
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/music/player/player?musicId=${result.data.music_id}&type=60s`
          })
        }, 1500)
      } else {
        throw new Error(result.error || '音乐生成失败')
      }

    } catch (error) {
      console.error('生成音乐失败:', error)
      wx.showModal({
        title: '生成失败',
        content: error.message || '音乐生成失败，请重试',
        showCancel: true,
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) {
            this.generateMusicProcess() // 重试时调用核心流程方法
          }
        }
      })
    } finally {
      this.setData({ generating: false })
    }
  },

  /**
   * 去做评测
   */
  onGoToAssessment() {
    wx.switchTab({
      url: '/pages/assessment/scales/scales'
    })
  },

  /**
   * 查看音乐库
   */
  onViewMusicLibrary() {
    wx.switchTab({
      url: '/pages/music/library/library'
    })
  },

  /**
   * 获取严重程度颜色
   */
  getSeverityColor(level) {
    const colors = {
      'normal': '#50C878',
      'mild': '#FFB347',
      'moderate': '#FF6B6B',
      'severe': '#DC143C'
    }
    return colors[level] || '#999'
  },

  /**
   * 格式化时间
   */
  formatTime(timeString) {
    if (!timeString) return ''
    
    try {
      const date = new Date(timeString)
      const now = new Date()
      const diff = now - date
      
      if (diff < 60000) { // 1分钟内
        return '刚刚'
      } else if (diff < 3600000) { // 1小时内
        return `${Math.floor(diff / 60000)}分钟前`
      } else if (diff < 86400000) { // 1天内
        return `${Math.floor(diff / 3600000)}小时前`
      } else {
        return `${Math.floor(diff / 86400000)}天前`
      }
    } catch (error) {
      return timeString
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadRecentAssessments().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 初始化播放器
   */
  initPlayer() {
    const player = getGlobalPlayer()
    this.setData({ player })

    // 监听播放器事件
    player.on('play', this.onPlayerPlay.bind(this))
    player.on('pause', this.onPlayerPause.bind(this))
    player.on('stop', this.onPlayerStop.bind(this))
  },

  /**
   * 播放器事件处理
   */
  onPlayerPlay(music) {
    if (music) {
      this.setData({
        isPlaying: true
      })
    }
  },

  onPlayerPause() {
    this.setData({
      isPlaying: false
    })
  },

  onPlayerStop() {
    this.setData({
      isPlaying: false
    })
  },

  /**
   * 全局播放器事件处理
   */
  onGlobalPlayerStateChange(e) {
    const { isPlaying } = e.detail
    this.setData({ isPlaying })
  },

  onNextTrack() {
    console.log('下一首')
  },

  onPreviousTrack() {
    console.log('上一首')
  },

  onCloseGlobalPlayer() {
    this.setData({
      showGlobalPlayer: false,
      isPlaying: false
    })
  },

  onExpandGlobalPlayer() {
    wx.navigateTo({
      url: '/pages/music/player/player'
    })
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: 'AI疗愈 - 个性化音乐生成',
      path: '/pages/music/generate/generate',
      imageUrl: '/images/share-music.png'
    }
  },

  /**
   * 初始化主题
   */
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
  },

  /**
   * 主题切换事件处理
   */
  onThemeChange(e) {
    const { theme, themeConfig } = e.detail;
    console.log('音乐生成页面接收到主题切换:', theme, themeConfig);
    
    this.setData({
      currentTheme: theme,
      themeClass: themeConfig?.class || '',
      themeConfig: themeConfig
    });
    
    // 同步到全局
    const app = getApp();
    if (app.globalData) {
      app.globalData.currentTheme = theme;
      app.globalData.themeConfig = themeConfig;
    }
  }
})
