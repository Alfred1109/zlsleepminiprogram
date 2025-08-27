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
    hasCurrentAnswer: false
  },

  onLoad(options) {
    console.log('评测答题页面加载', options)
    
    const { scaleId, scaleName } = options
    this.setData({
      scaleId: parseInt(scaleId),
      scaleName: decodeURIComponent(scaleName || '')
    })

    this.loadQuestions()
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
    // 如果评测未完成，可以在这里保存进度到本地
    if (this.data.assessmentId && !this.data.submitting) {
      console.log('评测页面卸载，评测ID:', this.data.assessmentId)
    }
  }
})
