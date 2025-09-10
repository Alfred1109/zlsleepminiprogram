// pages/assessment/result/result.js
// 评测结果页面
const app = getApp()
const { AssessmentAPI, MusicAPI, LongSequenceAPI } = require('../../../utils/healingApi')

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
    healingSchedule: []
  },

  onLoad(options) {
    console.log('📋 评测结果页面加载', options)
    
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

  /**
   * 加载评测结果
   */
  async loadAssessmentResult() {
    this.setData({ loading: true })

    try {
      // 使用历史记录接口获取评测结果
      const AuthService = require('../../../services/AuthService')
      const userInfo = AuthService.getCurrentUser()
      if (!userInfo) {
        throw new Error('用户未登录')
      }

      console.log('📡 请求用户评测历史, userId:', userInfo.id)
      const result = await AssessmentAPI.getHistory(userInfo.id)
      console.log('📡 API响应结果:', result)

      if (result.success && result.data.length > 0) {
        // 简单粗暴：直接使用最新的评测记录
        const assessment = result.data[0] // 假设API返回的数据是按时间倒序的
        
        // 确保有max_score字段
        if (!assessment.max_score) {
          assessment.max_score = 100
        }
        
        this.setData({ 
          assessment,
          assessmentDimensions: this.generateDimensionsData(assessment),
          personalizedRecommendations: this.generateRecommendations(assessment),
          healingSchedule: this.generateHealingSchedule(assessment)
        })
      } else {
        throw new Error(result.error || '获取评测结果失败')
      }

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
   * 生成60秒音频
   */
  async generate60sMusic() {
    this.setData({ 
      generating: true, 
      generationType: '60s' 
    })

    try {
      const result = await MusicAPI.generateMusic(this.data.assessmentId)
      
      if (result.success) {
        this.setData({ musicResult: result.data })
        
        wx.showToast({
          title: '音频生成成功',
          icon: 'success'
        })

        // 跳转到播放页面
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/music/player/player?musicId=${result.data.music_id}&type=60s`
          })
        }, 1500)
      } else {
        throw new Error(result.error || '音频生成失败')
      }

    } catch (error) {
      console.error('生成60秒音频失败:', error)
      wx.showModal({
        title: '生成失败',
        content: error.message || '音频生成失败，请重试',
        showCancel: true,
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) {
            this.generate60sMusic()
          }
        }
      })
    } finally {
      this.setData({ 
        generating: false, 
        generationType: null 
      })
    }
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
   * 分享评测结果
   */
  onShareAppMessage() {
    return {
      title: `我完成了AI疗愈心理评测，得分${this.data.assessment?.total_score || 0}分`,
      path: '/pages/assessment/scales/scales',
      imageUrl: '/images/share-result.png'
    }
  }
})
