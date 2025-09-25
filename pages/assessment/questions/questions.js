// pages/assessment/questions/questions.js
// 评测答题页面
const app = getApp()
const { AssessmentAPI } = require('../../../utils/healingApi')

Page({
  data: {
    scaleId: null,
    scaleName: '',
    assessmentId: null,
    questions: [],
    currentQuestionIndex: 0,
    answers: {},
    loading: false,
    submitting: false,
    progress: 0,
    hasCurrentAnswer: false,
    
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null
  },

  onLoad(options) {
    console.log('评测答题页面加载', options)
    
    const { scaleId, scaleName } = options
    this.setData({
      scaleId: parseInt(scaleId),
      scaleName: decodeURIComponent(scaleName || '')
    })

    // 初始化主题
    this.initTheme()
    this.loadQuestions()
  },

  onShow() {
    // 🔧 强制刷新主题状态，解决跨页面同步问题
    this.forceRefreshTheme()
  },

  /**
   * 加载题目
   */
  async loadQuestions() {
    this.setData({ loading: true })

    try {
      // 获取题目
      const questionsResult = await AssessmentAPI.getQuestions(this.data.scaleId)
      
      if (!questionsResult.success) {
        throw new Error(questionsResult.error || '获取题目失败')
      }

      // 开始评测
      const AuthService = require('../../../services/AuthService')
      const userInfo = AuthService.getCurrentUser()
      if (!userInfo) {
        throw new Error('用户未登录')
      }

      const assessmentResult = await AssessmentAPI.startAssessment(
        this.data.scaleId, 
        userInfo.id
      )

      if (!assessmentResult.success) {
        throw new Error(assessmentResult.error || '开始评测失败')
      }

      this.setData({
        questions: questionsResult.data.questions,
        assessmentId: assessmentResult.data.assessment_id,
        progress: 0,
        hasCurrentAnswer: false
      })

      console.log('题目加载成功，评测ID:', assessmentResult.data.assessment_id)

    } catch (error) {
      console.error('加载题目失败:', error)
      wx.showModal({
        title: '加载失败',
        content: error.message || '无法加载题目，请重试',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 选择答案
   */
  onSelectAnswer(e) {
    const { value } = e.currentTarget.dataset
    const currentQuestion = this.data.questions[this.data.currentQuestionIndex]

    const answers = { ...this.data.answers }
    answers[currentQuestion.id] = value

    this.setData({
      answers,
      hasCurrentAnswer: true
    })

    console.log('选择答案:', currentQuestion.id, value)
  },

  /**
   * 上一题
   */
  onPreviousQuestion() {
    if (this.data.currentQuestionIndex > 0) {
      const newIndex = this.data.currentQuestionIndex - 1
      const newQuestion = this.data.questions[newIndex]
      const hasAnswer = this.data.answers[newQuestion.id] !== undefined

      this.setData({
        currentQuestionIndex: newIndex,
        hasCurrentAnswer: hasAnswer
      })
      this.updateProgress()
    }
  },

  /**
   * 下一题
   */
  onNextQuestion() {
    const currentQuestion = this.data.questions[this.data.currentQuestionIndex]
    const hasAnswer = this.data.answers[currentQuestion.id] !== undefined

    if (!hasAnswer) {
      wx.showToast({
        title: '请选择答案',
        icon: 'error'
      })
      return
    }

    if (this.data.currentQuestionIndex < this.data.questions.length - 1) {
      const newIndex = this.data.currentQuestionIndex + 1
      const newQuestion = this.data.questions[newIndex]
      const hasNextAnswer = this.data.answers[newQuestion.id] !== undefined

      this.setData({
        currentQuestionIndex: newIndex,
        hasCurrentAnswer: hasNextAnswer
      })
      this.updateProgress()
    } else {
      // 最后一题，提交评测
      this.submitAssessment()
    }
  },

  /**
   * 更新进度
   */
  updateProgress() {
    const progress = ((this.data.currentQuestionIndex + 1) / this.data.questions.length) * 100
    this.setData({ progress })
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
          console.log('🎨 评测答题页面主题已更新:', data.theme)
        }
      }

      wx.$emitter.on('themeChanged', this.themeChangeHandler)
      console.log('✅ 评测答题页面主题监听器已注册')

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
        console.log('🔄 评测答题页面检测到主题不同步，强制更新:', savedTheme)
        app.globalData.currentTheme = savedTheme
      }
      
      this.setData({
        currentTheme: currentTheme,
        themeClass: themeConfig?.class || (currentTheme === 'default' ? '' : currentTheme),
        themeConfig: themeConfig || { class: (currentTheme === 'default' ? '' : currentTheme) }
      })
      
      console.log('🎨 评测答题页面主题强制同步完成:', currentTheme)
    } catch (error) {
      console.error('评测答题页面强制主题刷新失败:', error)
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
    } catch (error) {
      console.error('主题切换处理失败:', error);
    }
  },

  /**
   * 提交评测
   */
  async submitAssessment() {
    this.setData({ submitting: true })

    try {
      // 提交所有答案
      for (const questionId in this.data.answers) {
        await AssessmentAPI.submitAnswer(
          this.data.assessmentId,
          parseInt(questionId),
          this.data.answers[questionId]
        )
      }

      // 完成评测
      const result = await AssessmentAPI.completeAssessment(this.data.assessmentId)

      if (result.success) {
        wx.showToast({
          title: '评测完成',
          icon: 'success'
        })

        // 跳转到结果页面
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/assessment/result/result?assessmentId=${this.data.assessmentId}`
          })
        }, 1500)
      } else {
        throw new Error(result.error || '提交失败')
      }

    } catch (error) {
      console.error('提交评测失败:', error)
      wx.showModal({
        title: '提交失败',
        content: error.message || '提交评测失败，请重试',
        showCancel: true,
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) {
            this.submitAssessment()
          }
        }
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  /**
   * 退出评测确认
   */
  onExitConfirm() {
    wx.showModal({
      title: '退出评测',
      content: '确定要退出当前评测吗？已填写的内容将丢失。',
      confirmText: '退出',
      cancelText: '继续',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  },

  /**
   * 获取当前题目
   */
  getCurrentQuestion() {
    return this.data.questions[this.data.currentQuestionIndex]
  },

  /**
   * 获取选中的答案值
   */
  getSelectedAnswer() {
    const currentQuestion = this.getCurrentQuestion()
    return currentQuestion ? this.data.answers[currentQuestion.id] : undefined
  },

  /**
   * 页面卸载时的处理
   */
  onUnload() {
    // 清理主题监听器 - 增加安全检查
    if (wx.$emitter && typeof wx.$emitter.off === 'function' && this.themeChangeHandler) {
      try {
        wx.$emitter.off('themeChanged', this.themeChangeHandler);
        console.log('🧹 评测答题页面主题监听器已清理');
      } catch (error) {
        console.error('清理主题监听器失败:', error);
      }
    }
    
    // 如果评测未完成，可以在这里保存进度到本地
    if (this.data.assessmentId && !this.data.submitting) {
      console.log('评测页面卸载，评测ID:', this.data.assessmentId)
    }
  }
})
