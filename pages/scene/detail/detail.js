// pages/scene/detail/detail.js
// 疗愈场景详情页面
const app = getApp()
const { AssessmentAPI, MusicAPI, LongSequenceAPI } = require('../../../utils/healingApi')
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
    
    // 场景信息
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
    
    // 趋势图数据
    trendData: [],
    trendLinePoints: '',
    latestScore: null,
    latestAssessment: null,
    trendDirection: '--',
    
    // 脑波历史
    brainwaveHistory: [],
    loadingBrainwaves: false,
    
    // 全局播放器相关
    showGlobalPlayer: false,
    isPlaying: false,
    
    // 场景上下文相关
    sceneContext: null,
    isInSceneMode: false,
    sceneHint: ''
  },

  onLoad(options) {
    
    // 初始化主题
    this.initTheme()
    
    // 初始化全局播放器 - 修复全局播放器在场景详情页面不工作的问题
    this.initGlobalPlayerRef()
    
    // 解析URL参数
    const { sceneId, sceneName, scaleType, sceneTheme } = options
    this.setData({
      sceneId: parseInt(sceneId) || null,
      sceneName: decodeURIComponent(sceneName || '未知场景'),
      scaleType: scaleType || null,
      sceneTheme: decodeURIComponent(sceneTheme || sceneName || '疗愈场景')
    })
    
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: this.data.sceneName
    })
    
    // 检查登录状态并加载数据
    this.checkLoginAndLoadData()
  },
  
  /**
   * 初始化全局播放器引用 - 确保全局播放器在当前页面正常工作
   */
  initGlobalPlayerRef() {
    const app = getApp()
    if (app.globalData) {
      // 设置页面引用，供全局播放器组件使用
      app.globalData.currentPageInstance = this
      console.log('✅ 场景详情页面 - 全局播放器引用已初始化')
    }
  },

  onShow() {
    // 🔧 强制刷新主题状态，解决跨页面同步问题
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
      
      // 设置场景上下文，无论是否登录都要设置，这样音乐库能知道当前场景
      this.setSceneContext()
      
      // 检查和更新场景模式状态
      this.checkSceneContext()
      
      if (isLoggedIn) {
        // 并行加载评测历史和脑波历史
        await Promise.all([
          this.loadAssessmentHistory(),
          this.loadBrainwaveHistory()
        ])
      } else {
        this.setData({
          assessmentHistory: [],
          brainwaveHistory: []
        })
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
    }
  },

  /**
   * 设置场景上下文
   */
  setSceneContext() {
    const { sceneId, sceneName, scaleType, sceneTheme } = this.data
    
    if (sceneId) {
      console.log('🎯 设置场景上下文:', { sceneId, sceneName, scaleType, sceneTheme })
      
      sceneContextManager.setSceneContext({
        sceneId,
        sceneName,
        scaleType,
        sceneTheme,
        source: '/pages/scene/detail/detail'
      })
    }
  },

  /**
   * 检查场景上下文状态
   */
  checkSceneContext() {
    const context = sceneContextManager.getCurrentContext()
    const isInSceneMode = sceneContextManager.isInSceneMode()
    const sceneHint = sceneContextManager.getSceneNavigationHint()
    
    console.log('🎯 场景详情页面检查场景上下文:', { context, isInSceneMode, sceneHint })
    
    this.setData({
      sceneContext: context,
      isInSceneMode,
      sceneHint
    })
  },

  /**
   * 切换到全部场景
   */
  exitSceneMode() {
    wx.showModal({
      title: '切换到全部场景',
      content: '是否切换到全部场景模式？将清除当前场景过滤状态。',
      confirmText: '切换',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          sceneContextManager.clearSceneContext()
          this.checkSceneContext()
          wx.showToast({
            title: '已切换到全部场景',
            icon: 'success'
          })
        }
      }
    })
  },

  /**
   * 加载评测历史（针对当前场景）
   */
  async loadAssessmentHistory() {
    console.log('📊 加载场景评测历史:', this.data.sceneName)
    
    if (!this.data.userInfo) {
      return
    }
    
    this.setData({ loadingAssessments: true })
    
    try {
      const userId = this.data.userInfo.id || this.data.userInfo.user_id
      console.log('📡 [调试] 准备调用评测历史API，用户ID:', userId)
      
      const result = await AssessmentAPI.getHistory(userId)
      console.log('📡 [调试] 评测历史API返回结果:', result)
      
      if (result.success && result.data) {
        // 🔧 修复：过滤掉无效的评测ID（防止传递不存在的评测ID到后端）
        let validAssessments = result.data.filter(item => {
          const isValid = item && item.id && typeof item.id === 'number' && item.id > 0
          if (!isValid) {
            console.warn('⚠️ 发现无效评测记录，已过滤:', item)
          }
          return isValid
        })

        console.log(`🔍 评测ID有效性验证完成，有效记录数: ${validAssessments.length}`)

        // 过滤与当前场景相关的评测记录
        let filteredAssessments = validAssessments.filter(item => item.status === 'completed')
        
        console.log('🔍 开始场景评测过滤，当前场景:', {
          sceneId: this.data.sceneId,
          sceneName: this.data.sceneName,
          完成的评测数量: filteredAssessments.length,
          评测列表: filteredAssessments.map(item => ({
            id: item.id,
            scale_name: item.scale_name,
            scale_type: item.scale_type,
            status: item.status
          }))
        })
        
        // 🔧 修复：重新启用场景映射过滤（映射服务已修复）
        if (this.data.sceneId) {
          try {
            // 🔧 修复：添加数据验证，确保所有评测对象都有必要的字段
            const validAssessments = filteredAssessments.filter(item => {
              const hasRequiredFields = item && 
                item.scale_name &&
                typeof item === 'object'
              
              if (!hasRequiredFields) {
                console.warn('⚠️ 发现缺少必要字段的评测记录，已跳过场景匹配:', item)
              }
              
              return hasRequiredFields
            })
            
            console.log(`📊 开始场景评测映射，有效评测数量: ${validAssessments.length}`)
            
            const sceneFilterPromises = validAssessments.map(item => 
              sceneMappingService.isScaleMatchingScene(
                item, 
                this.data.sceneId, 
                this.data.sceneName
              )
            )
            
            const matchResults = await Promise.all(sceneFilterPromises)
            filteredAssessments = validAssessments.filter((item, index) => matchResults[index])
            
            console.log(`🎯 场景${this.data.sceneName}(ID:${this.data.sceneId})评测历史过滤完成:`, {
              原始数量: result.data.length,
              完成的评测: result.data.filter(item => item.status === 'completed').length,
              验证后数量: validAssessments.length,
              场景相关: filteredAssessments.length
            })
            
          } catch (error) {
            console.error('❌ 场景评测历史过滤失败:', error)
            // 🔧 修复：映射服务失败时，显示所有已完成的评测
            wx.showToast({
              title: '场景数据获取失败，显示全部评测',
              icon: 'none'
            })
            // 不进行场景过滤，显示所有已完成的评测
            filteredAssessments = validAssessments.filter(item => item.status === 'completed')
          }
        }
        
        // 按时间倒序排列
        const sortedAssessments = filteredAssessments
          .sort((a, b) => {
            const dateA = new Date(a.completed_at || a.created_at || 0)
            const dateB = new Date(b.completed_at || b.created_at || 0)
            return dateB - dateA
          })
          .slice(0, 10) // 最多显示10条
          .map(item => {
            // 🔧 修复：更全面地查找分数字段
            const scoreValue = item.result || item.score || item.total_score || item.assessment_result || 
                               item.final_score || item.points || item.grade || item.assessment_score ||
                               item.raw_score || item.calculated_score
            
            // 调试：记录分数查找结果
            if (!scoreValue) {
              console.warn('⚠️ 评测记录无分数:', item.id, item.scale_name)
            }
            
            return {
              id: item.id || item.assessment_id,  // 🔧 修复：使用正确的评测记录ID
              date: this.formatDate(item.completed_at || item.created_at),
              result: this.getAssessmentResultText(scoreValue),
              scaleName: item.scale_name || '心理评测',
              scaleType: item.scale_type,
              score: typeof scoreValue === 'number' ? scoreValue : (typeof scoreValue === 'string' && !isNaN(Number(scoreValue)) ? Number(scoreValue) : scoreValue),
              rawData: item
            }
          })
        
        console.log('📊 评测历史数据处理完成:', {
          场景: this.data.sceneName,
          原始数量: result.data.length,
          场景相关: filteredAssessments.length,
          最终显示: sortedAssessments.length
        })

        this.setData({
          assessmentHistory: sortedAssessments
        })
        
        // 生成趋势图数据
        this.generateTrendData(sortedAssessments)
        
        console.log(`✅ 场景${this.data.sceneName}评测历史加载完成:`, sortedAssessments.length, '条记录')
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
   * 加载脑波历史（针对当前场景）
   */
  async loadBrainwaveHistory() {
    console.log('🧠 加载场景脑波历史:', this.data.sceneName)
    
    if (!this.data.userInfo) {
      return
    }
    
    this.setData({ loadingBrainwaves: true })
    
    try {
      const userId = this.data.userInfo.id || this.data.userInfo.user_id
      console.log('📡 [调试] 准备并行获取脑波数据，用户ID:', userId)
      
      // 并行获取60秒音频和长序列音频
      const [musicResult, longSequenceResult] = await Promise.allSettled([
        MusicAPI.getUserMusic(userId),
        LongSequenceAPI.getUserLongSequences(userId)
      ])
      
      console.log('📡 [调试] 脑波API调用结果:', {
        musicResult: musicResult,
        longSequenceResult: longSequenceResult
      })
      
      let allBrainwaves = []
      
      // 处理60秒音频
      if (musicResult.status === 'fulfilled' && musicResult.value.success && musicResult.value.data) {
        const userMusic = musicResult.value.data.map(item => ({
          id: item.id,
          name: this.generate60sAudioName(item),
          date: this.formatDate(item.updated_at || item.created_at),
          duration: item.duration_seconds || 60,
          url: item.url || item.audio_url || item.file_path,
          image: '/images/default-music-cover.svg',
          type: '60s_generated',
          // 🔧 修复：将场景映射服务需要的字段提升到顶级
          assessment_scale_name: item.assessment_info?.scale_name || item.scale_name,
          scale_type: item.assessment_info?.scale_type || item.scale_type,
          scale_name: item.assessment_info?.scale_name || item.scale_name,
          category: item.category,
          tags: item.tags,
          rawData: item
        }))
        allBrainwaves.push(...userMusic)
      }
      
      // 处理长序列音频
      if (longSequenceResult.status === 'fulfilled' && longSequenceResult.value.success && longSequenceResult.value.data) {
        const longSequences = longSequenceResult.value.data
          .filter(item => item.status === 'completed' && item.final_file_path)
          .map(item => ({
            id: item.session_id,
            name: this.getBrainwaveDisplayName(item),
            date: this.formatDate(item.updated_at || item.created_at),
            duration: item.duration_minutes ? item.duration_minutes * 60 : 1800,
            url: item.final_file_path,
            image: '/images/default-music-cover.svg',
            type: 'long_sequence',
            // 🔧 修复：将场景映射服务需要的字段提升到顶级
            assessment_scale_name: item.assessment_info?.scale_name || item.scale_name,
            scale_type: item.assessment_info?.scale_type || item.scale_type,
            scale_name: item.assessment_info?.scale_name || item.scale_name,
            category: item.category,
            tags: item.tags,
            rawData: item
          }))
        allBrainwaves.push(...longSequences)
      }
      
      // 按时间排序
      allBrainwaves.sort((a, b) => {
        const dateA = new Date(a.rawData.updated_at || a.rawData.created_at || 0)
        const dateB = new Date(b.rawData.updated_at || b.rawData.created_at || 0)
        return dateB - dateA
      })
      
      // 🔧 修复：重新启用场景过滤逻辑（映射服务已修复）
      let filteredBrainwaves = allBrainwaves
      
      console.log('🔍 脑波历史数据:', {
        sceneId: this.data.sceneId,
        sceneName: this.data.sceneName,
        脑波总数: allBrainwaves.length,
        脑波列表: allBrainwaves.map(item => ({
          name: item.name,
          type: item.type,
          date: item.date
        }))
      })
      
      if (this.data.sceneId && allBrainwaves.length > 0) {
        try {
          // 使用场景映射服务过滤脑波记录（与脑波库页面保持一致）
          // 🔧 修复：传递完整的brainwave对象，而不是rawData
          console.log(`🎵 开始场景脑波映射，脑波数量: ${allBrainwaves.length}`)
          
          const brainwaveFilterPromises = allBrainwaves.map(brainwave => 
            sceneMappingService.isMusicMatchingScene(
              brainwave,
              this.data.sceneId,
              this.data.sceneName
            )
          )
          
          const matchResults = await Promise.all(brainwaveFilterPromises)
          filteredBrainwaves = allBrainwaves.filter((brainwave, index) => matchResults[index])
          
          console.log(`🎯 场景「${this.data.sceneName}」(ID:${this.data.sceneId})脑波历史过滤完成:`, {
            原始数量: allBrainwaves.length,
            场景相关: filteredBrainwaves.length,
            过滤结果: filteredBrainwaves.map(item => item.name)
          })
          
        } catch (error) {
          console.error('❌ 场景脑波历史过滤失败，显示所有脑波:', error)
          // 过滤失败时保持原始数据
        }
      }
      
      const finalBrainwaves = filteredBrainwaves.slice(0, 10) // 最多显示10条
      
      console.log('🎯 [调试] 最终脑波历史数据处理:', {
        原始60秒音频数量: musicResult.status === 'fulfilled' && musicResult.value.success ? musicResult.value.data.length : 0,
        原始长序列数量: longSequenceResult.status === 'fulfilled' && longSequenceResult.value.success ? longSequenceResult.value.data.length : 0,
        合并后脑波总数: allBrainwaves.length,
        场景过滤后数量: filteredBrainwaves.length,
        最终页面显示数量: finalBrainwaves.length,
        最终显示数据: finalBrainwaves
      })
      
      this.setData({
        brainwaveHistory: finalBrainwaves
      })
      
      console.log(`🧠 [调试] 场景${this.data.sceneName}脑波历史加载完成并设置到页面:`, {
        脑波数量: finalBrainwaves.length,
        页面数据: this.data.brainwaveHistory
      })
    } catch (error) {
      console.error('加载脑波历史异常:', error)
      this.setData({ brainwaveHistory: [] })
    } finally {
      this.setData({ loadingBrainwaves: false })
    }
  },

  /**
   * 生成趋势图数据
   */
  generateTrendData(assessments) {
    console.log('📈 生成趋势图数据:', assessments?.length || 0, '条评测记录')
    
    if (!assessments || assessments.length === 0) {
      console.log('⚠️ [场景趋势图] 评测数据为空，返回空趋势图')
      this.setData({
        trendData: [],
        trendLinePoints: '',
        latestScore: null,
        latestAssessment: null,
        trendDirection: '--'
      })
      return
    }

    // 取最近7次评测数据用于趋势图
    const recentAssessments = assessments.slice(0, 7).reverse() // 按时间正序排列
    
    // 过滤出有分数的评测（检查原始字段）
    const scoredAssessments = recentAssessments.filter(item => {
      // 检查更多可能的分数字段
      const hasScore = (typeof item.score === 'number' && item.score >= 0) ||
                      (typeof item.result === 'number' && item.result >= 0) ||
                      (typeof item.total_score === 'number' && item.total_score >= 0) ||
                      (typeof item.assessment_result === 'number' && item.assessment_result >= 0) ||
                      (typeof item.final_score === 'number' && item.final_score >= 0) ||
                      (typeof item.points === 'number' && item.points >= 0) ||
                      (typeof item.grade === 'number' && item.grade >= 0)
      
      // 分数检查：保留有效的数字分数
      
      return hasScore
    })
    
    console.log('📈 趋势图数据过滤:', recentAssessments.length, '条记录，', scoredAssessments.length, '条有分数')
    
    if (scoredAssessments.length === 0) {
      console.log('⚠️ 有评测记录但无有效分数')
      // 如果有评测记录但没有分数，显示评测数量但提示暂无分数
      const latestAssessment = assessments[0]
      this.setData({
        trendData: [],
        trendLinePoints: '',
        latestScore: null,
        latestAssessment: latestAssessment ? {
          ...latestAssessment,
          date: this.formatDate(latestAssessment.completed_at || latestAssessment.created_at),
          result: latestAssessment.result || '暂无分数'
        } : null,
        trendDirection: '暂无数据'
      })
      return
    }

    // 统一分数字段
    const processedAssessments = scoredAssessments.map(item => ({
      ...item,
      score: item.score || item.result || item.total_score || item.assessment_result || item.final_score || item.points || item.grade || 0,
      date: this.formatDate(item.completed_at || item.created_at)
    }))

    // 计算分数范围
    const scores = processedAssessments.map(item => item.score)
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    const scoreRange = maxScore - minScore || 1 // 避免除零

    // 生成趋势点数据
    const trendData = processedAssessments.map((item, index) => {
      const x = processedAssessments.length > 1 ? (index / (processedAssessments.length - 1)) * 80 + 10 : 50
      const y = ((item.score - minScore) / scoreRange) * 60 + 20 // 20-80%范围
      
      return {
        x: x,
        y: y,
        score: item.score,
        date: item.date,
        isLatest: index === processedAssessments.length - 1
      }
    })

    // 生成连接线点坐标
    const linePoints = trendData.map(point => `${point.x},${100 - point.y}`).join(' ')

    // 计算趋势方向
    let trendDirection = '--'
    if (processedAssessments.length >= 2) {
      const latestScore = processedAssessments[processedAssessments.length - 1].score
      const previousScore = processedAssessments[processedAssessments.length - 2].score
      
      if (latestScore > previousScore) {
        trendDirection = '↗ 上升'
      } else if (latestScore < previousScore) {
        trendDirection = '↘ 下降'
      } else {
        trendDirection = '→ 稳定'
      }
    }

    // 获取最新评测数据
    const latestAssessment = assessments[0] // 原始数组是按时间倒序的
    const latestScore = latestAssessment?.score || latestAssessment?.result || latestAssessment?.total_score || null

    this.setData({
      trendData: trendData,
      trendLinePoints: linePoints,
      latestScore: latestScore,
      latestAssessment: latestAssessment,
      trendDirection: trendDirection
    })

    console.log('📈 场景页面趋势图数据生成完成:', {
      原始评测数量: assessments.length,
      原始评测样本: assessments.slice(0, 2).map(item => ({
        id: item.id,
        score: item.score,
        result: item.result,
        total_score: item.total_score,
        date: item.date
      })),
      过滤后有效分数数量: processedAssessments.length,
      处理后评测样本: processedAssessments.slice(0, 2).map(item => ({
        id: item.id,
        score: item.score,
        date: item.date
      })),
      趋势点数据: trendData,
      趋势方向: trendDirection,
      最新分数: latestScore
    })
  },

  /**
   * 跳转到评测历史页面
   */
  navigateToAssessmentHistory() {
    console.log('📊 跳转到评测历史页面')
    
    // 如果未登录，先引导登录
    if (!this.data.isLoggedIn) {
      this.promptLogin('查看评测历史需要先登录账户')
      return
    }
    
    // 构建跳转URL，传递场景信息
    const url = `/pages/assessment/history/history?sceneId=${this.data.sceneId}&sceneName=${encodeURIComponent(this.data.sceneName)}&scaleType=${this.data.scaleType}&sceneTheme=${encodeURIComponent(this.data.sceneTheme)}`
    
    console.log('🎯 跳转到评测历史页面，参数:', {
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType,
      url: url
    })
    
    wx.navigateTo({
      url: url
    })
  },

  /**
   * 跳转到评测页面
   */
  navigateToAssessment() {
    console.log('🚀 跳转到评测页面')
    
    // 如果未登录，先引导登录
    if (!this.data.isLoggedIn) {
      this.promptLogin('进行专业评测需要先登录账户')
      return
    }
    
    // 设置场景上下文
    sceneContextManager.setSceneContext({
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType,
      sceneTheme: this.data.sceneTheme,
      source: '/pages/scene/detail/detail'
    })
    
    console.log('🎯 设置场景上下文后跳转到评测页面:', {
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType
    })
    
    wx.switchTab({
      url: '/pages/assessment/scales/scales'
    })
  },

  /**
   * 跳转到AI生成脑波页面
   */
  navigateToGenerator() {
    console.log('🧠 跳转到AI生成脑波页面')
    
    // 如果未登录，先引导登录
    if (!this.data.isLoggedIn) {
      this.promptLogin('生成AI脑波需要先登录账户')
      return
    }
    
    // 设置场景上下文
    sceneContextManager.setSceneContext({
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType,
      sceneTheme: this.data.sceneTheme,
      source: '/pages/scene/detail/detail'
    })
    
    console.log('🎯 设置场景上下文后跳转到脑波生成页面:', {
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType
    })
    
    wx.navigateTo({
      url: '/pages/longSequence/create/create'
    })
  },

  /**
   * 跳转到脑波库页面
   */
  navigateToMusicLibrary() {
    console.log('🧠 跳转到脑波库页面')
    
    // 设置场景上下文
    sceneContextManager.setSceneContext({
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType,
      sceneTheme: this.data.sceneTheme,
      source: '/pages/scene/detail/detail'
    })
    
    console.log('🎯 设置场景上下文后跳转到脑波库页面:', {
      sceneId: this.data.sceneId,
      sceneName: this.data.sceneName,
      scaleType: this.data.scaleType
    })
    
    wx.switchTab({
      url: '/pages/music/library/library'
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
   * 播放历史脑波
   */
  onPlayHistoryBrainwave(e) {
    const music = e.currentTarget.dataset.music
    
    if (!this.data.isLoggedIn) {
      this.promptLogin('播放脑波需要先登录账户')
      return
    }

    if (!music.url) {
      wx.showToast({
        title: '脑波文件不存在',
        icon: 'error'
      })
      return
    }

    console.log('🎵 播放历史脑波:', music)

    // 构建播放器数据
    const trackInfo = {
      name: music.name || '未知脑波',
      url: music.url,
      image: music.image || '/images/default-music-cover.svg',
      category: music.type === '60s_generated' ? '60秒脑波' : '疗愈脑波',
      type: music.type || 'brainwave',
      id: music.id,
      duration: music.duration || 60
    }

    // 如果是相对路径，转换为完整URL
    if (trackInfo.url && trackInfo.url.startsWith('/')) {
      const baseUrl = app.globalData.apiBaseUrl ? app.globalData.apiBaseUrl.replace('/api', '') : 'https://medsleep.cn'
      trackInfo.url = `${baseUrl}${trackInfo.url}`
    }

    // 显示全局播放器
    this.setData({
      showGlobalPlayer: true
    })

    // 使用全局播放器播放
    setTimeout(() => {
      const globalPlayer = this.selectComponent('#globalPlayer')
      if (globalPlayer && globalPlayer.playTrack) {
        globalPlayer.playTrack(trackInfo)
      } else {
        console.warn('全局播放器组件未找到')
        wx.showToast({
          title: '播放器初始化失败',
          icon: 'none'
        })
      }
    }, 100)
  },

  /**
   * 登录提示
   */
  promptLogin(e) {
    // 🔧 修复：检查第一个参数是否为事件对象，如果是则使用默认消息
    let message = '查看场景详情需要先登录账户'
    
    // 如果传入的是字符串，使用传入的消息；如果是事件对象或其他，使用默认消息
    if (typeof e === 'string') {
      message = e
    }
    
    console.log('🔐 登录按钮被点击')
    console.log('📝 使用的消息内容:', message)
    
    wx.showModal({
      title: '需要登录',
      content: message,
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          const redirectUrl = `/pages/scene/detail/detail?sceneId=${this.data.sceneId}&sceneName=${encodeURIComponent(this.data.sceneName)}&scaleType=${this.data.scaleType}&sceneTheme=${encodeURIComponent(this.data.sceneTheme)}`
          console.log('🔐 跳转到登录页面，重定向URL:', redirectUrl)
          
          wx.navigateTo({
            url: '/pages/login/login?redirect=' + encodeURIComponent(redirectUrl)
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
          console.log('🎨 场景详情页面主题已更新:', data.theme)
        }
      }

      wx.$emitter.on('themeChanged', this.themeChangeHandler)
      console.log('✅ 场景详情页面主题监听器已注册')

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
        console.log('🔄 场景详情页面检测到主题不同步，强制更新:', savedTheme)
        app.globalData.currentTheme = savedTheme
      }
      
      this.setData({
        currentTheme: currentTheme,
        themeClass: themeConfig?.class || (currentTheme === 'default' ? '' : currentTheme),
        themeConfig: themeConfig || { class: (currentTheme === 'default' ? '' : currentTheme) }
      })
      
      console.log('🎨 场景详情页面主题强制同步完成:', currentTheme)
    } catch (error) {
      console.error('场景详情页面强制主题刷新失败:', error)
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
      if (!e || !e.detail) {
        console.error('主题切换事件参数错误:', e);
        return;
      }

      const { theme, config } = e.detail;
      
      if (!theme || !config) {
        console.error('主题切换缺少必要参数:', { theme, config });
        return;
      }

      console.log('场景页面主题切换到:', theme, config);
      
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
      console.error('场景页面主题切换处理失败:', error);
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
   * 生成60秒音频显示名称
   */
  generate60sAudioName(item) {
    if (item.assessment_info) {
      const assessmentInfo = item.assessment_info
      const scaleName = assessmentInfo.scale_name || assessmentInfo.scaleName || '心理评测'
      const result = this.getAssessmentResultText(assessmentInfo.total_score)
      return `${scaleName} · ${result}`
    }
    
    if (item.assessment_id) {
      return `评测脑波 #${item.assessment_id}`
    }
    
    if (item.title && item.title !== '60秒定制音乐') {
      return item.title
    }
    
    return `60秒疗愈脑波 #${item.id}`
  },

  /**
   * 获取脑波显示名称
   */
  getBrainwaveDisplayName(item) {
    if (item.title && item.title !== '60秒定制音乐') return item.title
    if (item.name && item.name !== '60秒定制音乐') return item.name
    
    const duration = item.duration_seconds || item.duration_minutes * 60 || 0
    if (duration <= 120) {
      return '60秒定制音乐'
    } else if (duration >= 1800) {
      return '疗愈脑波'
    }
    
    const id = item.session_id || item.id || 'unknown'
    return `定制音乐-${id.toString().substring(0, 8)}`
  },

  // ==================== 全局播放器相关 ====================

  onGlobalPlayerStateChange(e) {
    const { isPlaying } = e.detail
    this.setData({ isPlaying })
  },

  onNextTrack() {
    console.log('下一首')
  },

  onPreviousTrack() {
    console.log('上一首')
  },

  onCloseGlobalPlayer() {
    this.setData({ 
      showGlobalPlayer: false,
      isPlaying: false
    })
  },

  onExpandGlobalPlayer(e) {
    const { track } = e.detail
    console.log('展开播放器', track)
    wx.navigateTo({
      url: '/pages/music/player/player'
    })
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
      title: `AI疗愈 - ${this.data.sceneName}`,
      path: `/pages/scene/detail/detail?sceneId=${this.data.sceneId}&sceneName=${encodeURIComponent(this.data.sceneName)}&scaleType=${this.data.scaleType}&sceneTheme=${encodeURIComponent(this.data.sceneTheme)}`,
      imageUrl: '/images/share-scene.png'
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
        console.log('🧹 场景详情页面主题监听器已清理');
      } catch (error) {
        console.error('清理主题监听器失败:', error);
      }
    }
  }
})
