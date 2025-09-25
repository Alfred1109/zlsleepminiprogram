// pages/assessment/scales/scales.js
// 评测量表选择页面
const app = getApp()
const { AssessmentAPI, UserAPI } = require('../../../utils/healingApi')
const AuthService = require('../../../services/AuthService')
const { sceneContextManager } = require('../../../utils/sceneContextManager')
const { sceneMappingService } = require('../../../utils/sceneMappingService')

Page({
  data: {
    scales: [],
    filteredScales: [], // 过滤后的量表
    loading: false,
    userInfo: null,
    recentAssessments: [],
    
    // 场景上下文相关
    sceneContext: null,
    isInSceneMode: false,
    sceneHint: '',    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null,
    
  },

  async onLoad() {
    console.log('📱 评测量表页面加载')

    // 检查场景上下文
    this.checkSceneContext()

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
      // 初始化主题
      this.initTheme()
      this.loadRecentAssessments()
    } else {
      console.log('ℹ️ 用户未登录，仅显示评测量表列表')
      this.setData({ userInfo: null })
    }

    // 加载评测量表（无论是否登录都可以查看）
    this.loadScales()
  },

  onShow() {
    // 🔧 强制刷新主题状态，解决跨页面同步问题  
    this.forceRefreshTheme()
    
    // 检查场景上下文变化
    this.checkSceneContext()
    
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
   * 检查场景上下文
   */
  checkSceneContext() {
    const context = sceneContextManager.getCurrentContext()
    const isInSceneMode = sceneContextManager.isInSceneMode()
    const sceneHint = sceneContextManager.getSceneNavigationHint()
    
    console.log('🎯 检查场景上下文:', { context, isInSceneMode, sceneHint })
    
    this.setData({
      sceneContext: context,
      isInSceneMode,
      sceneHint
    })
    
    // 如果量表已加载，重新过滤
    if (this.data.scales.length > 0) {
      this.filterScalesByScene()
    }
  },

  /**
   * 根据场景过滤量表（使用动态映射服务）
   */
  async filterScalesByScene() {
    const { scales, sceneContext, isInSceneMode } = this.data
    
    console.log('🔍 开始场景量表过滤，当前状态:', {
      isInSceneMode,
      sceneContext,
      scales数量: scales.length,
      scales列表: scales.map(s => ({ name: s.scale_name, type: s.scale_type }))
    })
    
    if (!isInSceneMode || !sceneContext) {
      // 没有场景限制，显示所有量表
      this.setData({ filteredScales: scales })
      console.log('📋 没有场景模式，显示所有量表，共', scales.length, '个')
      return
    }
    
    try {
      // 🔧 修复：添加数据验证，确保所有量表对象都有必要的字段
        const validScales = scales.filter(scale => {
        const hasRequiredFields = scale && 
          scale.scale_name &&
          typeof scale === 'object'
        
        if (!hasRequiredFields) {
          console.warn('⚠️ 发现缺少必要字段的量表记录，已跳过场景匹配:', scale)
        }
        
        return hasRequiredFields
      })
      
      // 使用映射服务过滤量表
      const filteredPromises = validScales.map(scale => 
        sceneMappingService.isScaleMatchingScene(
          scale, 
          sceneContext.sceneId, 
          sceneContext.sceneName
        )
      )
      
      const matchResults = await Promise.all(filteredPromises)
      const filtered = validScales.filter((scale, index) => matchResults[index])
      
      this.setData({ filteredScales: filtered })
      
      console.log(`🎯 场景「${sceneContext.sceneName}」(ID:${sceneContext.sceneId})过滤结果详情:`, {
        原始量表数量: scales.length,
        验证后数量: validScales.length,
        过滤后数量: filtered.length,
        原始量表列表: scales.map(s => ({ name: s.scale_name, type: s.scale_type })),
        过滤后量表列表: filtered.map(s => ({ name: s.scale_name, type: s.scale_type })),
        被过滤掉的量表: validScales.filter(s => !filtered.includes(s)).map(s => ({ name: s.scale_name, type: s.scale_type })),
        映射服务调试: sceneMappingService.getDebugInfo(),
        匹配结果详情: matchResults.map((match, index) => ({
          量表: validScales[index]?.scale_name,
          是否匹配: match
        }))
      })
      
    } catch (error) {
      console.error('❌ 场景量表过滤失败:', error)
      // 🔧 修复：显示错误提示但保持场景模式，让用户决定是否退出
      wx.showModal({
        title: '场景映射失败',
        content: `获取${sceneContext.sceneName}的量表映射失败，是否退出场景模式查看所有量表？`,
        confirmText: '退出场景模式',
        cancelText: '重试',
        success: (res) => {
          if (res.confirm) {
            // 用户选择退出场景模式
            sceneContextManager.clearSceneContext()
            this.setData({ 
              filteredScales: scales,
              isInSceneMode: false,
              sceneContext: null
            })
          } else {
            // 用户选择重试，重新过滤
            this.filterScalesByScene()
          }
        }
      })
    }
  },

  /**
   * 退出场景模式
   */
  exitSceneMode() {
    wx.showModal({
      title: '退出场景模式',
      content: '是否退出当前场景模式，查看所有评测量表？',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          sceneContextManager.clearSceneContext()
          this.checkSceneContext()
          wx.showToast({
            title: '已退出场景模式',
            icon: 'success'
          })
        }
      }
    })
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
        
        // 根据场景上下文过滤量表
        this.filterScalesByScene()
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
        
        // 🔧 修复：过滤掉无效的评测ID（防止传递不存在的评测ID到后端）
        const validAssessments = (result.data || []).filter(item => {
          const isValid = item && item.id && typeof item.id === 'number' && item.id > 0
          if (!isValid) {
            console.warn('⚠️ 发现无效评测记录，已过滤:', item)
          }
          return isValid
        })

        console.log(`🔍 评测ID有效性验证完成，有效记录数: ${validAssessments.length}`)
        
        this.setData({
          recentAssessments: validAssessments.slice(0, 3) // 只显示最近3条
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
    
    // 🔧 修复：使用统一的字段名称
    const scaleName = scale.scale_name || '心理评测'
    
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
      content: `即将开始"${scaleName}"评测，预计需要${scale.estimatedTime}。请在安静的环境中认真作答。`,
      confirmText: '开始',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: `/pages/assessment/questions/questions?scaleId=${scale.scale_id}&scaleName=${encodeURIComponent(scaleName)}`
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
  },

  /**
   * 初始化主题
   */
  initTheme() {
    try {
      // 从全局数据获取当前主题
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
          console.log('🎨 评测页面主题已更新:', data.theme)
        }
      }

      wx.$emitter.on('themeChanged', this.themeChangeHandler)
      console.log('✅ 评测页面主题监听器已注册')

    } catch (error) {
      console.error('初始化主题失败:', error);
    }
  },

  /**
   * 🔧 强制刷新主题状态（用于解决跨页面同步问题）
   */
  forceRefreshTheme() {
    try {
      const app = getApp()
      
      // 强制从Storage读取用户偏好（防止内存状态过期）
      const savedTheme = wx.getStorageSync('user_preferred_theme') || 'default'
      const currentTheme = app.globalData.currentTheme || savedTheme
      const themeConfig = app.globalData.themeConfig
      
      // 如果发现不一致，以Storage为准并更新全局状态
      if (app.globalData.currentTheme !== savedTheme) {
        console.log('🔄 评测页面检测到主题不同步，强制更新:', savedTheme)
        app.globalData.currentTheme = savedTheme
      }
      
      this.setData({
        currentTheme: currentTheme,
        themeClass: themeConfig?.class || (currentTheme === 'default' ? '' : currentTheme),
        themeConfig: themeConfig || { class: (currentTheme === 'default' ? '' : currentTheme) }
      })
      
      console.log('🎨 评测页面主题强制同步完成:', currentTheme)
    } catch (error) {
      console.error('评测页面强制主题刷新失败:', error)
      // 兜底：使用默认主题
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
      if (!e || !e.detail) return;
      const { theme, config } = e.detail;
      if (!theme || !config) return;
      
      this.setData({
        currentTheme: theme,
        themeClass: config.class || '',
        themeConfig: config
      });

      const app = getApp();
      if (app.globalData) {
        app.globalData.currentTheme = theme;
        app.globalData.themeConfig = config;
      }

      if (wx.$emitter) {
        wx.$emitter.emit('themeChanged', { theme, config });
      }

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
   * 页面卸载时清理资源
   */
  onUnload() {
    // 清理主题监听器 - 增加安全检查
    if (wx.$emitter && typeof wx.$emitter.off === 'function' && this.themeChangeHandler) {
      try {
        wx.$emitter.off('themeChanged', this.themeChangeHandler);
        console.log('🧹 评测页面主题监听器已清理');
      } catch (error) {
        console.error('清理主题监听器失败:', error);
      }
    }
  },
})
