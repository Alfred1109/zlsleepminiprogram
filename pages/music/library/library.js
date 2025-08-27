// pages/music/library/library.js
// 音频库页面
const app = getApp()
const { MusicAPI, LongSequenceAPI } = require('../../../utils/healingApi')
const { getGlobalPlayer, formatTime } = require('../../../utils/musicPlayer')
const AuthService = require('../../../services/AuthService')
const { requireSubscription, getSubscriptionInfo } = require('../../../utils/subscription')

Page({
  data: {
    userInfo: null,
    musicList: [],
    longSequenceList: [],
    currentTab: 'music', // 'music' or 'longSequence'
    loading: false,
    currentPlayingId: null,
    currentPlayingType: null, // 'music' or 'longSequence'
    player: null,
    subscriptionInfo: null,
    canUseFeature: true,
    // 全局播放器相关
    showGlobalPlayer: false,
    isPlaying: false,
    // 订阅状态展示
    subscriptionStatus: {
      type: 'free',
      displayName: '免费用户',
      expiresAt: null,
      daysLeft: 0,
      features: [],
      showUpgrade: false
    }
  },

  onLoad() {
    console.log('音频库页面加载')

    // 检查页面访问权限
    const currentPages = getCurrentPages()
    const currentPage = currentPages[currentPages.length - 1]
    const pagePath = '/' + currentPage.route

    if (!AuthService.getCurrentUser()) {
      console.log('用户未登录，跳转到登录页')
      wx.navigateTo({ url: '/pages/login/login' })
      return // 如果没有权限，跳转到登录页
    }

    this.initPage()
  },

  /**
   * 初始化页面
   */
  async initPage() {
    try {
      // 初始化播放器
      this.initPlayer()
      
      // 检查用户登录状态
      const loginSuccess = await this.checkUserLogin()
      
      if (loginSuccess) {
        // 登录成功，加载数据
        await this.loadMusicData() // Make sure music data is loaded on init
        await this.loadSubscriptionInfo()
        await this.loadSubscriptionStatus()
      } else {
        // 登录失败，显示降级内容
        this.showFallbackContent()
      }
    } catch (error) {
      console.error('页面初始化失败:', error)
      this.showFallbackContent()
    }
  },

  /**
   * 显示降级内容
   */
  showFallbackContent() {
    console.log('显示降级内容')
    this.setData({
      musicList: [],
      longSequenceList: [],
      loading: false,
      userInfo: null,
      showFallback: true
    })
    
    // 显示引导用户登录的提示
    wx.showToast({
      title: '请先登录查看音频库',
      icon: 'none',
      duration: 2000
    })
  },

  onShow() {
    this.loadMusicData()
    this.updatePlayingStatus()
    this.refreshSubscriptionStatus()
  },

  onUnload() {
    // 页面卸载时清理播放器监听
    if (this.data.player) {
      this.data.player.off('play', this.onPlayerPlay)
      this.data.player.off('pause', this.onPlayerPause)
      this.data.player.off('stop', this.onPlayerStop)
    }
  },

  /**
   * 检查用户登录状态
   */
  async checkUserLogin() {
    try {
      console.log('检查用户登录状态...')
      
      if (AuthService.getCurrentUser()) {
        const userInfo = AuthService.getCurrentUser()
        console.log('获取到用户信息:', {
          userInfo: userInfo,
          hasId: !!(userInfo?.id || userInfo?.user_id || userInfo?.userId),
          fields: Object.keys(userInfo || {})
        })
        
        // 验证用户信息的有效性
        if (userInfo && (userInfo.id || userInfo.user_id || userInfo.userId)) {
          this.setData({ userInfo })
          return true
        } else {
          console.warn('用户信息无效，缺少用户ID:', userInfo)
          // 用户信息无效，清除token并重新登录
          AuthService.logout()
          this.promptLogin('用户信息异常，请重新登录')
          return false
        }
      } else {
        console.log('用户未登录')
        this.promptLogin('请先登录后再查看音频库')
        return false
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
      this.promptLogin('登录状态异常，请重新登录')
      return false
    }
  },

  /**
   * 提示用户登录
   */
  promptLogin(message = '需要登录') {
    wx.showModal({
      title: '需要登录',
      content: message,
      confirmText: '去登录',
      cancelText: '返回首页',
      success: (res) => {
        if (res.confirm) {
          wx.redirectTo({
            url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/music/library/library')
          })
        } else {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      }
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
        currentPlayingId: music.id,
        currentPlayingType: music.type || 'music'
      })
    }
  },

  onPlayerPause() {
    // 暂停时不清除当前播放ID，保持状态
  },

  onPlayerStop() {
    this.setData({
      currentPlayingId: null,
      currentPlayingType: null
    })
  },

  /**
   * 更新播放状态
   */
  updatePlayingStatus() {
    const globalData = app.globalData.musicPlayer
    if (globalData && globalData.currentMusic) {
      this.setData({
        currentPlayingId: globalData.currentMusic.id,
        currentPlayingType: globalData.currentMusic.type || 'music'
      })
    }
  },

  /**
   * 加载音频数据
   */
  async loadMusicData() {
    // 检查用户信息
    if (!this.data.userInfo) {
      console.log('用户信息为空，重新获取用户信息')
      await this.checkUserLogin()
      
      // 如果仍然没有用户信息，提示登录
      if (!this.data.userInfo) {
        console.warn('无法获取用户信息，跳过音频数据加载')
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        return
      }
    }

    this.setData({ loading: true })

    try {
      // 更安全地获取用户ID，支持多种字段名
      const userInfo = this.data.userInfo
      const userId = userInfo.id || userInfo.user_id || userInfo.userId // 修正：增加对userId的兼容
      
      console.log('加载音频数据，用户信息:', {
        userInfo: userInfo,
        userId: userId,
        availableFields: Object.keys(userInfo || {})
      })

      if (!userId) {
        console.error('用户ID为空，无法加载音频数据:', userInfo)
        wx.showToast({
          title: '用户信息异常，请重新登录',
          icon: 'none'
        })
        // 跳转到登录页面
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/music/library/library')
          })
        }, 1500)
        return
      }

      // 并行加载60秒音频和长序列音频
      const [musicResult, longSequenceResult] = await Promise.all([
        MusicAPI.getUserMusic(userId).catch((error) => {
          console.error('获取用户音频失败:', error)
          return { data: [] }
        }),
        LongSequenceAPI.getUserLongSequences(userId).catch((error) => {
          console.error('获取用户长序列失败:', error)
          return { data: [] }
        })
      ])

      // 处理音频数据，确保字段映射正确
      const processedMusicList = (musicResult.data || []).map(music => ({
        id: music.id,
        duration: music.duration_seconds,
        file_path: music.file_path,
        status: music.status,
        assessment_scale_name: music.assessment_info?.scale_name,
        assessment_date: music.created_at,
        assessment_score: music.assessment_info?.total_score,
        music_style: '疗愈',
        tempo: '适中',
        mood: '放松疗愈',
        cover_url: '/images/default-music-cover.svg',
        is_favorite: false,
        ...music
      }))

      // 处理长序列数据
      const processedLongSequenceList = (longSequenceResult.data || []).map(sequence => ({
        id: sequence.id,
        title: `长序列音频 #${sequence.id}`,
        total_duration: sequence.total_duration_minutes * 60,
        segments_count: sequence.segment_count,
        description: `基于心理评测生成的${sequence.total_duration_minutes}分钟疗愈音频`,
        created_at: sequence.created_at,
        cover_url: '/images/default-sequence-cover.svg',
        is_favorite: false,
        ...sequence
      }))

      this.setData({
        musicList: processedMusicList,
        longSequenceList: processedLongSequenceList
      })

      console.log('音频数据加载完成:', {
        musicCount: processedMusicList.length,
        longSequenceCount: processedLongSequenceList.length,
        musicData: processedMusicList,
        longSequenceData: processedLongSequenceList
      })

    } catch (error) {
      console.error('加载音频数据失败:', error)
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 切换标签页
   */
  onTabChange(e) {
    const { tab } = e.currentTarget.dataset
    this.setData({ currentTab: tab })
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
      
      // 如果用户没有订阅且有生成的音频，显示订阅提示
      if (!subscriptionInfo.is_subscribed && this.data.musicList.length > 0) {
        this.showSubscriptionTip()
      }
    } catch (error) {
      console.error('加载订阅信息失败:', error)
    }
  },
  
  /**
   * 显示订阅提示
   */
  showSubscriptionTip() {
    // 避免重复显示
    if (this.subscriptionTipShown) return
    this.subscriptionTipShown = true
    
    setTimeout(() => {
      wx.showModal({
        title: '订阅提示',
        content: '您可以免费试听生成的音频。订阅后可享受无限制下载、更多音频库功能和专业疗愈计划。',
        confirmText: '了解订阅',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/subscription/subscription'
            })
          }
        }
      })
    }, 2000) // 延迟2秒显示，避免干扰用户体验
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
   * 播放音频
   */
  async onPlayMusic(e) {
    const { music } = e.currentTarget.dataset
    
    if (!music.file_path && !music.audio_url && !music.url) {
      wx.showToast({
        title: '音频文件不存在',
        icon: 'error'
      })
      return
    }

    // 直接播放音频，移除订阅检查以便用户可以试听
    // 用户可以播放自己生成的音频
    this.playMusicWithGlobalPlayer(music)
  },

  /**
   * 播放音频核心流程
   */
  playMusicProcess(music) {
    // 构建音频对象
    const musicObj = {
      id: music.id,
      title: `疗愈音频 ${music.id}`,
      src: `${app.globalData.apiBaseUrl}${music.file_path}`,
      duration: music.duration_seconds,
      type: 'music'
    }

    // 使用全局播放器播放
    this.data.player.play(musicObj)

    // 跳转到播放页面
    wx.navigateTo({
      url: `/pages/music/player/player?musicId=${music.id}&type=60s`
    })
  },

  /**
   * 播放长序列音频
   */
  async onPlaySequence(e) {
    const { sequence } = e.currentTarget.dataset
    console.log('🎵 点击长序列音频:', sequence)

    // 🔑 优先检查长序列音频权限
    const permissionCheck = await requireSubscription('long_sequence', {
      modalTitle: '长序列音频播放',
      modalContent: '长序列音频功能是高级功能，需要订阅后使用。订阅用户可以播放和生成30分钟长序列疗愈音频。',
      onConfirm: async (action) => {
        if (action === 'trial') {
          // 试用成功后继续播放
          setTimeout(() => {
            this.playSequenceWithGlobalPlayer(sequence)
          }, 1000)
        }
      }
    })

    if (!permissionCheck.allowed) {
      return // 用户取消或需要订阅
    }

    // 检查文件路径（权限检查通过后再检查文件）
    if (!sequence.final_file_path && !sequence.audio_url && !sequence.url) {
      console.log('🔍 长序列音频文件路径缺失，跳转到播放页面获取:', sequence)
      // 跳转到长序列播放页面，由播放页面处理文件加载
      wx.navigateTo({
        url: `/pages/longSequence/player/player?sessionId=${sequence.id}`
      })
      return
    }

    this.playSequenceWithGlobalPlayer(sequence)
  },

  /**
   * 播放长序列音频核心流程
   */
  playSequenceProcess(sequence) {
    // 跳转到长序列播放页面
    wx.navigateTo({
      url: `/pages/longSequence/player/player?sessionId=${sequence.id}`
    })
  },

  /**
   * 跳转到音频生成页面
   */
  onGoToGenerate() {
    // 跳转到评测选择页（tabBar 页面必须使用 switchTab）
    wx.switchTab({
      url: '/pages/assessment/scales/scales'
    })
  },

  /**
   * 跳转到创建长序列页面
   */
  onGoToCreateSequence() {
    wx.navigateTo({
      url: '/pages/longSequence/create/create'
    })
  },

  /**
   * 切换音频收藏状态
   */
  async onToggleFavorite(e) {
    console.log('❤️ 60秒音频收藏按钮被点击', e)
    // 阻止事件冒泡，防止触发播放
    e.stopPropagation && e.stopPropagation()
    
    const { music } = e.currentTarget.dataset
    
    if (!music) {
      console.error('❌ 没有获取到音频数据')
      wx.showToast({
        title: '数据错误',
        icon: 'error'
      })
      return
    }

    console.log('❤️ 切换收藏状态:', {
      id: music.id,
      title: music.title || '60秒音频',
      currentFavorite: music.is_favorite
    })

    try {
      // 这里应该调用API切换收藏状态
      // await MusicAPI.toggleFavorite(music.id)

      // 立即更新本地状态以提供即时反馈
      const musicList = this.data.musicList.map(item => {
        if (item.id === music.id) {
          return { ...item, is_favorite: !item.is_favorite }
        }
        return item
      })

      this.setData({ musicList })

      // 显示反馈
      wx.showToast({
        title: music.is_favorite ? '已取消收藏' : '已添加收藏',
        icon: 'success',
        duration: 1500
      })

      // 这里应该调用API保存收藏状态到服务器
      // await MusicAPI.toggleFavorite(music.id)

    } catch (error) {
      console.error('❌ 切换收藏状态失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
    }
  },

  /**
   * 显示音频菜单
   */
  onShowMusicMenu(e) {
    console.log('📋 60秒音频更多菜单被点击', e)
    // 阻止事件冒泡，防止触发播放
    e.stopPropagation && e.stopPropagation()
    
    const { music } = e.currentTarget.dataset
    
    if (!music) {
      console.error('❌ 没有获取到音频数据')
      wx.showToast({
        title: '数据错误',
        icon: 'error'
      })
      return
    }

    console.log('📋 显示菜单:', {
      id: music.id,
      title: music.title || '60秒音频'
    })

    // 保存音频数据，用于菜单选择回调
    const savedMusic = music

    console.log('📋 准备显示ActionSheet菜单')

    wx.showActionSheet({
      itemList: ['🎵 播放', '📥 下载', '🗑️ 删除'],
      success: (res) => {
        console.log('📋 菜单选择成功:', {
          tapIndex: res.tapIndex,
          selectedAction: ['播放', '下载', '删除'][res.tapIndex],
          music: savedMusic.title || savedMusic.id
        })
        
        if (res.tapIndex === 0) {
          // 播放
          console.log('🎵 从菜单播放60秒音频:', savedMusic.title || `音频#${savedMusic.id}`)
          this.playMusic(savedMusic)
        } else if (res.tapIndex === 1) {
          // 下载
          console.log('📥 从菜单下载60秒音频:', savedMusic.title || `音频#${savedMusic.id}`)
          this.downloadMusic(savedMusic)
        } else if (res.tapIndex === 2) {
          // 删除
          console.log('🗑️ 从菜单删除60秒音频:', savedMusic.title || `音频#${savedMusic.id}`)
          this.deleteMusic(savedMusic)
        }
      },
      fail: (res) => {
        console.log('📋 用户取消菜单选择')
      }
    })
  },

  /**
   * 直接播放60秒音频（不依赖事件对象）
   */
  async playMusic(music) {
    console.log('🎵 直接播放60秒音频:', music)

    // 🔑 优先检查音频播放权限（如果需要）
    // const permissionCheck = await requireSubscription('music', {...})

    // 检查文件路径
    if (!music.file_path && !music.audio_url && !music.url) {
      console.log('🔍 60秒音频文件路径缺失:', music)
      wx.showToast({
        title: '音频文件不存在',
        icon: 'error'
      })
      return
    }

    // 播放音频
    this.playMusicWithGlobalPlayer(music)
  },

  /**
   * 直接下载60秒音频（不依赖事件对象）
   */
  async downloadMusic(music) {
    console.log('📥 直接下载60秒音频:', music)
    
    try {
      wx.showLoading({ title: '下载中...' })
      
      const result = await MusicAPI.downloadMusic(music.id)
      
      // 保存到本地
      const savedPath = await this.saveToLocal(
        result.tempFilePath, 
        `music_${music.id}.wav`
      )
      
      wx.showToast({
        title: '下载成功',
        icon: 'success'
      })

      console.log('60秒音频已保存到:', savedPath)

    } catch (error) {
      console.error('下载60秒音频失败:', error)
      wx.showToast({
        title: '下载失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 直接删除60秒音频（不依赖事件对象）
   */
  deleteMusic(music) {
    console.log('🗑️ 直接删除60秒音频:', music)

    wx.showModal({
      title: '删除音频',
      content: `确定要删除"${music.title || '60秒音频'}"吗？`,
      confirmText: '删除',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            await MusicAPI.deleteMusic(music.id)
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })

            // 刷新列表
            this.loadMusicData()

          } catch (error) {
            console.error('删除60秒音频失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  /**
   * 切换长序列收藏状态
   */
  async onToggleSequenceFavorite(e) {
    console.log('❤️ 收藏按钮被点击', e)
    // 阻止事件冒泡，防止触发播放
    e.stopPropagation && e.stopPropagation()
    
    const { sequence } = e.currentTarget.dataset
    
    if (!sequence) {
      console.error('❌ 没有获取到序列数据')
      wx.showToast({
        title: '数据错误',
        icon: 'error'
      })
      return
    }

    console.log('❤️ 切换收藏状态:', {
      id: sequence.id,
      title: sequence.title,
      currentFavorite: sequence.is_favorite
    })

    try {
      // 立即更新本地状态以提供即时反馈
      const longSequenceList = this.data.longSequenceList.map(item => {
        if (item.id === sequence.id) {
          return { ...item, is_favorite: !item.is_favorite }
        }
        return item
      })

      this.setData({ longSequenceList })

      // 显示反馈
      wx.showToast({
        title: sequence.is_favorite ? '已取消收藏' : '已添加收藏',
        icon: 'success',
        duration: 1500
      })

      // 这里应该调用API保存收藏状态到服务器
      // await LongSequenceAPI.toggleFavorite(sequence.id)

    } catch (error) {
      console.error('❌ 切换收藏状态失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
    }
  },

  /**
   * 显示长序列菜单
   */
  onShowSequenceMenu(e) {
    console.log('📋 更多菜单被点击', e)
    // 阻止事件冒泡，防止触发播放
    e.stopPropagation && e.stopPropagation()
    
    const { sequence } = e.currentTarget.dataset
    
    if (!sequence) {
      console.error('❌ 没有获取到序列数据')
      wx.showToast({
        title: '数据错误',
        icon: 'error'
      })
      return
    }

    console.log('📋 显示菜单:', {
      id: sequence.id,
      title: sequence.title
    })

    // 保存序列数据，用于菜单选择回调
    const savedSequence = sequence

    console.log('📋 准备显示ActionSheet菜单')
    
    wx.showActionSheet({
      itemList: ['🎵 播放', '📥 下载', '🗑️ 删除'],
      success: (res) => {
        console.log('📋 菜单选择成功:', {
          tapIndex: res.tapIndex,
          selectedAction: ['播放', '下载', '删除'][res.tapIndex],
          sequence: savedSequence.title || savedSequence.id
        })
        
        if (res.tapIndex === 0) {
          // 播放 - 直接调用播放逻辑，传递正确的序列数据
          console.log('🎵 从菜单播放长序列:', savedSequence.title || `长序列#${savedSequence.id}`)
          this.playLongSequence(savedSequence)
        } else if (res.tapIndex === 1) {
          // 下载
          console.log('📥 从菜单下载长序列:', savedSequence.title || `长序列#${savedSequence.id}`)
          this.downloadLongSequence(savedSequence)
        } else if (res.tapIndex === 2) {
          // 删除长序列
          console.log('🗑️ 从菜单删除长序列:', savedSequence.title || `长序列#${savedSequence.id}`)
          this.deleteLongSequence(savedSequence)
        }
      },
      fail: (res) => {
        console.log('📋 用户取消菜单选择')
      }
    })
  },

  /**
   * 直接播放长序列音频（不依赖事件对象）
   */
  async playLongSequence(sequence) {
    console.log('🎵 直接播放长序列音频:', sequence)

    // 🔑 优先检查长序列音频权限
    const permissionCheck = await requireSubscription('long_sequence', {
      modalTitle: '长序列音频播放',
      modalContent: '长序列音频功能是高级功能，需要订阅后使用。订阅用户可以播放和生成30分钟长序列疗愈音频。',
      onConfirm: async (action) => {
        if (action === 'trial') {
          // 试用成功后继续播放
          setTimeout(() => {
            this.playSequenceWithGlobalPlayer(sequence)
          }, 1000)
        }
      }
    })

    if (!permissionCheck.allowed) {
      return // 用户取消或需要订阅
    }

    // 检查文件路径（权限检查通过后再检查文件）
    if (!sequence.final_file_path && !sequence.audio_url && !sequence.url) {
      console.log('🔍 长序列音频文件路径缺失，跳转到播放页面获取:', sequence)
      // 跳转到长序列播放页面，由播放页面处理文件加载
      wx.navigateTo({
        url: `/pages/longSequence/player/player?sessionId=${sequence.id}`
      })
      return
    }

    // 权限检查通过，播放音频
    this.playSequenceWithGlobalPlayer(sequence)
  },

  /**
   * 直接下载长序列音频（不依赖事件对象）
   */
  async downloadLongSequence(sequence) {
    console.log('📥 直接下载长序列音频:', sequence)
    
    try {
      wx.showLoading({ title: '下载中...' })
      
      const result = await LongSequenceAPI.downloadLongSequence(sequence.id)
      
      // 保存到本地
      const savedPath = await this.saveToLocal(
        result.tempFilePath, 
        `long_sequence_${sequence.id}.wav`
      )
      
      wx.showToast({
        title: '下载成功',
        icon: 'success'
      })

      console.log('长序列音频已保存到:', savedPath)

    } catch (error) {
      console.error('下载长序列音频失败:', error)
      wx.showToast({
        title: '下载失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 直接删除长序列音频（不依赖事件对象）
   */
  deleteLongSequence(sequence) {
    console.log('🗑️ 直接删除长序列音频:', sequence)

    wx.showModal({
      title: '删除长序列',
      content: `确定要删除"${sequence.title || '长序列音频'}"吗？`,
      confirmText: '删除',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            // await LongSequenceAPI.deleteLongSequence(sequence.id)

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })

            // 刷新列表
            this.loadMusicData()

          } catch (error) {
            console.error('删除长序列失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  /**
   * 删除长序列
   */
  onDeleteLongSequence(e) {
    const { sequence } = e.currentTarget.dataset

    wx.showModal({
      title: '删除长序列',
      content: '确定要删除这个长序列音频吗？',
      confirmText: '删除',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            // await LongSequenceAPI.deleteLongSequence(sequence.id)

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })

            // 刷新列表
            this.loadMusicData()

          } catch (error) {
            console.error('删除长序列失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  /**
   * 下载音频
   */
  async onDownloadMusic(e) {
    const { music } = e.currentTarget.dataset
    
    try {
      wx.showLoading({ title: '下载中...' })
      
      const result = await MusicAPI.downloadMusic(music.id)
      
      // 保存到本地
      const savedPath = await this.saveToLocal(result.tempFilePath, `music_${music.id}.wav`)
      
      wx.showToast({
        title: '下载成功',
        icon: 'success'
      })

      console.log('音频已保存到:', savedPath)

    } catch (error) {
      console.error('下载音频失败:', error)
      wx.showToast({
        title: '下载失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 下载长序列音频
   */
  async onDownloadLongSequence(e) {
    const { session } = e.currentTarget.dataset
    
    try {
      wx.showLoading({ title: '下载中...' })
      
      const result = await LongSequenceAPI.downloadLongSequence(session.id)
      
      // 保存到本地
      const savedPath = await this.saveToLocal(
        result.tempFilePath, 
        `long_sequence_${session.id}.wav`
      )
      
      wx.showToast({
        title: '下载成功',
        icon: 'success'
      })

      console.log('长序列音频已保存到:', savedPath)

    } catch (error) {
      console.error('下载长序列音频失败:', error)
      wx.showToast({
        title: '下载失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 保存文件到本地
   */
  saveToLocal(tempFilePath, fileName) {
    return new Promise((resolve, reject) => {
      wx.saveFile({
        tempFilePath: tempFilePath,
        success: (res) => {
          resolve(res.savedFilePath)
        },
        fail: reject
      })
    })
  },

  /**
   * 删除音频
   */
  onDeleteMusic(e) {
    const { music } = e.currentTarget.dataset
    
    wx.showModal({
      title: '删除音频',
      content: '确定要删除这首音频吗？',
      confirmText: '删除',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            await MusicAPI.deleteMusic(music.id)
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })

            // 刷新列表
            this.loadMusicData()

          } catch (error) {
            console.error('删除音频失败:', error)
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (!bytes) return '未知'
    
    if (bytes < 1024) {
      return bytes + ' B'
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB'
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }
  },

  /**
   * 格式化时长
   */
  formatTime(seconds) {
    return formatTime(seconds)
  },

  /**
   * 格式化日期
   */
  formatDate(dateString) {
    if (!dateString) return ''

    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date

    // 小于1分钟
    if (diff < 60 * 1000) {
      return '刚刚'
    }

    // 小于1小时
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000))
      return `${minutes}分钟前`
    }

    // 小于1天
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000))
      return `${hours}小时前`
    }

    // 小于7天
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000))
      return `${days}天前`
    }

    // 超过7天显示具体日期
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    if (year === now.getFullYear()) {
      return `${month}-${day}`
    } else {
      return `${year}-${month}-${day}`
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadMusicData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    return formatTime(seconds)
  },

  /**
   * 生成音频标题
   */
  generateMusicTitle(music) {
    if (music.title && music.title !== '个性化疗愈音频') {
      return music.title
    }

    // 根据评测信息生成标题
    const scaleName = music.assessment_scale_name || '心理评测'
    const mood = music.mood || '疗愈'
    const date = music.assessment_date ? new Date(music.assessment_date) : new Date(music.created_at)
    const monthDay = `${date.getMonth() + 1}.${date.getDate()}`

    return `${scaleName}·${mood}音频 ${monthDay}`
  },

  /**
   * 格式化评测日期
   */
  formatAssessmentDate(dateString) {
    if (!dateString) return '未知时间'

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
        const month = date.getMonth() + 1
        const day = date.getDate()
        return `${month}月${day}日`
      }
    } catch (error) {
      return '未知时间'
    }
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: 'AI疗愈 - 我的音频库',
      path: '/pages/music/library/library',
      imageUrl: '/images/share-library.png'
    }
  },

  // ==================== 全局播放器相关方法 ====================

  // 全局播放器状态变化
  onGlobalPlayerStateChange(e) {
    const { isPlaying } = e.detail
    this.setData({ isPlaying })
  },

  // 下一首
  onNextTrack() {
    console.log('下一首')
    // 实现切换到下一首的逻辑
    const currentList = this.data.currentTab === 'music' ? this.data.musicList : this.data.longSequenceList
    const currentIndex = currentList.findIndex(item => item.id === this.data.currentPlayingId)
    
    if (currentIndex >= 0 && currentIndex < currentList.length - 1) {
      const nextMusic = currentList[currentIndex + 1]
      this.playMusicWithGlobalPlayer(nextMusic)
    } else {
      wx.showToast({
        title: '已是最后一首',
        icon: 'none'
      })
    }
  },

  // 上一首  
  onPreviousTrack() {
    console.log('上一首')
    // 实现切换到上一首的逻辑
    const currentList = this.data.currentTab === 'music' ? this.data.musicList : this.data.longSequenceList
    const currentIndex = currentList.findIndex(item => item.id === this.data.currentPlayingId)
    
    if (currentIndex > 0) {
      const prevMusic = currentList[currentIndex - 1]
      this.playMusicWithGlobalPlayer(prevMusic)
    } else {
      wx.showToast({
        title: '已是第一首',
        icon: 'none'
      })
    }
  },

  // 关闭播放器
  onCloseGlobalPlayer() {
    this.setData({ 
      showGlobalPlayer: false,
      isPlaying: false,
      currentPlayingId: null,
      currentPlayingType: null
    })
  },

  // 展开播放器
  onExpandGlobalPlayer(e) {
    const { track } = e.detail
    console.log('展开播放器', track)
    // 跳转到详细播放页面
    wx.navigateTo({
      url: '/pages/music/player/player'
    })
  },

  // 使用全局播放器播放音频
  playMusicWithGlobalPlayer(musicInfo) {
    console.log('使用全局播放器播放音频:', musicInfo)
    
    // 构建正确的音频URL
    let audioUrl = musicInfo.audio_url || musicInfo.file_path || musicInfo.path || musicInfo.url
    if (audioUrl && audioUrl.startsWith('/')) {
      // 如果是相对路径，构建完整URL
      const baseUrl = app.globalData.apiBaseUrl.replace('/api', '')
      audioUrl = `${baseUrl}${audioUrl}`
    }
    
    // 准备播放器需要的音频数据格式
    const trackInfo = {
      name: this.generateMusicTitle(musicInfo),
      url: audioUrl,
      image: musicInfo.cover_image || musicInfo.cover_url || musicInfo.image || '/images/default-music-cover.svg',
      category: musicInfo.category || 'AI音频',
      type: this.data.currentTab,
      id: musicInfo.id,
      duration: musicInfo.duration || musicInfo.duration_seconds || 60
    }
    
    console.log('构建的播放信息:', trackInfo)
    
    // 更新当前播放状态
    this.setData({
      showGlobalPlayer: true,
      currentPlayingId: musicInfo.id,
      currentPlayingType: this.data.currentTab
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

  // 使用全局播放器播放长序列音频
  playSequenceWithGlobalPlayer(sequenceInfo) {
    console.log('使用全局播放器播放长序列音频:', sequenceInfo)
    
    // 构建正确的音频URL
    let audioUrl = sequenceInfo.final_file_path || sequenceInfo.audio_url || sequenceInfo.path || sequenceInfo.url
    if (audioUrl && audioUrl.startsWith('/')) {
      // 如果是相对路径，构建完整URL
      const baseUrl = app.globalData.apiBaseUrl.replace('/api', '')
      audioUrl = `${baseUrl}${audioUrl}`
    }
    
    // 准备播放器需要的音频数据格式
    const trackInfo = {
      name: sequenceInfo.title || sequenceInfo.name || '未知长序列',
      url: audioUrl,
      image: sequenceInfo.cover_image || sequenceInfo.cover_url || sequenceInfo.image || '/images/default-sequence-cover.svg',
      category: '长序列音频',
      type: 'longSequence',
      id: sequenceInfo.id,
      duration: sequenceInfo.duration || 1800 // 默认30分钟
    }
    
    // 更新当前播放状态
    this.setData({
      showGlobalPlayer: true,
      currentPlayingId: sequenceInfo.id,
      currentPlayingType: 'longSequence'
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
   * 加载订阅状态展示
   */
  async loadSubscriptionStatus() {
    try {
      const subscriptionInfo = await getSubscriptionInfo()
      
      let status = {
        type: 'free',
        displayName: '免费用户',
        expiresAt: null,
        daysLeft: 0,
        features: ['60秒音频生成'],
        showUpgrade: true,
        statusColor: '#999',
        statusIcon: '👤'
      }

      if (subscriptionInfo) {
        if (subscriptionInfo.subscription_type === 'trial') {
          status = {
            type: 'trial',
            displayName: '试用会员',
            expiresAt: subscriptionInfo.trial_expires_at,
            daysLeft: this.calculateDaysLeft(subscriptionInfo.trial_expires_at),
            features: ['60秒音频生成', 'AI音频生成', '长序列音频'],
            showUpgrade: true,
            statusColor: '#f59e0b',
            statusIcon: '⭐'
          }
        } else if (subscriptionInfo.subscription_type === 'premium') {
          status = {
            type: 'premium',
            displayName: '高级会员',
            expiresAt: subscriptionInfo.premium_expires_at,
            daysLeft: this.calculateDaysLeft(subscriptionInfo.premium_expires_at),
            features: ['60秒音频生成', 'AI音频生成', '长序列音频', '无限播放'],
            showUpgrade: false,
            statusColor: '#10b981',
            statusIcon: '💎'
          }
        } else if (subscriptionInfo.subscription_type === 'vip') {
          status = {
            type: 'vip',
            displayName: 'VIP会员',
            expiresAt: subscriptionInfo.vip_expires_at,
            daysLeft: this.calculateDaysLeft(subscriptionInfo.vip_expires_at),
            features: ['60秒音频生成', 'AI音频生成', '长序列音频', '无限播放', '专属客服'],
            showUpgrade: false,
            statusColor: '#8b5cf6',
            statusIcon: '👑'
          }
        }
      }

      this.setData({
        subscriptionStatus: status
      })

    } catch (error) {
      console.error('加载订阅状态失败:', error)
      // 设置默认免费状态
      this.setData({
        subscriptionStatus: {
          type: 'free',
          displayName: '免费用户',
          expiresAt: null,
          daysLeft: 0,
          features: ['60秒音频生成'],
          showUpgrade: true,
          statusColor: '#999',
          statusIcon: '👤'
        }
      })
    }
  },

  /**
   * 计算剩余天数
   */
  calculateDaysLeft(expiresAt) {
    if (!expiresAt) return 0
    
    const expiryDate = new Date(expiresAt)
    const now = new Date()
    const diffTime = expiryDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(0, diffDays)
  },

  /**
   * 点击升级订阅
   */
  onUpgradeSubscription() {
    wx.navigateTo({
      url: '/pages/subscription/subscription'
    })
  }
})
