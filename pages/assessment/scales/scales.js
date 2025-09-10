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

  async onLoad() {
    console.log('📱 评测量表页面加载')

    // 调试：检查存储中的所有认证相关信息
    console.log('🔍 调试信息:')
    console.log('- access_token:', wx.getStorageSync('access_token'))
    console.log('- refresh_token:', wx.getStorageSync('refresh_token'))  
    console.log('- user_info:', wx.getStorageSync('user_info'))
    console.log('- AuthService.getCurrentUser():', AuthService.getCurrentUser())

    // 修改：允许未登录用户查看评测页面，但不强制登录
    const currentUser = AuthService.getCurrentUser()
    if (currentUser) {
      console.log('✅ 检测到用户信息，加载完整页面数据')
      this.setData({ userInfo: currentUser })
      this.loadRecentAssessments()
    } else {
      console.log('ℹ️ 用户未登录，仅显示评测量表列表')
      this.setData({ userInfo: null })
    }

    // 加载评测量表（无论是否登录都可以查看）
    this.loadScales()
  },

  onShow() {
    // 每次显示时检查登录状态并刷新数据
    const currentUser = AuthService.getCurrentUser()
    if (currentUser) {
      this.setData({ userInfo: currentUser })
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
      const userInfo = AuthService.getCurrentUser()
      console.log('🔍 获取到的用户信息:', userInfo)
      
      if (userInfo) {
        this.setData({ userInfo })
        console.log('✅ 用户信息已设置到页面data中')
        return userInfo
      } else {
        console.log('❌ 未获取到用户信息，跳转登录页')
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
        return null
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
      return null
    }
  },

  /**
   * 加载评测量表列表
   */
  async loadScales() {
    console.log('🔄 开始加载评测量表...')
    this.setData({ loading: true })

    try {
      console.log('📡 调用 AssessmentAPI.getScales()...')
      const result = await AssessmentAPI.getScales()
      console.log('📨 API 响应结果:', result)
      
      if (result.success) {
        console.log('✅ 量表数据获取成功，数量:', result.data?.length || 0)
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
        console.log('✅ 量表数据已设置到页面数据中')
      } else {
        console.error('❌ API 返回失败:', result.error)
        wx.showToast({
          title: result.error || '加载失败',
          icon: 'error'
        })
      }
    } catch (error) {
      console.error('💥 加载量表异常:', error)
      wx.showToast({
        title: '网络错误',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
      console.log('🏁 量表加载流程结束')
    }
  },

  /**
   * 加载最近的评测记录
   */
  async loadRecentAssessments() {
    console.log('🔍 开始加载评测历史...')
    console.log('当前userInfo:', this.data.userInfo)
    
    // 如果页面的userInfo为空，尝试从AuthService重新获取
    if (!this.data.userInfo) {
      console.log('❌ 页面userInfo为空，尝试从AuthService重新获取...')
      
      const userInfo = AuthService.getCurrentUser()
      if (userInfo) {
        console.log('✅ 从AuthService重新获取到用户信息:', userInfo)
        this.setData({ userInfo })
      } else {
        console.log('❌ AuthService中也没有用户信息，需要重新登录')
        wx.showModal({
          title: '需要重新登录',
          content: '用户信息已过期，请重新登录',
          confirmText: '去登录',
          showCancel: false,
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({
                url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/assessment/scales/scales')
              })
            }
          }
        })
        return
      }
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
    
    // 检查登录状态，未登录时引导用户登录
    if (!this.data.userInfo) {
      wx.showModal({
        title: '需要登录',
        content: '进行专业评测需要先登录账户，立即前往登录页面？',
        showCancel: true,
        cancelText: '取消',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ 
              url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/assessment/scales/scales')
            })
          }
        }
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
