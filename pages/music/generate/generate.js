// pages/music/generate/generate.js
// 音乐生成页面
const app = getApp()
const { AssessmentAPI, MusicAPI } = require('../../../utils/healingApi')
const { requireSubscription, getSubscriptionInfo } = require('../../../utils/subscription')
const { getGlobalPlayer, formatTime } = require('../../../utils/musicPlayer')
const { sceneContextManager } = require('../../../utils/sceneContextManager')
const { sceneMappingService } = require('../../../utils/sceneMappingService')
const themeMixin = require('../../../utils/themeMixin')

Page({
  data: {
    userInfo: null,
    recentAssessments: [],
    selectedAssessment: null,          // 单选模式使用
    selectedAssessments: [],           // 多选模式使用
    selectionMode: 'single',           // 'single' | 'multiple'
    generating: false,
    // UI简化字段
    canGenerate: false,
    generateButtonText: '生成音乐',
    generatingText: '生成中...',
    selectedCount: 0,
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
    themeConfig: null,
    // 场景上下文相关
    sceneContext: null,
    isInSceneMode: false,
    sceneHint: '',
    // 预选评测ID（从评测结果页面跳转时使用）
    preselectedAssessmentId: null
  },

  onLoad(options) {
    console.log('🎵 音乐生成页面加载', options)
    
    // 保存预选的评测ID
    if (options.assessmentId) {
      this.setData({
        preselectedAssessmentId: parseInt(options.assessmentId)
      })
      console.log('🎯 预选评测ID:', options.assessmentId)
    }
    
    // 检查场景上下文
    this.checkSceneContext()
    
    this.initTheme()
    this.initPlayer()
    this.checkUserLogin()
    this.loadRecentAssessments()
    this.loadSubscriptionInfo()
  },

  onShow() {
    // 检查场景上下文变化
    this.checkSceneContext()
    
    this.loadRecentAssessments()
    this.refreshSubscriptionStatus()
  },

  /**
   * 检查场景上下文
   */
  checkSceneContext() {
    const context = sceneContextManager.getCurrentContext()
    const isInSceneMode = !!context
    const selectionMode = isInSceneMode ? 'multiple' : 'single'
    
    this.setData({
      sceneContext: context,
      isInSceneMode: isInSceneMode,
      selectionMode: selectionMode,
      sceneHint: context ? `当前在「${context.sceneName}」场景中，可选择多个评测进行综合生成` : ''
    })
    
    console.log('🎯 音乐生成页面场景上下文:', {
      isInSceneMode: this.data.isInSceneMode,
      selectionMode: this.data.selectionMode,
      sceneContext: context
    })
    
    // 模式切换时重置选择状态
    if (selectionMode === 'single') {
      this.setData({ 
        selectedAssessments: [],
        selectedAssessment: this.data.recentAssessments[0] || null
      })
    } else {
      this.setData({ 
        selectedAssessment: null,
        selectedAssessments: []
      })
    }
    
    // 如果评测数据已经加载且进入了场景模式，重新过滤评测
    if (this.data.recentAssessments.length > 0) {
      this.loadRecentAssessments()
    }
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
        let completedAssessments = result.data || []

        // 使用场景映射服务过滤评测记录（与其他页面保持一致）
        const { sceneContext, isInSceneMode } = this.data
        if (isInSceneMode && sceneContext) {
          try {
            const sceneFilterPromises = completedAssessments.map(item => 
              sceneMappingService.isScaleMatchingScene(
                item, 
                sceneContext.sceneId, 
                sceneContext.sceneName
              )
            )
            
            const matchResults = await Promise.all(sceneFilterPromises)
            const filteredAssessments = completedAssessments.filter((item, index) => matchResults[index])
            
            console.log(`🎯 音乐生成页面场景${sceneContext.sceneName}(ID:${sceneContext.sceneId})评测过滤:`, {
              原始数量: completedAssessments.length,
              场景相关: filteredAssessments.length
            })
            
            completedAssessments = filteredAssessments
            
          } catch (error) {
            console.error('❌ 音乐生成页面场景评测过滤失败，显示所有评测:', error)
            // 过滤失败时保持原始数据
          }
        }

        this.setData({
          recentAssessments: completedAssessments.slice(0, 5) // 最近5条
        })

        // 根据选择模式初始化选择状态
        this.initializeSelectionState(completedAssessments)
        
        console.log(`🎯 音乐生成页面评测记录加载完成:`, {
          模式: this.data.selectionMode,
          总数: completedAssessments.length,
          显示数量: Math.min(completedAssessments.length, 5)
        })
      }
    } catch (error) {
      console.error('加载评测历史失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 选择评测记录（统一处理单选和多选）
   */
  onSelectAssessment(e) {
    const { assessment } = e.currentTarget.dataset
    const { selectionMode } = this.data
    
    if (selectionMode === 'single') {
      // 单选模式：直接设置选中的评测
      this.setData({ selectedAssessment: assessment })
      this.updateUIState() // 更新UI状态
      console.log('🎯 单选模式选择评测:', assessment.scale_name)
      
    } else {
      // 多选模式：切换选中状态
      this.toggleAssessmentSelection(assessment)
    }
  },

  /**
   * 切换评测记录的选中状态（多选模式）
   */
  toggleAssessmentSelection(assessment) {
    const { selectedAssessments } = this.data
    const isSelected = selectedAssessments.some(item => item.id === assessment.id)
    
    let newSelectedAssessments
    if (isSelected) {
      // 取消选中
      newSelectedAssessments = selectedAssessments.filter(item => item.id !== assessment.id)
      console.log('🎯 多选模式取消选择:', assessment.scale_name)
    } else {
      // 选中
      newSelectedAssessments = [...selectedAssessments, assessment]
      console.log('🎯 多选模式选择评测:', assessment.scale_name)
    }
    
    this.setData({ selectedAssessments: newSelectedAssessments })
    
    // 更新UI状态
    this.updateUIState()
    
    console.log('🎯 多选模式当前选择:', {
      总数: newSelectedAssessments.length,
      量表: newSelectedAssessments.map(item => item.scale_name)
    })
  },

  /**
   * 检查评测是否被选中（用于UI显示）
   */
  isAssessmentSelected(assessment) {
    const { selectionMode, selectedAssessment, selectedAssessments } = this.data
    
    if (selectionMode === 'single') {
      return selectedAssessment && selectedAssessment.id === assessment.id
    } else {
      return selectedAssessments.some(item => item.id === assessment.id)
    }
  },

  /**
   * 根据选择模式初始化选择状态
   */
  initializeSelectionState(assessments) {
    const { selectionMode, preselectedAssessmentId } = this.data
    const displayAssessments = assessments.slice(0, 5)
    
    if (selectionMode === 'single') {
      // 单选模式：优先选择预选评测，否则选择第一个
      let initialSelection = displayAssessments[0] || null
      
      if (preselectedAssessmentId) {
        const preselected = displayAssessments.find(item => item.id === preselectedAssessmentId)
        if (preselected) {
          initialSelection = preselected
          console.log('🎯 预选评测匹配成功:', preselected.scale_name)
        } else {
          console.log('⚠️ 预选评测在当前场景中不存在，使用默认选择')
        }
      }
      
      this.setData({
        selectedAssessment: initialSelection,
        selectedAssessments: []
      })
      
      console.log('🎯 单选模式选择评测:', initialSelection?.scale_name || '无')
      
    } else {
      // 多选模式：如果有预选评测，确保它被选中，否则全选所有相关评测
      let initialSelections = [...displayAssessments] // 默认全选
      
      if (preselectedAssessmentId) {
        const preselected = displayAssessments.find(item => item.id === preselectedAssessmentId)
        if (preselected) {
          // 如果找到预选评测，确保它在选中列表中（通常已经在全选中了）
          console.log('🎯 多选模式预选评测:', preselected.scale_name, '+ 其他相关评测')
        }
      }
      
      this.setData({
        selectedAssessment: null,
        selectedAssessments: initialSelections
      })
      
      console.log('🎯 多选模式选择评测:', initialSelections.map(item => item.scale_name))
    }
    
    // 更新UI状态
    this.updateUIState()
  },

  /**
   * 检查是否可以生成音乐
   */
  canGenerateMusic() {
    const { selectionMode, selectedAssessment, selectedAssessments, generating } = this.data
    
    if (generating) return false
    
    if (selectionMode === 'single') {
      return !!selectedAssessment
    } else {
      return selectedAssessments.length > 0
    }
  },

  /**
   * 更新UI状态（简化WXML表达式）
   */
  updateUIState() {
    const { selectionMode, selectedAssessment, selectedAssessments, generating, recentAssessments } = this.data
    
    // 计算基础状态
    const selectedCount = selectedAssessments.length
    const canGenerate = !generating && (
      (selectionMode === 'single' && !!selectedAssessment) ||
      (selectionMode === 'multiple' && selectedCount > 0)
    )
    
    // 计算按钮文案
    let generateButtonText
    let generatingText
    
    if (selectionMode === 'single') {
      generateButtonText = '生成音乐'
      generatingText = '生成中...'
    } else {
      generateButtonText = selectedCount > 0 ? `综合生成音乐 (${selectedCount}个评测)` : '选择评测后生成'
      generatingText = '综合生成中...'
    }
    
    // 给评测记录添加选中状态标记
    const updatedAssessments = recentAssessments.map(item => ({
      ...item,
      isSelected: this.isAssessmentSelected(item)
    }))
    
    // 批量更新状态
    this.setData({
      canGenerate,
      generateButtonText,
      generatingText,
      selectedCount,
      recentAssessments: updatedAssessments
    })
    
    console.log('🎯 UI状态更新:', {
      selectionMode,
      selectedCount,
      canGenerate,
      generateButtonText
    })
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
    this.updateUIState()

    try {
      let result
      const { selectionMode, selectedAssessment, selectedAssessments } = this.data
      
      if (selectionMode === 'single') {
        // 单选模式：基于单个评测生成
        console.log('🎵 单选模式生成音乐，评测ID:', selectedAssessment.id)
        result = await MusicAPI.generateMusic(selectedAssessment.id)
        
      } else {
        // 多选模式：基于多个评测综合生成
        const assessmentIds = selectedAssessments.map(item => item.id)
        console.log('🎵 多选模式生成音乐，评测IDs:', assessmentIds)
        console.log('🎵 基于量表:', selectedAssessments.map(item => item.scale_name))
        
        // 尝试调用多选API，如果不存在则使用第一个评测ID
        try {
          // TODO: 这里需要后端支持多评测ID的API
          // result = await MusicAPI.generateMusicMultiple(assessmentIds)
          
          // 临时方案：使用第一个评测ID，但在请求中传递其他信息
          result = await MusicAPI.generateMusic(assessmentIds[0], {
            mode: 'comprehensive',
            additionalAssessments: assessmentIds.slice(1),
            sceneContext: this.data.sceneContext
          })
        } catch (error) {
          // 如果多选API不存在，降级使用第一个评测
          console.warn('⚠️ 多选音乐生成API暂未支持，使用第一个评测:', selectedAssessments[0].scale_name)
          result = await MusicAPI.generateMusic(assessmentIds[0])
        }
      }
      
      if (result.success) {
        this.setData({ musicResult: result.data })
        
        const successMessage = selectionMode === 'single' 
          ? '音乐生成成功' 
          : `综合${selectedAssessments.length}个评测的音乐生成成功`
          
        wx.showToast({
          title: successMessage,
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
      this.updateUIState()
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
