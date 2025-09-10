// pages/longSequence/create/create.js
// 长序列脑波创建页面
const app = getApp()
const { AssessmentAPI, LongSequenceAPI } = require('../../../utils/healingApi')

Page({
  data: {
    userInfo: null,
    recentAssessments: [],
    selectedAssessment: null,
    preselectedAssessmentId: null, // 新增：预选的评测ID
    durationMinutes: 30,
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
    loading: false
  },

  onLoad(options) {
    console.log('长序列创建页面加载', options)
    
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
        const completedAssessments = result.data || []

        this.setData({
          recentAssessments: completedAssessments.slice(0, 5)
        })

        // 如果有预选的评测ID，优先选择它；否则选择最新的评测
        if (this.data.preselectedAssessmentId) {
          const preselectedAssessment = completedAssessments.find(
            assessment => assessment.id === this.data.preselectedAssessmentId
          )
          if (preselectedAssessment) {
            console.log('找到并预选评测记录:', preselectedAssessment)
            this.setData({
              selectedAssessment: preselectedAssessment
            })
          } else {
            console.warn('未找到预选的评测记录，使用最新的')
            if (completedAssessments.length > 0) {
              this.setData({
                selectedAssessment: completedAssessments[0]
              })
            }
          }
        } else if (completedAssessments.length > 0) {
          // 默认选择最新的评测
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

    if (!this.data.selectedAssessment) {
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
      // 开始生成
      const result = await LongSequenceAPI.createLongSequence(
        this.data.selectedAssessment.id,
        this.data.durationMinutes
      )
      
      if (result.success) {
        this.setData({ 
          sessionResult: result.data,
          generationProgress: 100,
          currentPhase: '生成完成'
        })
        
        wx.showToast({
          title: '生成成功',
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
    return new Promise((resolve) => {
      wx.showModal({
        title: '开始生成',
        content: `即将生成${this.data.durationMinutes}分钟的AI疗愈脑波，包含ISO三阶段结构。生成过程需要1-2分钟，请耐心等待。`,
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
