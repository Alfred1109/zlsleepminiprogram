// pages/assessment/history/history.js
// 评测历史页面
const app = getApp()
const { AssessmentAPI } = require('../../../utils/healingApi')
const AuthService = require('../../../services/AuthService')
const { sceneContextManager } = require('../../../utils/sceneContextManager')
const { sceneMappingService } = require('../../../utils/sceneMappingService')
const themeMixin = require('../../../utils/themeMixin')

Page({
  data: {
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null,
    
    // 场景信息（从跳转参数获取）
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
    
    // 筛选和排序
    currentFilter: 'all', // all, completed, pending
    currentSort: 'time', // time, score
    
    // 统计信息
    totalAssessments: 0,
    completedAssessments: 0,
    averageScore: 0
  },

  onLoad(options) {
    // 初始化主题
    this.initTheme()
    
    // 解析URL参数
    const { sceneId, sceneName, scaleType, sceneTheme } = options
    this.setData({
      sceneId: sceneId ? parseInt(sceneId) : null,
      sceneName: decodeURIComponent(sceneName || ''),
      scaleType: scaleType || '',
      sceneTheme: decodeURIComponent(sceneTheme || '')
    })
    
    // 设置导航栏标题
    const title = this.data.sceneName ? `${this.data.sceneName} - 评测历史` : '评测历史'
    wx.setNavigationBarTitle({
      title: title
    })
    
    // 检查登录状态并加载数据
    this.checkLoginAndLoadData()
  },

  onShow() {
    // 强制刷新主题状态
    this.forceRefreshTheme()
    
    // 重新检查登录状态
    this.checkLoginAndLoadData()
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
      
      if (isLoggedIn) {
        await this.loadAssessmentHistory()
        this.calculateStatistics()
      } else {
        this.setData({
          assessmentHistory: [],
          totalAssessments: 0,
          completedAssessments: 0,
          averageScore: 0
        })
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
    }
  },

  /**
   * 加载评测历史
   */
  async loadAssessmentHistory() {
    if (!this.data.userInfo) {
      return
    }
    
    this.setData({ loadingAssessments: true })
    
    try {
      const userId = this.data.userInfo.id || this.data.userInfo.user_id
      
      const result = await AssessmentAPI.getHistory(userId)
      
      if (result.success && result.data) {
        // 过滤掉无效的评测ID
        let validAssessments = result.data.filter(item => {
          const isValid = item && item.id && typeof item.id === 'number' && item.id > 0
          return isValid
        })

        // 如果有场景ID，过滤与当前场景相关的评测记录
        if (this.data.sceneId) {
          try {
            const validAssessmentsForScene = validAssessments.filter(item => {
              return item && item.scale_name && typeof item === 'object'
            })
            
            const sceneFilterPromises = validAssessmentsForScene.map(item => 
              sceneMappingService.isScaleMatchingScene(
                item, 
                this.data.sceneId, 
                this.data.sceneName
              )
            )
            
            const matchResults = await Promise.all(sceneFilterPromises)
            validAssessments = validAssessmentsForScene.filter((item, index) => matchResults[index])
            
          } catch (error) {
            console.error('场景评测历史过滤失败:', error)
            // 过滤失败时显示所有评测
          }
        }
        
        // 按时间倒序排列并格式化数据
        const formattedAssessments = validAssessments
          .sort((a, b) => {
            const dateA = new Date(a.completed_at || a.created_at || 0)
            const dateB = new Date(b.completed_at || b.created_at || 0)
            return dateB - dateA
          })
          .map(item => ({
            id: item.id || item.assessment_id,
            date: this.formatDate(item.completed_at || item.created_at),
            dateObj: new Date(item.completed_at || item.created_at),
            result: this.getAssessmentResultText(item.result || item.score),
            scaleName: item.scale_name || '心理评测',
            scaleType: item.scale_type,
            score: item.result || item.score,
            status: item.status || 'completed',
            description: item.description || '',
            rawData: item
          }))
        
        this.setData({
          assessmentHistory: formattedAssessments
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
   * 计算统计信息
   */
  calculateStatistics() {
    const assessments = this.data.assessmentHistory
    const totalAssessments = assessments.length
    const completedAssessments = assessments.filter(item => item.status === 'completed').length
    
    // 计算平均分数
    let averageScore = 0
    const scoredAssessments = assessments.filter(item => typeof item.score === 'number')
    if (scoredAssessments.length > 0) {
      const totalScore = scoredAssessments.reduce((sum, item) => sum + item.score, 0)
      averageScore = Math.round(totalScore / scoredAssessments.length)
    }
    
    this.setData({
      totalAssessments,
      completedAssessments,
      averageScore
    })
  },

  /**
   * 筛选评测历史
   */
  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ currentFilter: filter })
    this.applyFilterAndSort()
  },

  /**
   * 排序评测历史
   */
  onSortChange(e) {
    const sort = e.currentTarget.dataset.sort
    this.setData({ currentSort: sort })
    this.applyFilterAndSort()
  },

  /**
   * 应用筛选和排序
   */
  applyFilterAndSort() {
    let filteredAssessments = [...this.data.assessmentHistory]
    
    // 应用筛选
    if (this.data.currentFilter === 'completed') {
      filteredAssessments = filteredAssessments.filter(item => item.status === 'completed')
    } else if (this.data.currentFilter === 'pending') {
      filteredAssessments = filteredAssessments.filter(item => item.status !== 'completed')
    }
    
    // 应用排序
    if (this.data.currentSort === 'time') {
      filteredAssessments.sort((a, b) => b.dateObj - a.dateObj)
    } else if (this.data.currentSort === 'score') {
      filteredAssessments.sort((a, b) => (b.score || 0) - (a.score || 0))
    }
    
    this.setData({
      assessmentHistory: filteredAssessments
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
   * 返回场景详情页面
   */
  onBackToScene() {
    if (this.data.sceneId) {
      wx.navigateBack()
    } else {
      wx.switchTab({
        url: '/pages/assessment/scales/scales'
      })
    }
  },

  /**
   * 跳转到评测页面
   */
  navigateToAssessment() {
    if (!this.data.isLoggedIn) {
      this.promptLogin('进行专业评测需要先登录账户')
      return
    }
    
    // 如果有场景信息，设置场景上下文
    if (this.data.sceneId) {
      sceneContextManager.setSceneContext({
        sceneId: this.data.sceneId,
        sceneName: this.data.sceneName,
        scaleType: this.data.scaleType,
        sceneTheme: this.data.sceneTheme,
        source: '/pages/assessment/history/history'
      })
    }
    
    wx.switchTab({
      url: '/pages/assessment/scales/scales'
    })
  },

  /**
   * 登录提示
   */
  promptLogin(message) {
    wx.showModal({
      title: '需要登录',
      content: message || '查看评测历史需要先登录账户',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/login/login'
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
      const app = getApp()
      const currentTheme = app.globalData.currentTheme || 'default'
      const themeConfig = app.globalData.themeConfig
      
      this.setData({
        currentTheme: currentTheme,
        themeClass: themeConfig?.class || '',
        themeConfig: themeConfig
      })

      // 初始化事件总线
      wx.$emitter = wx.$emitter || {
        listeners: {},
        on(event, callback) {
          if (!this.listeners[event]) this.listeners[event] = [];
          this.listeners[event].push(callback);
        },
        off(event, callback) {
          if (this.listeners[event]) {
            const index = this.listeners[event].indexOf(callback);
            if (index > -1) {
              this.listeners[event].splice(index, 1);
            }
          }
        },
        emit(event, data) {
          if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
              try {
                callback(data);
              } catch (error) {
                console.error('主题监听器执行失败:', error);
              }
            });
          }
        }
      };

      // 注册全局主题变化监听器
      this.themeChangeHandler = (data) => {
        if (data && data.theme && data.config) {
          this.setData({
            currentTheme: data.theme,
            themeClass: data.config?.class || '',
            themeConfig: data.config
          })
        }
      }

      wx.$emitter.on('themeChanged', this.themeChangeHandler)

    } catch (error) {
      console.error('初始化主题失败:', error);
    }
  },

  /**
   * 强制刷新主题状态
   */
  forceRefreshTheme() {
    try {
      const app = getApp()
      
      const savedTheme = wx.getStorageSync('user_preferred_theme') || 'default'
      const currentTheme = app.globalData.currentTheme || savedTheme
      const themeConfig = app.globalData.themeConfig
      
      if (app.globalData.currentTheme !== savedTheme) {
        app.globalData.currentTheme = savedTheme
      }
      
      this.setData({
        currentTheme: currentTheme,
        themeClass: themeConfig?.class || (currentTheme === 'default' ? '' : currentTheme),
        themeConfig: themeConfig || { class: (currentTheme === 'default' ? '' : currentTheme) }
      })
      
    } catch (error) {
      console.error('强制主题刷新失败:', error)
      this.setData({
        currentTheme: 'default',
        themeClass: '',
        themeConfig: { class: '' }
      })
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
      console.error('主题切换处理失败:', error);
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
          year: 'numeric',
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
      title: 'AI疗愈 - 评测历史',
      path: '/pages/assessment/history/history',
      imageUrl: '/images/share-assessment.png'
    }
  },

  /**
   * 页面卸载时清理资源
   */
  onUnload() {
    if (wx.$emitter && typeof wx.$emitter.off === 'function' && this.themeChangeHandler) {
      try {
        wx.$emitter.off('themeChanged', this.themeChangeHandler);
      } catch (error) {
        console.error('清理主题监听器失败:', error);
      }
    }
  }
})
