// pages/assessment/scales/scales.js
// 评测量表选择页面
const app = getApp()
const { AssessmentAPI, UserAPI } = require('../../../utils/healingApi')
const AuthService = require('../../../services/AuthService')

Page({
  data: {
    scales: [],
    loading: false,
    userInfo: null,
    recentAssessments: []
  },

  onLoad() {
    console.log('评测量表页面加载')

    // 检查页面访问权限
    const currentPages = getCurrentPages()
    const currentPage = currentPages[currentPages.length - 1]
    const pagePath = '/' + currentPage.route

    if (!AuthService.getCurrentUser()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return // 如果没有权限，跳转到登录页
    }

    this.checkUserLogin()
    this.loadScales()
    this.loadRecentAssessments()
  },

  onShow() {
    // 每次显示时刷新最近评测
    this.loadRecentAssessments()
  },

  /**
   * 检查用户登录状态
   */
  async checkUserLogin() {
    try {
      const userInfo = AuthService.getCurrentUser()
      if (userInfo) {
        this.setData({ userInfo })
      } else {
        // 未登录，跳转到登录页
        wx.showModal({
          title: '需要登录',
          content: '请先登录后再进行评测',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({
                url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/assessment/scales/scales')
              })
            } else {
              wx.switchTab({
                url: '/pages/index/index'
              })
            }
          }
        })
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
    }
  },

  /**
   * 加载评测量表列表
   */
  async loadScales() {
    this.setData({ loading: true })

    try {
      const result = await AssessmentAPI.getScales()
      
      if (result.success) {
        // 为每个量表添加描述和图标
        const scalesWithInfo = result.data.map(scale => ({
          ...scale,
          icon: this.getScaleIcon(scale.scale_type),
          description: this.getScaleDescription(scale.scale_type),
          estimatedTime: this.getEstimatedTime(scale.scale_type)
        }))

        this.setData({
          scales: scalesWithInfo
        })
      } else {
        wx.showToast({
          title: result.error || '加载失败',
          icon: 'error'
        })
      }
    } catch (error) {
      console.error('加载量表失败:', error)
      wx.showToast({
        title: '网络错误',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 加载最近的评测记录
   */
  async loadRecentAssessments() {
    console.log('🔍 开始加载评测历史...')
    console.log('当前userInfo:', this.data.userInfo)
    
    if (!this.data.userInfo) {
      console.log('❌ userInfo为空，无法加载评测历史')
      
      wx.showModal({
        title: '用户信息丢失',
        content: '检测到用户信息丢失，是否重新登录？',
        confirmText: '重新登录',
        cancelText: '手动修复',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            })
          } else {
            // 调试模式：强制设置用户信息
            this.debugSetUserInfo()
          }
        }
      })
      return
    }

    try {
      console.log(`📡 调用API获取用户${this.data.userInfo.id}的评测历史`)
      const result = await AssessmentAPI.getHistory(this.data.userInfo.id)
      console.log('API响应:', result)
      
      if (result.success) {
        console.log(`✅ 成功获取${result.data.length}条评测历史`)
        this.setData({
          recentAssessments: result.data.slice(0, 3) // 只显示最近3条
        })
      } else {
        console.log('❌ API返回失败:', result.error)
        wx.showToast({
          title: '获取历史失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('❌ 加载评测历史异常:', error)
      wx.showToast({
        title: '网络请求失败',
        icon: 'none'
      })
    }
  },

  /**
   * 调试：强制设置用户信息
   */
  debugSetUserInfo() {
    console.log('🔧 调试：强制设置用户信息')
    const debugUserInfo = {
      id: 1,
      username: 'test_user',
      nickname: '测试用户',
      token: 'debug_token_' + Date.now()
    }
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', debugUserInfo)
    wx.setStorageSync('token', debugUserInfo.token)
    
    // 更新页面数据
    this.setData({ userInfo: debugUserInfo })
    
    // 重新加载评测历史
    this.loadRecentAssessments()
    
    wx.showToast({
      title: '用户信息已修复',
      icon: 'success'
    })
  },

  /**
   * 获取量表图标
   */
  getScaleIcon(scaleType) {
    const iconMap = {
      'HAMD-17': '😔',
      'GAD-7': '😰',
      'PSQI': '😴'
    }
    return iconMap[scaleType] || '📋'
  },

  /**
   * 获取量表描述
   */
  getScaleDescription(scaleType) {
    const descMap = {
      'HAMD-17': '评估抑郁症状的严重程度，帮助了解情绪状态',
      'GAD-7': '评估焦虑症状，识别焦虑水平和影响程度',
      'PSQI': '评估睡眠质量，了解睡眠模式和问题'
    }
    return descMap[scaleType] || '专业心理评测量表'
  },

  /**
   * 获取预估时间
   */
  getEstimatedTime(scaleType) {
    const timeMap = {
      'HAMD-17': '5-8分钟',
      'GAD-7': '3-5分钟',
      'PSQI': '5-10分钟'
    }
    return timeMap[scaleType] || '5分钟'
  },

  /**
   * 开始评测
   */
  onStartAssessment(e) {
    const { scale } = e.currentTarget.dataset
    
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'error'
      })
      return
    }

    // 显示确认对话框
    wx.showModal({
      title: '开始评测',
      content: `即将开始"${scale.name}"评测，预计需要${scale.estimatedTime}。请在安静的环境中认真作答。`,
      confirmText: '开始',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: `/pages/assessment/questions/questions?scaleId=${scale.id}&scaleName=${encodeURIComponent(scale.name)}`
          })
        }
      }
    })
  },

  /**
   * 查看评测结果
   */
  onViewResult(e) {
    const { assessment } = e.currentTarget.dataset
    
    wx.navigateTo({
      url: `/pages/assessment/result/result?assessmentId=${assessment.id}`
    })
  },

  /**
   * 查看评测历史
   */
  onViewHistory() {
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'error'
      })
      return
    }

    wx.navigateTo({
      url: '/pages/assessment/history/history'
    })
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    Promise.all([
      this.loadScales(),
      this.loadRecentAssessments()
    ]).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: 'AI疗愈 - 专业心理评测',
      path: '/pages/assessment/scales/scales',
      imageUrl: '/images/share-assessment.png'
    }
  }
})
