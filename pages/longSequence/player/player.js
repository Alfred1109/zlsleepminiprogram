// pages/longSequence/player/player.js
// 长序列音乐播放器页面
const app = getApp()
const { LongSequenceAPI } = require('../../../utils/healingApi')
const { formatTime } = require('../../../utils/musicPlayer')

Page({
  data: {
    sessionId: null,
    sessionInfo: null,
    loading: false,
    // 全局播放器相关
    showGlobalPlayer: true,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    // ISO阶段信息
    currentPhase: 'iso', // 'iso', 'transition', 'target'
    phaseProgress: 0,
    isoPhases: null,
    showPhaseInfo: false,
    // 收藏状态
    isFavorite: false,
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null
  },

  onLoad(options) {
    console.log('长序列播放器页面加载', options)
    
    // 初始化全局播放器 - 修复全局播放器在长序列播放器页面不工作的问题
    this.initGlobalPlayerRef()
    
    const { sessionId } = options
    this.setData({
      sessionId: parseInt(sessionId)
    })

    this.initTheme()
    this.loadSessionInfo()
  },
  
  /**
   * 初始化全局播放器引用 - 确保全局播放器在当前页面正常工作
   */
  initGlobalPlayerRef() {
    const app = getApp()
    if (app.globalData) {
      // 设置页面引用，供全局播放器组件使用
      app.globalData.currentPageInstance = this
      console.log('✅ 长序列播放器页面 - 全局播放器引用已初始化')
    }
  },

  onShow() {
    // 页面显示时检查全局播放器状态
    this.updatePlayerState()
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
    try {
      if (!e || !e.detail) return;
      const { theme, config } = e.detail;
      if (!theme || !config) return;

      this.setData({
        currentTheme: theme,
        themeClass: config.class || '',
        themeConfig: config
      });
    } catch (error) {
      console.error('主题切换处理失败:', error);
    }
  },

  onUnload() {
    // 页面卸载时清理
    console.log('长序列播放器页面卸载')
  },



  /**
   * 加载会话信息
   */
  async loadSessionInfo() {
    this.setData({ loading: true })

    try {
      const sessionId = this.data.sessionId
      console.log('🎵 长序列播放器: 加载会话信息, sessionId:', sessionId)

      if (!sessionId) {
        throw new Error('会话ID无效')
      }

      console.log('🔍 调用长序列状态API...')
      const result = await LongSequenceAPI.getLongSequenceStatus(sessionId)
      
      console.log('🔍 长序列状态API响应:', JSON.stringify(result, null, 2))
      
      if (result.success) {
        const sessionInfo = result.data
        console.log('🎵 长序列会话信息解析完成:')
        console.log('  - 状态:', sessionInfo.status)
        console.log('  - 会话ID:', sessionInfo.session_id)
        console.log('  - 文件路径:', sessionInfo.final_file_path)
        console.log('  - 文件大小:', sessionInfo.final_file_size)
        console.log('  - 时长:', sessionInfo.total_duration_minutes)
        console.log('  - 完整数据:', JSON.stringify(sessionInfo, null, 2))
        
        this.setData({ sessionInfo })

        // 🔍 详细检查会话状态
        if (sessionInfo.status !== 'completed') {
          console.warn('⚠️ 长序列状态异常:', sessionInfo.status)
          console.log('📊 状态详情:', {
            status: sessionInfo.status,
            created_at: sessionInfo.created_at,
            updated_at: sessionInfo.updated_at,
            error_message: sessionInfo.error_message
          })
        }

        // 解析ISO阶段信息
        if (sessionInfo.iso_phase_plan) {
          try {
            const isoPhases = JSON.parse(sessionInfo.iso_phase_plan)
            this.setData({ isoPhases })
          } catch (error) {
            console.error('解析ISO阶段信息失败:', error)
          }
        }

        // 自动加载到全局播放器
        this.loadMusicToGlobalPlayer(sessionInfo)
      } else {
        console.error('❌ 获取长序列状态失败:', result)
        throw new Error(result.error || '获取会话信息失败')
      }

    } catch (error) {
      console.error('❌ 加载长序列会话失败:', error)
      console.error('❌ 错误详情:', {
        message: error.message,
        stack: error.stack,
        sessionId: this.data.sessionId
      })
      
      // 检查是否是订阅权限问题
      if (error.statusCode === 403 || error.code === 'SUBSCRIPTION_REQUIRED') {
        wx.showModal({
          title: '需要订阅',
          content: '长序列音乐功能需要订阅后才能使用',
          showCancel: true,
          cancelText: '返回',
          confirmText: '去订阅',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/subscription/subscription' })
            } else {
              wx.navigateBack()
            }
          }
        })
      } else {
        wx.showModal({
          title: '加载失败',
          content: error.message || '无法加载长序列信息',
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 加载音乐到播放器
   */
  loadMusicToGlobalPlayer(sessionInfo) {
    console.log('🎵 长序列播放器: 加载音乐到全局播放器')
    console.log('🎵 会话信息:', sessionInfo)
    
    // 检查会话状态
    if (sessionInfo.status !== 'completed') {
      let message = '音乐正在生成中...'
      if (sessionInfo.status === 'failed') {
        message = '音乐生成失败'
      } else if (sessionInfo.status === 'generating') {
        message = '音乐正在生成中，请稍候...'
      } else if (sessionInfo.status === 'composing') {
        message = '音乐正在合成中，请稍候...'
      }
      
      console.warn('⚠️ 会话状态:', sessionInfo.status)
      wx.showModal({
        title: '音乐未就绪',
        content: message,
        showCancel: false,
        confirmText: '我知道了',
        success: () => {
          wx.navigateBack()
        }
      })
      return
    }
    
    if (!sessionInfo.final_file_path) {
      console.error('❌ 音乐文件路径不存在:', sessionInfo.final_file_path)
      wx.showModal({
        title: '音乐文件错误',
        content: '音乐文件路径不存在，请重新生成长序列音频',
        showCancel: true,
        confirmText: '重新生成',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            wx.redirectTo({
              url: '/pages/longSequence/create/create'
            })
          } else {
            wx.navigateBack()
          }
        }
      })
      return
    }

    // 🔥 直接使用后台返回的完整音乐元数据，包含流式播放支持
    const trackInfo = {
      id: sessionInfo.music_id || sessionInfo.session_id,
      name: sessionInfo.music_name || sessionInfo.music_title,
      title: sessionInfo.title || sessionInfo.music_title,
      url: sessionInfo.final_file_path,
      stream_url: sessionInfo.stream_url,  // 流式传输URL
      use_stream: sessionInfo.use_stream,  // 是否建议使用流式播放
      image: sessionInfo.image || sessionInfo.cover_image,
      category: sessionInfo.category,
      type: sessionInfo.type,
      description: sessionInfo.description,
      duration: sessionInfo.duration || sessionInfo.duration_seconds,
      file_size: sessionInfo.final_file_size,
      sessionId: sessionInfo.session_id
    }
    
    console.log('🎵 使用后台完整数据构建的trackInfo:', trackInfo)

    // 🌊 现在全局播放器已内置流式播放智能优化，无需额外处理
    console.log('🌊 检测到长序列音频，全局播放器将自动优化播放方式')

    // 显示全局播放器并播放
    this.setData({
      showGlobalPlayer: true
    })

    // 延迟调用播放器
    setTimeout(() => {
      const globalPlayer = this.selectComponent('#globalPlayer')
      if (globalPlayer && globalPlayer.playTrack) {
        globalPlayer.playTrack(trackInfo)
      } else {
        console.warn('Global player组件未找到')
        wx.showToast({
          title: '播放器初始化失败',
          icon: 'none'
        })
      }
    }, 100)
  },

  /**
   * 更新播放器状态
   */
  updatePlayerState() {
    // 从全局播放器获取状态
    const globalPlayer = this.selectComponent('#globalPlayer')
    if (globalPlayer) {
      const playerData = globalPlayer.data
      this.setData({
        isPlaying: playerData.isPlaying,
        currentTime: playerData.currentTime,
        duration: playerData.duration,
        progress: playerData.progress
      })

      // 更新当前阶段
      this.updateCurrentPhase(playerData.currentTime, playerData.duration)
    }
  },

  /**
   * 更新当前阶段
   */
  updateCurrentPhase(currentTime, duration) {
    if (!this.data.isoPhases || duration <= 0) return

    const { iso_phase, transition_phase, target_phase } = this.data.isoPhases
    
    // 计算各阶段的时间点
    const isoEndTime = (iso_phase.duration_minutes / this.data.sessionInfo.total_duration_minutes) * duration
    const transitionEndTime = isoEndTime + (transition_phase.duration_minutes / this.data.sessionInfo.total_duration_minutes) * duration

    let currentPhase = 'iso'
    let phaseProgress = 0

    if (currentTime <= isoEndTime) {
      currentPhase = 'iso'
      phaseProgress = (currentTime / isoEndTime) * 100
    } else if (currentTime <= transitionEndTime) {
      currentPhase = 'transition'
      phaseProgress = ((currentTime - isoEndTime) / (transitionEndTime - isoEndTime)) * 100
    } else {
      currentPhase = 'target'
      phaseProgress = ((currentTime - transitionEndTime) / (duration - transitionEndTime)) * 100
    }

    this.setData({
      currentPhase,
      phaseProgress: Math.min(phaseProgress, 100)
    })
  },

  /**
   * 播放/暂停控制（与全局播放器交互）
   */
  onPlayPause() {
    const globalPlayer = this.selectComponent('#globalPlayer')
    if (globalPlayer) {
      if (this.data.isPlaying) {
        globalPlayer.pauseTrack()
      } else {
        globalPlayer.playTrack()
      }
    }
  },

  /**
   * 播放/暂停（兼容旧方法名）
   */
  onTogglePlay() {
    this.onPlayPause()
  },

  /**
   * 停止播放
   */
  onStop() {
    const globalPlayer = this.selectComponent('#globalPlayer')
    if (globalPlayer) {
      globalPlayer.stopTrack()
    }
  },

  /**
   * 显示/隐藏阶段信息
   */
  onTogglePhaseInfo() {
    this.setData({
      showPhaseInfo: !this.data.showPhaseInfo
    })
  },

  /**
   * 跳转到指定阶段
   */
  onJumpToPhase(e) {
    const { phase } = e.currentTarget.dataset
    
    if (!this.data.isoPhases || !this.data.duration) return

    const { iso_phase, transition_phase } = this.data.isoPhases
    let jumpTime = 0

    switch (phase) {
      case 'iso':
        jumpTime = 0
        break
      case 'transition':
        jumpTime = (iso_phase.duration_minutes / this.data.sessionInfo.total_duration_minutes) * this.data.duration
        break
      case 'target':
        jumpTime = ((iso_phase.duration_minutes + transition_phase.duration_minutes) / this.data.sessionInfo.total_duration_minutes) * this.data.duration
        break
    }

    // 使用全局播放器进行跳转
    const globalPlayer = this.selectComponent('#globalPlayer')
    if (globalPlayer && globalPlayer.seekTo) {
      globalPlayer.seekTo(jumpTime)
    }
  },

  /**
   * 下载长序列音乐
   */
  async onDownloadMusic() {
    if (!this.data.sessionInfo) {
      wx.showToast({
        title: '会话信息未加载',
        icon: 'error'
      })
      return
    }

    try {
      wx.showLoading({ title: '下载中...' })
      
      const result = await LongSequenceAPI.downloadLongSequence(this.data.sessionId)
      
      // 保存到本地
      wx.saveFile({
        tempFilePath: result.tempFilePath,
        success: (res) => {
          wx.showToast({
            title: '下载成功',
            icon: 'success'
          })
          console.log('长序列音乐已保存到:', res.savedFilePath)
        },
        fail: (error) => {
          console.error('保存文件失败:', error)
          wx.showToast({
            title: '保存失败',
            icon: 'error'
          })
        }
      })

    } catch (error) {
      console.error('下载长序列音乐失败:', error)
      wx.showToast({
        title: '下载失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 获取阶段描述
   */
  getPhaseDescription(phase) {
    const descriptions = {
      'iso': '同质阶段 - 与当前心境共鸣',
      'transition': '过渡阶段 - 温柔地引导转变',
      'target': '目标阶段 - 抵达内心平静'
    }
    return descriptions[phase] || ''
  },

  /**
   * 获取阶段颜色
   */
  getPhaseColor(phase) {
    const colors = {
      'iso': '#FF6B6B',
      'transition': '#FFB347',
      'target': '#50C878'
    }
    return colors[phase] || '#999'
  },

  /**
   * 格式化时间（模板使用）
   */
  formatTime(seconds) {
    return formatTime(seconds)
  },

  /**
   * 格式化时间显示
   */
  formatTimeDisplay(seconds) {
    return formatTime(seconds)
  },

  /**
   * 切换收藏状态
   */
  onToggleFavorite() {
    this.setData({
      isFavorite: !this.data.isFavorite
    })
    
    wx.showToast({
      title: this.data.isFavorite ? '已收藏' : '已取消收藏',
      icon: 'success'
    })
  },

  /**
   * 返回上一页
   */
  onNavigateBack() {
    wx.navigateBack()
  },

  /**
   * 全局播放器事件处理
   */
  onGlobalPlayerStateChange(e) {
    const { isPlaying, currentTime, duration, progress } = e.detail
    this.setData({ 
      isPlaying, 
      currentTime, 
      duration, 
      progress 
    })

    // 更新当前阶段
    this.updateCurrentPhase(currentTime, duration)
  },

  onNextTrack() {
    // 长序列音乐没有下一首的概念，可以跳转到下个阶段
    const phases = ['iso', 'transition', 'target']
    const currentIndex = phases.indexOf(this.data.currentPhase)
    if (currentIndex < phases.length - 1) {
      this.onJumpToPhase({ currentTarget: { dataset: { phase: phases[currentIndex + 1] } } })
    } else {
      wx.showToast({
        title: '已是最后阶段',
        icon: 'none'
      })
    }
  },

  onPreviousTrack() {
    // 长序列音乐没有上一首的概念，可以跳转到上个阶段
    const phases = ['iso', 'transition', 'target']
    const currentIndex = phases.indexOf(this.data.currentPhase)
    if (currentIndex > 0) {
      this.onJumpToPhase({ currentTarget: { dataset: { phase: phases[currentIndex - 1] } } })
    } else {
      wx.showToast({
        title: '已是第一阶段',
        icon: 'none'
      })
    }
  },

  onCloseGlobalPlayer() {
    wx.navigateBack()
  },

  onExpandGlobalPlayer() {
    console.log('当前已在长序列播放器页面')
  },

  /**
   * 分享
   */
  onShare() {
    this.onShareAppMessage()
  },

  onShareAppMessage() {
    return {
      title: '我在AI疗愈中体验了30分钟完整疗愈',
      path: `/pages/longSequence/player/player?sessionId=${this.data.sessionId}`,
      imageUrl: '/images/share-longplayer.png'
    }
  }
})
