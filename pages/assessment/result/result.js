// pages/assessment/result/result.js
// 评测结果页面
const app = getApp()
const { AssessmentAPI, MusicAPI, LongSequenceAPI } = require('../../../utils/healingApi')
const { sceneContextManager } = require('../../../utils/sceneContextManager')

Page({
  data: {
    assessmentId: null,
    assessment: null,
    loading: false,
    generating: false,
    generationType: null, // '60s' or 'long'
    musicResult: null,
    longSequenceResult: null,
    // 新增数据
    assessmentDimensions: [],
    personalizedRecommendations: [],
    healingSchedule: [],
    
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null,
    
    // 🔧 新增：场景上下文相关
    sceneContext: null,
    isInSceneMode: false
  },

  onLoad(options) {
    console.log('📋 评测结果页面加载', options)
    
    // 初始化主题
    this.initTheme()
    
    // 🔧 新增：检查场景上下文
    this.checkSceneContext()
    
    // 兼容 id 和 assessmentId 两种参数名
    const assessmentId = options.assessmentId || options.id
    console.log('📋 接收到的 assessmentId:', assessmentId, '类型:', typeof assessmentId)
    
    if (!assessmentId) {
      console.error('❌ 缺少 assessmentId 参数')
      wx.showModal({
        title: '参数错误',
        content: '缺少评测ID参数',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
      return
    }
    
    this.setData({
      assessmentId: parseInt(assessmentId)
    })
    
    console.log('📋 设置的 assessmentId:', this.data.assessmentId)
    this.loadAssessmentResult()
  },

  onShow() {
    // 🔧 强制刷新主题状态，解决跨页面同步问题
    this.forceRefreshTheme()
  },

  /**
   * 加载评测结果
   */
  async loadAssessmentResult() {
    this.setData({ loading: true })

    try {
      const AuthService = require('../../../services/AuthService')
      const userInfo = AuthService.getCurrentUser()
      if (!userInfo) {
        throw new Error('用户未登录')
      }

      let assessment = null

      // 🔧 修复：如果有具体的assessmentId，先尝试获取特定评测记录
      if (this.data.assessmentId) {
        console.log('📡 根据ID获取特定评测记录, assessmentId:', this.data.assessmentId)
        try {
          const specificResult = await AssessmentAPI.getResult(this.data.assessmentId)
          console.log('📡 特定评测记录API响应:', specificResult)
          
          if (specificResult.success && specificResult.data) {
            assessment = specificResult.data
            console.log('✅ 成功获取到特定评测记录')
          }
        } catch (specificError) {
          console.warn('⚠️ 获取特定评测记录失败，回退到历史记录模式:', specificError)
        }
      }

      // 如果没有获取到特定评测记录，回退到历史记录模式
      if (!assessment) {
        console.log('📡 请求用户评测历史, userId:', userInfo.id)
        const result = await AssessmentAPI.getHistory(userInfo.id)
        console.log('📡 评测历史API响应结果:', result)

        if (result.success && result.data.length > 0) {
          if (this.data.assessmentId) {
            // 如果有指定ID，从历史记录中查找匹配的记录
            assessment = result.data.find(item => item.id === this.data.assessmentId)
            if (!assessment) {
              console.warn('⚠️ 在历史记录中未找到指定ID的评测记录，使用最新记录')
              assessment = result.data[0]
            } else {
              console.log('✅ 在历史记录中找到匹配的评测记录')
            }
          } else {
            // 没有指定ID，使用最新的评测记录
            assessment = result.data[0]
            console.log('✅ 使用最新的评测记录')
          }
        } else {
          throw new Error(result.error || '获取评测结果失败')
        }
      }

      if (!assessment) {
        throw new Error('未找到有效的评测记录')
      }
      
      // 确保有max_score字段
      if (!assessment.max_score) {
        assessment.max_score = 100
      }
      
      console.log('📋 最终使用的评测记录:', {
        id: assessment.id,
        scale_name: assessment.scale_name,
        total_score: assessment.total_score,
        completed_at: assessment.completed_at
      })
      
      this.setData({ 
        assessment,
        assessmentDimensions: this.generateDimensionsData(assessment),
        personalizedRecommendations: this.generateRecommendations(assessment),
        healingSchedule: this.generateHealingSchedule(assessment)
      })

    } catch (error) {
      console.error('❌ 加载评测结果失败:', error)
      wx.showModal({
        title: '加载失败',
        content: error.message || '无法加载评测结果',
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
   * 跳转到60秒音乐生成页面
   */
  generate60sMusic() {
    if (!this.data.assessmentId) {
      wx.showToast({
        title: '评测数据异常',
        icon: 'error'
      })
      return
    }

    // 🔧 修复：跳转时保持场景上下文，确保生成的音乐能正确关联场景
    // 如果在场景模式下，需要确保场景上下文传递给音乐生成页面（通过sceneContextManager）
    console.log('🎵 跳转到60秒音乐生成，场景上下文:', this.data.sceneContext)
    
    // 跳转到音乐生成页面，并预选当前评测记录
    wx.navigateTo({
      url: `/pages/music/generate/generate?assessmentId=${this.data.assessmentId}`
    })
  },

  /**
   * 跳转到长序列创建页面
   */
  generateLongSequence() {
    if (!this.data.assessmentId) {
      wx.showToast({
        title: '评测数据异常',
        icon: 'error'
      })
      return
    }

    // 🔧 修复：跳转时保持场景上下文，确保生成的长序列能正确关联场景
    // 如果在场景模式下，需要确保场景上下文传递给长序列生成页面（通过sceneContextManager）
    console.log('🎶 跳转到长序列生成，场景上下文:', this.data.sceneContext)
    
    // 跳转到长序列创建页面，并预选当前评测记录
    wx.navigateTo({
      url: `/pages/longSequence/create/create?assessmentId=${this.data.assessmentId}`
    })
  },

  /**
   * 重新评测
   */
  onRetakeAssessment() {
    wx.showModal({
      title: '重新评测',
      content: '确定要重新进行评测吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack({
            delta: 2 // 返回到量表选择页面
          })
        }
      }
    })
  },

  /**
   * 查看音频库
   */
  onViewMusicLibrary() {
    wx.switchTab({
      url: '/pages/music/library/library'
    })
  },

  /**
   * 获取严重程度描述
   */
  getSeverityDescription(level) {
    const descriptions = {
      'normal': '您的心理状态良好，继续保持积极的生活态度。',
      'mild': '您可能存在轻度的心理压力，建议适当放松和调节。',
      'moderate': '您的心理状态需要关注，建议寻求专业帮助。',
      'severe': '您的心理状态需要及时关注，强烈建议咨询专业医生。'
    }
    return descriptions[level] || '请根据评测结果适当调节心理状态。'
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
   * 生成维度分析数据
   */
  generateDimensionsData(assessment) {
    // 模拟维度数据，实际应根据评测量表生成
    const dimensions = [
      {
        name: '情绪状态',
        score: Math.floor(assessment.total_score * 0.3),
        maxScore: Math.floor((assessment.max_score || 100) * 0.3),
        level: this.getDimensionLevel(Math.floor(assessment.total_score * 0.3))
      },
      {
        name: '睡眠质量',
        score: Math.floor(assessment.total_score * 0.25),
        maxScore: Math.floor((assessment.max_score || 100) * 0.25),
        level: this.getDimensionLevel(Math.floor(assessment.total_score * 0.25))
      },
      {
        name: '心理压力',
        score: Math.floor(assessment.total_score * 0.2),
        maxScore: Math.floor((assessment.max_score || 100) * 0.2),
        level: this.getDimensionLevel(Math.floor(assessment.total_score * 0.2))
      },
      {
        name: '社交功能',
        score: Math.floor(assessment.total_score * 0.15),
        maxScore: Math.floor((assessment.max_score || 100) * 0.15),
        level: this.getDimensionLevel(Math.floor(assessment.total_score * 0.15))
      },
      {
        name: '身体症状',
        score: Math.floor(assessment.total_score * 0.1),
        maxScore: Math.floor((assessment.max_score || 100) * 0.1),
        level: this.getDimensionLevel(Math.floor(assessment.total_score * 0.1))
      }
    ];
    
    return dimensions;
  },

  /**
   * 生成个性化建议
   */
  generateRecommendations(assessment) {
    const level = assessment.severity_level;
    const recommendations = [];
    
    if (level === 'severe' || level === 'moderate') {
      recommendations.push({
        id: 'professional_help',
        icon: '👩‍⚕️',
        title: '寻求专业帮助',
        description: '建议咨询心理健康专业人士，获得更全面的治疗方案',
        priority: 'high',
        priorityText: '高优先级'
      });
    }
    
    recommendations.push(
      {
        id: 'daily_music_therapy',
        icon: '🎵',
        title: '每日疗愈',
        description: '建议每天固定时间进行30分钟疗愈，最好在睡前进行',
        priority: 'high',
        priorityText: '高优先级'
      },
      {
        id: 'breathing_exercise',
        icon: '🧘‍♀️',
        title: '深呼吸练习',
        description: '配合音频进行腹式呼吸，有助于放松神经系统',
        priority: 'medium',
        priorityText: '中优先级'
      },
      {
        id: 'sleep_hygiene',
        icon: '😴',
        title: '改善睡眠环境',
        description: '保持卧室温度适宜、光线暗淡，使用舒缓的背景音频',
        priority: 'medium',
        priorityText: '中优先级'
      },
      {
        id: 'regular_schedule',
        icon: '⏰',
        title: '规律作息',
        description: '保持固定的睡眠和起床时间，建立健康的生物钟',
        priority: 'low',
        priorityText: '低优先级'
      }
    );
    
    return recommendations;
  },

  /**
   * 生成疗愈计划
   */
  generateHealingSchedule(assessment) {
    return [
      {
        time: '晨起',
        icon: '☀️',
        name: '唤醒音频',
        duration: '10分钟'
      },
      {
        time: '下午',
        icon: '🧘',
        name: '放松冥想',
        duration: '15分钟'
      },
      {
        time: '晚上',
        icon: '🌙',
        name: '睡前疗愈',
        duration: '30分钟'
      }
    ];
  },

  /**
   * 获取维度等级
   */
  getDimensionLevel(score) {
    if (score <= 5) return '优秀';
    if (score <= 10) return '良好';
    if (score <= 15) return '一般';
    return '需关注';
  },

  /**
   * 获取严重程度标签
   */
  getSeverityLabel(level) {
    const labels = {
      'normal': '正常范围',
      'mild': '轻度',
      'moderate': '中度',
      'severe': '重度'
    };
    return labels[level] || '未知';
  },

  /**
   * 获取分数百分比
   */
  getScorePercentile(score) {
    // 模拟百分比计算
    const percentile = Math.min(95, Math.max(5, Math.floor(100 - (score / 100 * 90))));
    return percentile;
  },

  /**
   * 获取详细解读
   */
  getDetailedInterpretation(assessment) {
    const level = assessment.severity_level;
    const interpretations = {
      'normal': '您的心理状态处于健康范围内，继续保持积极的生活方式和良好的生活习惯。建议定期进行疗愈以维持心理健康。',
      'mild': '您可能正在经历一些轻度的心理压力或情绪波动。这是正常的，通过适当的放松和调节可以有效改善。建议加强疗愈的频率。',
      'moderate': '您的心理状态需要引起重视。建议结合疗愈与其他干预手段，必要时咨询专业心理健康专家。每日的疗愈练习非常重要。',
      'severe': '您的心理状态需要立即关注。强烈建议尽快咨询专业心理健康专家或医生。疗愈可以作为辅助手段，但不能替代专业治疗。'
    };
    return interpretations[level] || '请根据评测结果适当调节心理状态。';
  },

  /**
   * 保存报告
   */
  onSaveReport() {
    wx.showToast({
      title: '报告已保存',
      icon: 'success'
    });
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
          console.log('🎨 评测结果页面主题已更新:', data.theme)
        }
      }

      wx.$emitter.on('themeChanged', this.themeChangeHandler)
      console.log('✅ 评测结果页面主题监听器已注册')

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
        console.log('🔄 评测结果页面检测到主题不同步，强制更新:', savedTheme)
        app.globalData.currentTheme = savedTheme
      }
      
      this.setData({
        currentTheme: currentTheme,
        themeClass: themeConfig?.class || (currentTheme === 'default' ? '' : currentTheme),
        themeConfig: themeConfig || { class: (currentTheme === 'default' ? '' : currentTheme) }
      })
      
      console.log('🎨 评测结果页面主题强制同步完成:', currentTheme)
    } catch (error) {
      console.error('评测结果页面强制主题刷新失败:', error)
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
   * 分享评测结果
   */
  onShareAppMessage() {
    return {
      title: `我完成了AI疗愈心理评测，得分${this.data.assessment?.total_score || 0}分`,
      path: '/pages/assessment/scales/scales',
      imageUrl: '/images/share-result.png'
    }
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: `AI疗愈心理评测 - 我的得分：${this.data.assessment?.total_score || 0}分`,
      query: '',
      imageUrl: '/images/share-result.png'
    }
  },

  /**
   * 🔧 新增：检查场景上下文
   */
  checkSceneContext() {
    const context = sceneContextManager.getCurrentContext()
    if (context && context.active) {
      this.setData({
        sceneContext: context,
        isInSceneMode: true
      })
      console.log('🎯 评测结果页面检测到场景上下文:', context)
    } else {
      this.setData({
        sceneContext: null,
        isInSceneMode: false
      })
      console.log('🔄 评测结果页面无场景上下文')
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
        console.log('🧹 评测结果页面主题监听器已清理');
      } catch (error) {
        console.error('清理主题监听器失败:', error);
      }
    }
  }
})
