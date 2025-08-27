/**
 * 智能推荐引擎
 * 基于用户评测结果、播放历史、时间段等因素进行个性化音乐推荐
 */

const { MusicAPI, AssessmentAPI } = require('./healingApi')
const { unifiedMusicManager } = require('./unifiedMusicManager')

class RecommendationEngine {
  constructor() {
    // 推荐权重配置
    this.weights = {
      assessment: 0.4,      // 评测结果权重40%
      history: 0.3,         // 播放历史权重30%
      time: 0.2,           // 时间段权重20%
      category: 0.1        // 分类偏好权重10%
    }
    
    // 评测结果到音乐分类的映射
    this.assessmentToCategory = {
      // 焦虑相关
      'anxiety': [1, 5],           // 自然音、疗愈资源
      'stress': [1, 2, 5],         // 自然音、白噪音、疗愈资源
      'tension': [1, 3, 5],        // 自然音、脑波音频、疗愈资源
      
      // 睡眠相关
      'sleep': [1, 3, 4],          // 自然音、脑波音频、AI音乐
      'insomnia': [1, 3],          // 自然音、脑波音频
      'fatigue': [1, 5],           // 自然音、疗愈资源
      
      // 情绪相关
      'depression': [4, 5],        // AI音乐、疗愈资源
      'mood': [1, 4, 5],           // 自然音、AI音乐、疗愈资源
      'emotional': [4, 5],         // AI音乐、疗愈资源
      
      // 专注相关
      'focus': [2, 3],             // 白噪音、脑波音频
      'concentration': [2, 3],     // 白噪音、脑波音频
      'attention': [2, 3],         // 白噪音、脑波音频
      
      // 放松相关
      'relax': [1, 3, 5],          // 自然音、脑波音频、疗愈资源
      'meditation': [1, 3, 5],     // 自然音、脑波音频、疗愈资源
      'calm': [1, 5]               // 自然音、疗愈资源
    }
    
    // 时间段推荐映射
    this.timeToCategory = {
      morning: [2, 3],      // 早晨：白噪音、脑波音频（提神醒脑）
      afternoon: [2, 4],    // 下午：白噪音、AI音乐（专注工作）
      evening: [1, 5],      // 傍晚：自然音、疗愈资源（放松）
      night: [1, 3, 4]      // 夜晚：自然音、脑波音频、AI音乐（助眠）
    }
  }
  
  /**
   * 获取用户个性化推荐
   * @param {number} userId - 用户ID
   * @param {number} limit - 推荐数量限制
   * @returns {Promise<Array>} 推荐音乐列表
   */
  async getPersonalizedRecommendations(userId, limit = 6) {
    console.log('开始生成个性化推荐，userId:', userId)
    
    try {
      // 1. 获取用户评测结果
      const assessmentData = await this.getUserAssessmentData(userId)
      
      // 2. 获取用户播放历史
      const historyData = await this.getUserHistoryData(userId)
      
      // 3. 获取用户生成的音乐
      const userGeneratedMusic = await this.getUserGeneratedMusic(userId)
      
      // 4. 计算推荐分类
      const recommendedCategories = this.calculateRecommendedCategories(assessmentData, historyData)
      
      // 5. 生成推荐列表
      const recommendations = []
      
      // 优先添加用户生成的音乐（权重最高）
      if (userGeneratedMusic.length > 0) {
        recommendations.push(...userGeneratedMusic.slice(0, Math.min(2, limit)))
      }
      
      // 添加基于评测结果的推荐
      const remainingSlots = limit - recommendations.length
      if (remainingSlots > 0) {
        const assessmentRecommendations = await this.getAssessmentBasedRecommendations(
          recommendedCategories, 
          remainingSlots,
          assessmentData  // 传递评测数据
        )
        recommendations.push(...assessmentRecommendations)
      }
      
      console.log(`生成 ${recommendations.length} 个个性化推荐`)
      return recommendations
      
    } catch (error) {
      console.error('生成个性化推荐失败:', error)
      // 回退到基础推荐
      return await this.getFallbackRecommendations(userId, limit)
    }
  }
  
  /**
   * 获取分类推荐音乐
   * @param {number} categoryId - 分类ID
   * @param {number} limit - 推荐数量
   * @param {object} userContext - 用户上下文（可选）
   * @returns {Promise<Array>} 推荐音乐列表
   */
  async getCategoryRecommendations(categoryId, limit = 3, userContext = null) {
    console.log(`获取分类 ${categoryId} 的推荐音乐`)
    
    try {
      // 分类ID到分类代码的映射（与后台统一配置保持一致）
      const categoryMapping = {
        1: 'natural_sound',  // 自然音 -> zl-sleep/ 目录
        2: 'white_noise',    // 白噪音 -> white-noise/ 目录  
        3: 'brainwave',      // 脑波音频 -> brainwave/ 目录
        4: 'ai_music',       // AI音乐 -> ai-generated/ 目录
        5: 'healing'         // 疗愈资源 -> healing/ 目录
      }
      
      const categoryCode = categoryMapping[categoryId] || 'healing'
      
      // 获取分类下的所有音频文件
      const fileListResult = await MusicAPI.getQiniuFilesByCategory(categoryCode).catch(error => {
        console.warn(`[RecommendationEngine] 分类${categoryCode}文件列表API失败:`, error)
        return {
          success: false,
          data: { files: [] },
          error: error.message || '网络请求失败'
        }
      })
      
      if (!fileListResult.success || !fileListResult.data?.files || fileListResult.data.files.length === 0) {
        console.warn(`[RecommendationEngine] 分类${categoryCode}无可用音频文件，尝试降级方案`)
        throw new Error(`分类${categoryCode}获取文件列表失败或无文件: ${fileListResult.error || '未知错误'}`)
      }
      
      const files = fileListResult.data.files
      console.log(`分类 ${categoryCode} 共有 ${files.length} 个音频文件`)
      
      if (files.length === 0) {
        return []
      }
      
      // 智能选择推荐音频
      let selectedFiles = []
      
      if (userContext && userContext.userId) {
        // 如果有用户上下文，进行个性化选择
        selectedFiles = await this.selectFilesWithPersonalization(files, userContext, limit)
      } else {
        // 否则使用默认策略：优先选择较新的文件
        const sortedFiles = files.sort((a, b) => {
          // 按文件大小排序（大文件通常质量更好）
          return (b.size || 0) - (a.size || 0)
        })
        selectedFiles = sortedFiles.slice(0, limit)
      }
      
      // 转换为推荐格式
      return selectedFiles.map((file, index) => ({
        id: file.id || `qiniu_${categoryId}_${index}`,
        title: this.extractAudioTitle(file.name || file.key),
        name: this.extractAudioTitle(file.name || file.key),
        url: file.url,
        path: file.url,
        key: file.key,
        category: this.getCategoryName(categoryId),
        category_id: categoryId,
        duration: file.duration || 180,
        size: file.size,
        type: 'qiniu_file',
        source: 'category_recommendation',
        image: this.getDefaultImage(),
        expires_at: file.expires_at,
        recommendationReason: this.generateRecommendationReason(categoryId, userContext)
      }))
      
    } catch (error) {
      console.error('获取分类推荐失败:', error)
      
      // 回退到统一音乐管理器
      return await this.getFallbackCategoryRecommendations(categoryId, limit)
    }
  }
  
  /**
   * 获取用户评测数据
   */
  async getUserAssessmentData(userId) {
    try {
      console.log('获取用户评测数据，userId:', userId)
      
      // 获取用户最新的评测结果
      const latestAssessmentResult = await AssessmentAPI.getLatestAssessment(userId)
      
      if (!latestAssessmentResult.success || !latestAssessmentResult.data) {
        console.log('用户暂无评测结果')
        return null
      }
      
      const assessment = latestAssessmentResult.data
      console.log('获取到最新评测结果:', {
        scale_type: assessment.scale_type,
        total_score: assessment.total_score,
        severity_level: assessment.severity_level
      })
      
      // 基于评测类型和分数生成关键词
      const keywords = this.extractKeywordsFromAssessment(assessment)
      
      return {
        latest_assessment: {
          id: assessment.id,
          scale_name: assessment.scale_name,
          scale_type: assessment.scale_type,
          score: assessment.total_score,
          severity_level: assessment.severity_level,
          keywords: keywords,
          date: assessment.completed_at || assessment.created_at,
          interpretation: assessment.interpretation
        },
        trends: {
          improving: this.analyzeTrend(assessment),
          main_concerns: this.identifyMainConcerns(assessment)
        }
      }
    } catch (error) {
      console.warn('获取用户评测数据失败:', error)
      return null
    }
  }
  
  /**
   * 从评测结果中提取关键词
   */
  extractKeywordsFromAssessment(assessment) {
    const keywords = []
    
    // 基于量表类型添加关键词
    const scaleType = assessment.scale_type?.toLowerCase() || ''
    const severityLevel = assessment.severity_level?.toLowerCase() || ''
    
    // GAD-7 (广泛性焦虑障碍量表)
    if (scaleType.includes('gad')) {
      keywords.push('anxiety', 'worry')
      if (severityLevel.includes('severe')) {
        keywords.push('stress', 'tension')
      }
    }
    
    // PHQ-9 (患者健康问卷抑郁症状群量表)
    if (scaleType.includes('phq')) {
      keywords.push('depression', 'mood')
      if (severityLevel.includes('severe')) {
        keywords.push('emotional')
      }
    }
    
    // PSS (压力知觉量表)
    if (scaleType.includes('pss') || scaleType.includes('stress')) {
      keywords.push('stress', 'tension')
    }
    
    // 睡眠相关量表
    if (scaleType.includes('sleep') || scaleType.includes('insomnia')) {
      keywords.push('sleep', 'insomnia', 'fatigue')
    }
    
    // 基于严重程度添加更多关键词
    if (severityLevel.includes('mild')) {
      keywords.push('relax', 'calm')
    } else if (severityLevel.includes('moderate')) {
      keywords.push('focus', 'meditation')
    } else if (severityLevel.includes('severe')) {
      keywords.push('healing', 'therapy')
    }
    
    // 去重并返回
    return [...new Set(keywords)]
  }
  
  /**
   * 分析评测趋势
   */
  analyzeTrend(assessment) {
    // 简单的趋势分析，可以根据需要扩展
    // 这里可以比较历史评测结果来判断是否在改善
    const score = assessment.total_score || 0
    const severityLevel = assessment.severity_level?.toLowerCase() || ''
    
    // 如果是轻度问题，认为在改善
    return severityLevel.includes('mild') || severityLevel.includes('low')
  }
  
  /**
   * 识别主要关注点
   */
  identifyMainConcerns(assessment) {
    const concerns = []
    const scaleType = assessment.scale_type?.toLowerCase() || ''
    
    if (scaleType.includes('gad') || scaleType.includes('anxiety')) {
      concerns.push('anxiety')
    }
    
    if (scaleType.includes('phq') || scaleType.includes('depression')) {
      concerns.push('depression')
    }
    
    if (scaleType.includes('sleep') || scaleType.includes('insomnia')) {
      concerns.push('sleep')
    }
    
    if (scaleType.includes('stress')) {
      concerns.push('stress')
    }
    
    return concerns.length > 0 ? concerns : ['general_wellness']
  }
  
  /**
   * 获取用户播放历史数据
   */
  async getUserHistoryData(userId) {
    try {
      // 这里应该调用播放记录API
      // 暂时返回模拟数据
      return {
        favorite_categories: [1, 5], // 偏好分类
        recent_plays: [],
        total_play_time: 0
      }
    } catch (error) {
      console.warn('获取用户播放历史失败:', error)
      return null
    }
  }
  
  /**
   * 获取用户生成的音乐
   */
  async getUserGeneratedMusic(userId) {
    try {
      const userMusicResult = await MusicAPI.getUserMusic(userId)
      
      if (userMusicResult.success && userMusicResult.data) {
        return userMusicResult.data.slice(0, 2).map(music => ({
          ...music,
          isUserGenerated: true,
          recommendationReason: '您的专属音乐',
          category: 'AI音乐'
        }))
      }
      
      return []
    } catch (error) {
      console.warn('获取用户生成音乐失败:', error)
      return []
    }
  }
  
  /**
   * 计算推荐分类
   */
  calculateRecommendedCategories(assessmentData, historyData) {
    const categoryScores = {}
    
    // 基于评测结果计算分类分数
    if (assessmentData?.latest_assessment?.keywords) {
      assessmentData.latest_assessment.keywords.forEach(keyword => {
        const categories = this.assessmentToCategory[keyword] || []
        categories.forEach(categoryId => {
          categoryScores[categoryId] = (categoryScores[categoryId] || 0) + this.weights.assessment
        })
      })
    }
    
    // 基于播放历史计算分类分数
    if (historyData?.favorite_categories) {
      historyData.favorite_categories.forEach(categoryId => {
        categoryScores[categoryId] = (categoryScores[categoryId] || 0) + this.weights.history
      })
    }
    
    // 基于时间段计算分类分数
    const timeBasedCategories = this.getTimeBasedCategories()
    timeBasedCategories.forEach(categoryId => {
      categoryScores[categoryId] = (categoryScores[categoryId] || 0) + this.weights.time
    })
    
    // 排序并返回推荐分类
    return Object.entries(categoryScores)
      .sort(([,a], [,b]) => b - a)
      .map(([categoryId]) => parseInt(categoryId))
  }
  
  /**
   * 获取基于评测结果的推荐
   */
  async getAssessmentBasedRecommendations(recommendedCategories, limit, assessmentData = null) {
    const recommendations = []
    
    for (const categoryId of recommendedCategories) {
      if (recommendations.length >= limit) break
      
      try {
        const categoryRecs = await this.getCategoryRecommendations(categoryId, 1)
        if (categoryRecs.length > 0) {
          recommendations.push({
            ...categoryRecs[0],
            recommendationReason: this.getAssessmentRecommendationReason(categoryId, assessmentData)
          })
        }
      } catch (error) {
        console.warn(`获取分类 ${categoryId} 推荐失败:`, error)
      }
    }
    
    return recommendations
  }
  
  /**
   * 获取时间段相关的分类
   */
  getTimeBasedCategories() {
    const hour = new Date().getHours()
    
    if (hour >= 6 && hour < 12) {
      return this.timeToCategory.morning
    } else if (hour >= 12 && hour < 18) {
      return this.timeToCategory.afternoon
    } else if (hour >= 18 && hour < 22) {
      return this.timeToCategory.evening
    } else {
      return this.timeToCategory.night
    }
  }
  
  /**
   * 回退推荐逻辑
   */
  async getFallbackRecommendations(userId, limit = 6) {
    console.log('使用回退推荐逻辑')
    
    const recommendations = []
    const defaultCategories = [1, 5, 4] // 自然音、疗愈资源、AI音乐
    
    for (const categoryId of defaultCategories) {
      if (recommendations.length >= limit) break
      
      try {
        const categoryRecs = await this.getCategoryRecommendations(categoryId, 1)
        if (categoryRecs.length > 0) {
          recommendations.push({
            ...categoryRecs[0],
            recommendationReason: '系统推荐'
          })
        }
      } catch (error) {
        console.warn(`回退推荐获取分类 ${categoryId} 失败:`, error)
      }
    }
    
    return recommendations
  }
  
  /**
   * 回退分类推荐
   */
  async getFallbackCategoryRecommendations(categoryId, limit) {
    console.log(`[RecommendationEngine] 使用降级机制为分类${categoryId}获取推荐`)
    const recommendations = []
    
    try {
      // 首先尝试使用统一音乐管理器的随机获取
      let attempts = 0
      const maxAttempts = limit * 3 // 增加尝试次数以获得足够的不重复音乐
      
      while (recommendations.length < limit && attempts < maxAttempts) {
        try {
          const musicData = await unifiedMusicManager.getMusicByCategory(categoryId, {
            showLoading: false
          })
          
          if (musicData && musicData.title) {
            const exists = recommendations.find(r => r.title === musicData.title || r.url === musicData.url)
            if (!exists) {
              recommendations.push({
                ...musicData,
                id: musicData.id || `fallback_${categoryId}_${recommendations.length}`,
                recommendationReason: '系统推荐',
                source: 'fallback_unified_manager',
                type: 'fallback'
              })
            }
          }
        } catch (singleError) {
          console.warn('单次获取音乐失败:', singleError)
        }
        attempts++
      }
      
      console.log(`[RecommendationEngine] 降级机制获取到${recommendations.length}个推荐`)
      
    } catch (error) {
      console.error('回退分类推荐失败:', error)
    }
    
    return recommendations
  }
  
  /**
   * 工具方法：提取音频标题
   */
  extractAudioTitle(fileName) {
    if (!fileName) return '音频文件'
    
    // 移除路径和扩展名
    const name = fileName.split('/').pop().replace(/\.(mp3|wav|ogg)$/i, '')
    
    // 如果是时间戳开头的文件名，尝试提取有意义的部分
    const timestampMatch = name.match(/^\d+_(.+)/)
    if (timestampMatch) {
      return timestampMatch[1].replace(/-/g, ' ')
    }
    
    return name.replace(/-/g, ' ')
  }
  
  /**
   * 工具方法：获取分类名称
   */
  getCategoryName(categoryId) {
    const categoryNames = {
      1: '自然音',
      2: '白噪音', 
      3: '脑波音频',
      4: 'AI音乐',
      5: '疗愈资源'
    }
    return categoryNames[categoryId] || '音乐'
  }
  
  /**
   * 工具方法：获取默认图片
   */
  getDefaultImage() {
    return '/assets/images/default-image.png'
  }
  
  /**
   * 生成推荐理由
   */
  generateRecommendationReason(categoryId, userContext) {
    const hour = new Date().getHours()
    
    if (hour >= 22 || hour <= 6) {
      return '助眠推荐'
    } else if (hour >= 6 && hour <= 12) {
      return '清晨唤醒'
    } else if (hour >= 12 && hour <= 18) {
      return '专注工作'
    } else {
      return '放松时光'
    }
  }
  
  /**
   * 获取评测推荐理由
   */
  getAssessmentRecommendationReason(categoryId, assessmentData = null) {
    if (!assessmentData?.latest_assessment) {
      const defaultReasons = {
        1: '自然音帮助放松身心',
        2: '白噪音有助于提升专注力',
        3: '脑波音频能帮助调节情绪状态',
        4: '为您定制的AI音乐',
        5: '专业疗愈资源推荐'
      }
      return defaultReasons[categoryId] || '个性化推荐'
    }
    
    const assessment = assessmentData.latest_assessment
    const keywords = assessment.keywords || []
    const severityLevel = assessment.severity_level?.toLowerCase() || ''
    const scaleType = assessment.scale_type?.toLowerCase() || ''
    
    // 基于评测结果和分类生成个性化推荐理由
    const personalizedReasons = {
      1: { // 自然音
        anxiety: `基于您的${assessment.scale_name}评测结果，自然音有助缓解焦虑`,
        stress: `根据评测显示的压力水平，推荐自然音放松`,
        sleep: `针对您的睡眠问题，自然音能帮助入眠`,
        depression: `自然音的治愈力量有助改善情绪`,
        default: `基于您的评测结果，推荐自然音放松`
      },
      2: { // 白噪音
        focus: `评测显示您需要专注力提升，白噪音能有效帮助`,
        anxiety: `白噪音的规律性有助缓解焦虑情绪`,
        stress: `白噪音能掩盖干扰，帮助减压`,
        default: `白噪音有助于提升专注力和放松`
      },
      3: { // 脑波音频
        anxiety: `基于评测结果，脑波音频能调节焦虑状态`,
        sleep: `针对您的睡眠评测，推荐助眠脑波音频`,
        stress: `脑波音频有助调节压力反应`,
        meditation: `脑波音频配合冥想效果更佳`,
        default: `脑波音频能帮助调节情绪状态`
      },
      4: { // AI音乐
        depression: `基于您的情绪评测，为您定制疗愈音乐`,
        mood: `AI音乐根据您的情绪状态个性化生成`,
        emotional: `定制音乐更好地匹配您的情感需求`,
        default: `为您量身定制的AI疗愈音乐`
      },
      5: { // 疗愈资源
        severe: `根据评测的严重程度，推荐专业疗愈资源`,
        therapy: `专业疗愈音频配合治疗效果更好`,
        healing: `基于您的评测，推荐深度疗愈资源`,
        default: `专业疗愈资源助力心理健康`
      }
    }
    
    const categoryReasons = personalizedReasons[categoryId] || {}
    
    // 优先匹配关键词
    for (const keyword of keywords) {
      if (categoryReasons[keyword]) {
        return categoryReasons[keyword]
      }
    }
    
    // 匹配严重程度
    if (severityLevel && categoryReasons[severityLevel]) {
      return categoryReasons[severityLevel]
    }
    
    // 返回默认理由
    return categoryReasons.default || '基于您的评测结果推荐'
  }
  
  /**
   * 个性化文件选择
   */
  async selectFilesWithPersonalization(files, userContext, limit) {
    // 简单的个性化逻辑：根据用户偏好调整文件选择
    // 这里可以根据需要扩展更复杂的算法
    
    // 暂时使用简单的策略：优先选择文件大小适中的音频
    const sortedFiles = files.sort((a, b) => {
      const sizeA = a.size || 0
      const sizeB = b.size || 0
      
      // 偏好中等大小的文件（通常质量较好且加载快）
      const optimalSize = 3000000 // 3MB左右
      const scoreA = Math.abs(sizeA - optimalSize)
      const scoreB = Math.abs(sizeB - optimalSize)
      
      return scoreA - scoreB
    })
    
    return sortedFiles.slice(0, limit)
  }
}

// 创建单例实例
const recommendationEngine = new RecommendationEngine()

module.exports = {
  recommendationEngine,
  RecommendationEngine
}
