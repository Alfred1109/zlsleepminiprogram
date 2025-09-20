// pages/scene/detail/detail.js
// 疗愈场景详情页面
const app = getApp()
const { AssessmentAPI, MusicAPI, LongSequenceAPI } = require('../../../utils/healingApi')
const AuthService = require('../../../services/AuthService')
const { sceneContextManager } = require('../../../utils/sceneContextManager')
const themeMixin = require('../../../utils/themeMixin')

Page({
  data: {
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null,
    
    // 场景信息
    sceneId: null,
    sceneName: '',
    scaleType: '',
    sceneTheme: '',
    
    // 用户状态
    userInfo: null,
    isLoggedIn: false,
    
    // 评测历史
    assessmentHistory: [],
    loadingAssessments: false,
    
    // 脑波历史
    brainwaveHistory: [],
    loadingBrainwaves: false,
    
    // 全局播放器相关
    showGlobalPlayer: false,
    isPlaying: false
  },

  onLoad(options) {
    console.log('🎯 场景详情页面加载，参数:', options)
    
    // 初始化主题
    this.initTheme()
    
    // 解析URL参数
    const { sceneId, sceneName, scaleType, sceneTheme } = options
    this.setData({
      sceneId: parseInt(sceneId) || null,
      sceneName: decodeURIComponent(sceneName || '未知场景'),
      scaleType: scaleType || null,
      sceneTheme: decodeURIComponent(sceneTheme || sceneName || '疗愈场景')
    })
    
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: this.data.sceneName
    })
    
    // 检查登录状态并加载数据
    this.checkLoginAndLoadData()
  },

  onShow() {
    // 重新检查登录状态
    this.checkLoginAndLoadData()
  },

  onUnload() {
    // 页面卸载时清除场景上下文
    console.log('🔄 场景详情页面卸载，清除场景上下文')
    sceneContextManager.clearSceneContext()
  },

  /**
   * 检查登录状态并加载数据
   */
  async checkLoginAndLoadData() {
    try {
      const userInfo = AuthService.getCurrentUser()
      const isLoggedIn = !!userInfo
      
      this.setData({
        userInfo,
        isLoggedIn
      })
      
      // 设置场景上下文，无论是否登录都要设置，这样音乐库能知道当前场景
      this.setSceneContext()
      
      if (isLoggedIn) {
        console.log('✅ 用户已登录，加载场景数据')
        // 并行加载评测历史和脑波历史
        await Promise.all([
          this.loadAssessmentHistory(),
          this.loadBrainwaveHistory()
        ])
      } else {
        console.log('ℹ️ 用户未登录，显示登录引导')
        this.setData({
          assessmentHistory: [],
          brainwaveHistory: []
        })
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
    }
  },

  /**
   * 设置场景上下文
   */
  setSceneContext() {
    const { sceneId, sceneName, scaleType, sceneTheme } = this.data
    
    if (sceneId) {
      console.log('🎯 设置场景上下文:', { sceneId, sceneName, scaleType, sceneTheme })
      
      sceneContextManager.setSceneContext({
        sceneId,
        sceneName,
        scaleType,
        sceneTheme,
        source: '/pages/scene/detail/detail'
      })
    }
  },

  /**
   * 加载评测历史（针对当前场景）
   */
  async loadAssessmentHistory() {
    if (!this.data.userInfo) return
    
    this.setData({ loadingAssessments: true })
    
    try {
      const userId = this.data.userInfo.id || this.data.userInfo.user_id
      const result = await AssessmentAPI.getHistory(userId)
      
      if (result.success && result.data) {
        // 过滤与当前场景相关的评测记录
        let filteredAssessments = result.data.filter(item => item.status === 'completed')
        
        // 如果有特定的量表类型，只显示该类型的评测
        if (this.data.scaleType) {
          filteredAssessments = filteredAssessments.filter(item => 
            item.scale_type === this.data.scaleType || item.scale_name === this.data.scaleType
          )
        }
        
        // 按时间倒序排列
        const sortedAssessments = filteredAssessments
          .sort((a, b) => {
            const dateA = new Date(a.completed_at || a.created_at || 0)
            const dateB = new Date(b.completed_at || b.created_at || 0)
            return dateB - dateA
          })
          .slice(0, 10) // 最多显示10条
          .map(item => ({
            id: item.id || item.assessment_id,
            date: this.formatDate(item.completed_at || item.created_at),
            result: this.getAssessmentResultText(item.result || item.score),
            scaleName: item.scale_name || '心理评测',
            scaleType: item.scale_type,
            score: item.result || item.score,
            rawData: item
          }))
        
        this.setData({
          assessmentHistory: sortedAssessments
        })
        
        console.log(`📊 场景${this.data.sceneName}评测历史加载完成:`, {
          总数: result.data.length,
          场景相关: filteredAssessments.length,
          显示: sortedAssessments.length
        })
      } else {
        console.warn('评测历史加载失败:', result.error)
        this.setData({ assessmentHistory: [] })
      }
    } catch (error) {
      console.error('加载评测历史异常:', error)
      this.setData({ assessmentHistory: [] })
    } finally {
      this.setData({ loadingAssessments: false })
    }
  },

  /**
   * 加载脑波历史（针对当前场景）
   */
  async loadBrainwaveHistory() {
    if (!this.data.userInfo) return
    
    this.setData({ loadingBrainwaves: true })
    
    try {
      const userId = this.data.userInfo.id || this.data.userInfo.user_id
      
      // 并行获取60秒音频和长序列音频
      const [musicResult, longSequenceResult] = await Promise.allSettled([
        MusicAPI.getUserMusic(userId),
        LongSequenceAPI.getUserLongSequences(userId)
      ])
      
      let allBrainwaves = []
      
      // 处理60秒音频
      if (musicResult.status === 'fulfilled' && musicResult.value.success && musicResult.value.data) {
        const userMusic = musicResult.value.data.map(item => ({
          id: item.id,
          name: this.generate60sAudioName(item),
          date: this.formatDate(item.updated_at || item.created_at),
          duration: item.duration_seconds || 60,
          url: item.url || item.audio_url || item.file_path,
          image: '/images/default-music-cover.svg',
          type: '60s_generated',
          rawData: item
        }))
        allBrainwaves.push(...userMusic)
      }
      
      // 处理长序列音频
      if (longSequenceResult.status === 'fulfilled' && longSequenceResult.value.success && longSequenceResult.value.data) {
        const longSequences = longSequenceResult.value.data
          .filter(item => item.status === 'completed' && item.final_file_path)
          .map(item => ({
            id: item.session_id,
            name: this.getBrainwaveDisplayName(item),
            date: this.formatDate(item.updated_at || item.created_at),
            duration: item.duration_minutes ? item.duration_minutes * 60 : 1800,
            url: item.final_file_path,
            image: '/images/default-music-cover.svg',
            type: 'long_sequence',
            rawData: item
          }))
        allBrainwaves.push(...longSequences)
      }
      
      // 按时间排序
      allBrainwaves.sort((a, b) => {
        const dateA = new Date(a.rawData.updated_at || a.rawData.created_at || 0)
        const dateB = new Date(b.rawData.updated_at || b.rawData.created_at || 0)
        return dateB - dateA
      })
      
      this.setData({
        brainwaveHistory: allBrainwaves.slice(0, 10) // 最多显示10条
      })
      
      console.log(`🧠 场景${this.data.sceneName}脑波历史加载完成:`, allBrainwaves.length)
    } catch (error) {
      console.error('加载脑波历史异常:', error)
      this.setData({ brainwaveHistory: [] })
    } finally {
      this.setData({ loadingBrainwaves: false })
    }
  },

  /**
   * 跳转到评测页面
   */
  navigateToAssessment() {
    console.log('🚀 跳转到评测页面')
    
    // 如果未登录，先引导登录
    if (!this.data.isLoggedIn) {
      this.promptLogin('进行专业评测需要先登录账户')
      return
    }
    
    // 设置场景上下文
    sceneContextManager.setSceneContext({
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType,
      sceneTheme: this.data.sceneTheme,
      source: '/pages/scene/detail/detail'
    })
    
    console.log('🎯 设置场景上下文后跳转到评测页面:', {
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType
    })
    
    wx.switchTab({
      url: '/pages/assessment/scales/scales'
    })
  },

  /**
   * 跳转到AI生成脑波页面
   */
  navigateToGenerator() {
    console.log('🧠 跳转到AI生成脑波页面')
    
    // 如果未登录，先引导登录
    if (!this.data.isLoggedIn) {
      this.promptLogin('生成AI脑波需要先登录账户')
      return
    }
    
    // 设置场景上下文
    sceneContextManager.setSceneContext({
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType,
      sceneTheme: this.data.sceneTheme,
      source: '/pages/scene/detail/detail'
    })
    
    console.log('🎯 设置场景上下文后跳转到脑波生成页面:', {
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType
    })
    
    wx.navigateTo({
      url: '/pages/longSequence/create/create'
    })
  },

  /**
   * 跳转到脑波库页面
   */
  navigateToMusicLibrary() {
    console.log('🧠 跳转到脑波库页面')
    
    // 设置场景上下文
    sceneContextManager.setSceneContext({
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType,
      sceneTheme: this.data.sceneTheme,
      source: '/pages/scene/detail/detail'
    })
    
    console.log('🎯 设置场景上下文后跳转到脑波库页面:', {
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType
    })
    
    wx.switchTab({
      url: '/pages/music/library/library'
    })
  },

  /**
   * 查看评测结果
   */
  onViewAssessmentResult(e) {
    const assessmentId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/assessment/result/result?id=${assessmentId}`
    })
  },

  /**
   * 播放历史脑波
   */
  onPlayHistoryBrainwave(e) {
    const music = e.currentTarget.dataset.music
    
    if (!this.data.isLoggedIn) {
      this.promptLogin('播放脑波需要先登录账户')
      return
    }

    if (!music.url) {
      wx.showToast({
        title: '脑波文件不存在',
        icon: 'error'
      })
      return
    }

    console.log('🎵 播放历史脑波:', music)

    // 构建播放器数据
    const trackInfo = {
      name: music.name || '未知脑波',
      url: music.url,
      image: music.image || '/images/default-music-cover.svg',
      category: music.type === '60s_generated' ? '60秒脑波' : '长序列脑波',
      type: music.type || 'brainwave',
      id: music.id,
      duration: music.duration || 60
    }

    // 如果是相对路径，转换为完整URL
    if (trackInfo.url && trackInfo.url.startsWith('/')) {
      const baseUrl = app.globalData.apiBaseUrl ? app.globalData.apiBaseUrl.replace('/api', '') : 'https://medsleep.cn'
      trackInfo.url = `${baseUrl}${trackInfo.url}`
    }

    // 显示全局播放器
    this.setData({
      showGlobalPlayer: true
    })

    // 使用全局播放器播放
    setTimeout(() => {
      const globalPlayer = this.selectComponent('#globalPlayer')
      if (globalPlayer && globalPlayer.playTrack) {
        globalPlayer.playTrack(trackInfo)
      } else {
        console.warn('全局播放器组件未找到')
        wx.showToast({
          title: '播放器初始化失败',
          icon: 'none'
        })
      }
    }, 100)
  },

  /**
   * 登录提示
   */
  promptLogin(message = '该功能需要先登录账户') {
    wx.showModal({
      title: '需要登录',
      content: message,
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/login/login?redirect=' + encodeURIComponent(`/pages/scene/detail/detail?sceneId=${this.data.sceneId}&sceneName=${encodeURIComponent(this.data.sceneName)}&scaleType=${this.data.scaleType}&sceneTheme=${encodeURIComponent(this.data.sceneTheme)}`)
          })
        }
      }
    })
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
      if (!e || !e.detail) {
        console.error('主题切换事件参数错误:', e);
        return;
      }

      const { theme, config } = e.detail;
      
      if (!theme || !config) {
        console.error('主题切换缺少必要参数:', { theme, config });
        return;
      }

      console.log('场景页面主题切换到:', theme, config);
      
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

      // 显示主题切换反馈
      wx.showToast({
        title: `已应用${config.name}`,
        icon: 'none',
        duration: 1500
      });
    } catch (error) {
      console.error('场景页面主题切换处理失败:', error);
    }
  },

  /**
   * 格式化日期显示
   */
  formatDate(dateString) {
    if (!dateString) return '未知日期'
    
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = now - date
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) {
        return '今天'
      } else if (diffDays === 1) {
        return '昨天'
      } else if (diffDays < 7) {
        return `${diffDays}天前`
      } else {
        return date.toLocaleDateString('zh-CN', { 
          month: 'numeric', 
          day: 'numeric' 
        })
      }
    } catch (error) {
      console.warn('日期格式化失败:', dateString, error)
      return '未知日期'
    }
  },

  /**
   * 获取评测结果文本
   */
  getAssessmentResultText(result) {
    if (!result) return '评测完成'
    
    if (typeof result === 'number') {
      if (result >= 80) return '状态良好'
      else if (result >= 60) return '轻度压力'
      else if (result >= 40) return '中度压力'
      else return '需要关注'
    }
    
    return result.toString()
  },

  /**
   * 生成60秒音频显示名称
   */
  generate60sAudioName(item) {
    if (item.assessment_info) {
      const assessmentInfo = item.assessment_info
      const scaleName = assessmentInfo.scale_name || assessmentInfo.scaleName || '心理评测'
      const result = this.getAssessmentResultText(assessmentInfo.total_score)
      return `${scaleName} · ${result}`
    }
    
    if (item.assessment_id) {
      return `评测脑波 #${item.assessment_id}`
    }
    
    if (item.title && item.title !== '60秒定制音乐') {
      return item.title
    }
    
    return `60秒疗愈脑波 #${item.id}`
  },

  /**
   * 获取脑波显示名称
   */
  getBrainwaveDisplayName(item) {
    if (item.title && item.title !== '60秒定制音乐') return item.title
    if (item.name && item.name !== '60秒定制音乐') return item.name
    
    const duration = item.duration_seconds || item.duration_minutes * 60 || 0
    if (duration <= 120) {
      return '60秒定制音乐'
    } else if (duration >= 1800) {
      return '长序列脑波'
    }
    
    const id = item.session_id || item.id || 'unknown'
    return `定制音乐-${id.toString().substring(0, 8)}`
  },

  // ==================== 全局播放器相关 ====================

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

  onExpandGlobalPlayer(e) {
    const { track } = e.detail
    console.log('展开播放器', track)
    wx.navigateTo({
      url: '/pages/music/player/player'
    })
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.checkLoginAndLoadData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: `AI疗愈 - ${this.data.sceneName}`,
      path: `/pages/scene/detail/detail?sceneId=${this.data.sceneId}&sceneName=${encodeURIComponent(this.data.sceneName)}&scaleType=${this.data.scaleType}&sceneTheme=${encodeURIComponent(this.data.sceneTheme)}`,
      imageUrl: '/images/share-scene.png'
    }
  }
})
