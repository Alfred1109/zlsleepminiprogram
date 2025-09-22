// pages/longSequence/create/create.js
// 长序列脑波创建页面
const app = getApp()
const { AssessmentAPI, LongSequenceAPI } = require('../../../utils/healingApi')
const { sceneContextManager } = require('../../../utils/sceneContextManager')
const { sceneMappingService } = require('../../../utils/sceneMappingService')

Page({
  data: {
    userInfo: null,
    recentAssessments: [],
    selectedAssessment: null,          // 单选模式使用
    selectedAssessments: [],           // 多选模式使用
    selectionMode: 'single',           // 'single' | 'multiple'
    preselectedAssessmentId: null, // 新增：预选的评测ID
    durationMinutes: 30,
    // UI简化字段
    canGenerate: false,
    selectedCount: 0,
    durationOptions: [
      { value: 10, label: '10分钟', description: '短时间放松' },
      { value: 20, label: '20分钟', description: '中等时长疗愈' },
      { value: 30, label: '30分钟', description: '完整疗愈体验' },
      { value: 45, label: '45分钟', description: '深度疗愈' },
      { value: 60, label: '60分钟', description: '长时间冥想' }
    ],
    generating: false,
    generationProgress: 0,
    currentPhase: '',
    sessionResult: null,
    loading: false,
    // 场景上下文相关
    sceneContext: null,
    isInSceneMode: false,
    sceneHint: ''
  },

  onLoad(options) {
    console.log('长序列创建页面加载', options)
    
    // 检查场景上下文
    this.checkSceneContext()
    
    // 获取传入的评测ID（从评测结果页面跳转过来时会有）
    const { assessmentId } = options
    if (assessmentId) {
      this.setData({ 
        preselectedAssessmentId: parseInt(assessmentId)
      })
      console.log('接收到预选评测ID:', assessmentId)
    }
    
    // 修改：允许未登录用户查看脑波生成页面
    this.checkUserLogin()
    this.loadRecentAssessments()
  },

  onShow() {
    // 检查场景上下文变化
    this.checkSceneContext()
    
    // 每次显示时检查登录状态
    const AuthService = require('../../../services/AuthService')
    const userInfo = AuthService.getCurrentUser()
    if (userInfo) {
      this.setData({ userInfo })
      this.loadRecentAssessments()
    } else {
      this.setData({ userInfo: null, recentAssessments: [] })
    }
  },

  /**
   * 检查场景上下文
   */
  checkSceneContext() {
    const context = sceneContextManager.getCurrentContext()
    const isInSceneMode = !!context
    
    // 根据场景模式决定选择模式
    const selectionMode = isInSceneMode ? 'multiple' : 'single'
    const sceneHint = context 
      ? `当前在「${context.sceneName}」场景中，可综合多个量表结果进行深度疗愈` 
      : ''
    
    // 重置选择状态当模式发生变化时
    const currentMode = this.data.selectionMode
    const resetSelections = currentMode !== selectionMode
    
    this.setData({
      sceneContext: context,
      isInSceneMode,
      selectionMode,
      sceneHint,
      ...(resetSelections ? {
        selectedAssessment: null,
        selectedAssessments: []
      } : {})
    })
    
    console.log('🎯 长序列创建页面场景上下文:', {
      isInSceneMode,
      selectionMode,
      sceneContext: context,
      模式变化: resetSelections
    })
    
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
        console.log('✅ 检测到用户信息，加载完整页面数据')
        this.setData({ userInfo })
      } else {
        console.log('ℹ️ 用户未登录，仅显示脑波生成界面')
        this.setData({ userInfo: null })
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
            
            console.log(`🎯 长序列创建页面场景${sceneContext.sceneName}(ID:${sceneContext.sceneId})评测过滤:`, {
              原始数量: completedAssessments.length,
              场景相关: filteredAssessments.length
            })
            
            completedAssessments = filteredAssessments
            
          } catch (error) {
            console.error('❌ 长序列创建页面场景评测过滤失败，显示所有评测:', error)
            // 过滤失败时保持原始数据
          }
        }

        this.setData({
          recentAssessments: completedAssessments.slice(0, 5)
        })

        // 根据选择模式初始化选择状态
        this.initializeSelectionState(completedAssessments)
        
        console.log(`🎯 长序列创建页面评测记录加载完成:`, {
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
   * 选择评测记录
   */
  onSelectAssessment(e) {
    const { assessment } = e.currentTarget.dataset
    const { selectionMode } = this.data
    
    if (selectionMode === 'single') {
      // 单选模式：直接设置选中的评测
      this.setData({ selectedAssessment: assessment })
      this.updateUIState()
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
      console.log('🎯 多选模式取消选择评测:', assessment.scale_name)
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
   * 更新UI状态（简化WXML表达式）
   */
  updateUIState() {
    const { selectionMode, selectedAssessment, selectedAssessments, recentAssessments } = this.data
    
    // 计算基础状态
    const selectedCount = selectedAssessments.length
    const canGenerate = (
      (selectionMode === 'single' && !!selectedAssessment) ||
      (selectionMode === 'multiple' && selectedCount > 0)
    )
    
    // 给评测记录添加选中状态标记
    const updatedAssessments = recentAssessments.map(item => ({
      ...item,
      isSelected: this.isAssessmentSelected(item)
    }))
    
    // 批量更新状态
    this.setData({
      canGenerate,
      selectedCount,
      recentAssessments: updatedAssessments
    })
    
    console.log('🎯 长序列UI状态更新:', {
      selectionMode,
      selectedCount,
      canGenerate
    })
  },

  /**
   * 选择时长
   */
  onSelectDuration(e) {
    const { duration } = e.currentTarget.dataset
    this.setData({ durationMinutes: duration })
  },

  /**
   * 创建长序列脑波（模板调用的方法名）
   */
  async onCreateSequence() {
    return this.onStartGeneration()
  },

  /**
   * 开始生成长序列
   */
  async onStartGeneration() {
    // 检查登录状态，未登录时引导用户登录
    if (!this.data.userInfo) {
      wx.showModal({
        title: '需要登录',
        content: '创建AI脑波需要先登录账户，立即前往登录页面？',
        showCancel: true,
        cancelText: '取消',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ 
              url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/longSequence/create/create')
            })
          }
        }
      })
      return
    }

    // 检查是否有选中的评测记录
    const { selectionMode, selectedAssessment, selectedAssessments } = this.data
    const hasSelection = (selectionMode === 'single' && selectedAssessment) || 
                        (selectionMode === 'multiple' && selectedAssessments.length > 0)
    
    if (!hasSelection) {
      wx.showToast({
        title: '请选择评测记录',
        icon: 'error'
      })
      return
    }

    // 显示确认对话框
    const confirmed = await this.showConfirmDialog()
    if (!confirmed) return

    this.setData({ 
      generating: true,
      generationProgress: 0,
      currentPhase: '初始化...'
    })

    try {
      let result
      const { selectionMode, selectedAssessment, selectedAssessments, durationMinutes } = this.data
      
      if (selectionMode === 'single') {
        // 单选模式：基于单个评测生成
        console.log('🎵 单选模式生成长序列，评测ID:', selectedAssessment.id)
        result = await LongSequenceAPI.createLongSequence(
          selectedAssessment.id,
          durationMinutes
        )
      } else {
        // 多选模式：基于多个评测综合生成
        const assessmentIds = selectedAssessments.map(item => item.id)
        console.log('🎵 多选模式生成长序列，评测IDs:', assessmentIds)
        console.log('🎵 基于量表:', selectedAssessments.map(item => item.scale_name))
        
        // 调用综合生成API
        result = await LongSequenceAPI.createLongSequence(
          assessmentIds[0], 
          durationMinutes, 
          {
            mode: 'comprehensive',
            additionalAssessments: assessmentIds.slice(1),
            sceneContext: this.data.sceneContext
          }
        )
      }
      
      if (result.success) {
        this.setData({ 
          sessionResult: result.data,
          generationProgress: 100,
          currentPhase: '生成完成'
        })
        
        const successMessage = selectionMode === 'single'
          ? '长序列生成成功'
          : `综合${selectedAssessments.length}个评测的长序列生成成功`
          
        wx.showToast({
          title: successMessage,
          icon: 'success'
        })

        // 跳转到播放页面
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/longSequence/player/player?sessionId=${result.data.session_id}`
          })
        }, 2000)
      } else {
        throw new Error(result.error || '生成失败')
      }

    } catch (error) {
      console.error('生成长序列失败:', error)
      wx.showModal({
        title: '生成失败',
        content: error.message || '长序列生成失败，请重试',
        showCancel: true,
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) {
            this.onStartGeneration()
          }
        }
      })
    } finally {
      this.setData({ generating: false })
    }
  },

  /**
   * 显示确认对话框
   */
  showConfirmDialog() {
    const { selectionMode, selectedAssessments, durationMinutes } = this.data
    
    let content = `即将生成${durationMinutes}分钟的AI疗愈脑波，包含ISO三阶段结构。`
    
    if (selectionMode === 'multiple' && selectedAssessments.length > 1) {
      content += `\n\n本次将综合分析${selectedAssessments.length}个评测量表的结果，为您定制更全面的疗愈方案。`
    }
    
    content += '\n\n生成过程需要1-2分钟，请耐心等待。'
    
    return new Promise((resolve) => {
      wx.showModal({
        title: '开始生成',
        content,
        confirmText: '开始',
        cancelText: '取消',
        success: (res) => {
          resolve(res.confirm)
        }
      })
    })
  },

  /**
   * 模拟生成进度（实际应该通过轮询获取）
   */
  simulateProgress() {
    const phases = [
      '分析评测结果...',
      '规划ISO三阶段...',
      '生成同质阶段脑波...',
      '生成过渡阶段脑波...',
      '生成目标阶段脑波...',
      '处理音频过渡...',
      '合并音频文件...',
      '完成生成'
    ]

    let currentPhaseIndex = 0
    let progress = 0

    const updateProgress = () => {
      if (progress < 90 && currentPhaseIndex < phases.length - 1) {
        progress += Math.random() * 15
        if (progress > (currentPhaseIndex + 1) * 12) {
          currentPhaseIndex++
        }
        
        this.setData({
          generationProgress: Math.min(progress, 90),
          currentPhase: phases[currentPhaseIndex]
        })

        setTimeout(updateProgress, 1000 + Math.random() * 2000)
      }
    }

    updateProgress()
  },

  /**
   * 去做评测
   */
  onGoToAssessment() {
    wx.navigateTo({
      url: '/pages/assessment/scales/scales'
    })
  },

  /**
   * 去登录
   */
  onGoToLogin() {
    wx.navigateTo({
      url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/longSequence/create/create')
    })
  },

  /**
   * 查看长序列历史
   */
  onViewHistory() {
    wx.navigateTo({
      url: '/pages/longSequence/history/history'
    })
  },

  /**
   * 了解ISO原理
   */
  onLearnISO() {
    wx.showModal({
      title: 'ISO疗愈原理',
      content: 'ISO（Iso-Principle）是疗愈的核心原理：\n\n1. 同质阶段：脑波匹配当前情绪状态\n2. 过渡阶段：脑波逐渐引导情绪变化\n3. 目标阶段：脑波帮助达到理想状态\n\n通过这种渐进式的AI脑波引导，可以有效调节情绪，达到疗愈效果。',
      showCancel: false,
      confirmText: '了解了'
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
      
      if (diff < 60000) {
        return '刚刚'
      } else if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`
      } else if (diff < 86400000) {
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
   * 分享
   */
  onShareAppMessage() {
    return {
      title: 'AI疗愈 - 30分钟完整疗愈体验',
      path: '/pages/longSequence/create/create',
      imageUrl: '/images/share-longsequence.png'
    }
  }
})
