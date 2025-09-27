// pages/music/generate/generate.js
// 音乐生成页面
const app = getApp()
const { AssessmentAPI, MusicAPI } = require('../../../utils/healingApi')
const { requireSubscription, getSubscriptionInfo } = require('../../../utils/subscription')
const { getGlobalPlayer, formatTime } = require('../../../utils/musicPlayer')
const { sceneContextManager } = require('../../../utils/sceneContextManager')
const { sceneMappingService } = require('../../../utils/sceneMappingService')
const themeMixin = require('../../../utils/themeMixin')

Page({
  data: {
    userInfo: null,
    recentAssessments: [],
    selectedAssessments: [],           // 评测选择（统一使用多选逻辑）
    generating: false,
    // UI简化字段
    canGenerate: false,
    generateButtonText: '生成音乐',
    generatingText: '生成中...',
    selectedCount: 0,
    musicResult: null,
    loading: false,
    subscriptionInfo: null,
    canUseFeature: true,
    // 全局播放器相关
    showGlobalPlayer: false,
    isPlaying: false,
    player: null,
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null,
    // 场景上下文相关
    sceneContext: null,
    isInSceneMode: false,
    sceneHint: '',
    // 预选评测ID（从评测结果页面跳转时使用）
    preselectedAssessmentId: null
  },

  onLoad(options) {
    console.log('🚀 generate页面加载，参数:', options);
    
    // 初始化全局播放器 - 修复全局播放器在音乐生成页面不工作的问题
    this.initGlobalPlayerRef()
    
    // 🔧 修复：确保关键变量初始化
    const defaultData = {
      selectionMode: 'multiple', // 保持现有的统一多选模式
      selectedAssessments: [],
      sceneId: null,
      sceneContext: null,
      isFromSceneHistory: false,
      preselectedAssessmentId: null
    };
    
    // 解析入口参数
    if (options.from === 'scene_history' || options.source === 'scene_history') {
      // 🔧 场景历史入口特殊处理
      defaultData.selectionMode = 'scene_history';
      defaultData.isFromSceneHistory = true;
      defaultData.sceneId = options.sceneId ? parseInt(options.sceneId) : null;
      
      if (options.assessmentIds) {
        try {
          defaultData.selectedAssessments = JSON.parse(decodeURIComponent(options.assessmentIds));
          console.log('🎯 场景历史模式，解析到评测IDs:', defaultData.selectedAssessments);
        } catch (e) {
          console.error('❌ 解析assessmentIds失败:', e);
          defaultData.selectedAssessments = [];
        }
      }
    } else if (options.assessmentId) {
      // 单个评测入口
      defaultData.preselectedAssessmentId = parseInt(options.assessmentId);
      console.log('🎯 预选评测ID:', options.assessmentId);
    } else if (options.assessmentIds) {
      // 多评测入口
      try {
        defaultData.selectedAssessments = JSON.parse(decodeURIComponent(options.assessmentIds));
        defaultData.selectionMode = 'multiple';
        console.log('🎯 多评测模式，解析到评测IDs:', defaultData.selectedAssessments);
      } catch (e) {
        console.error('❌ 解析多评测IDs失败:', e);
        // 回退到单个评测处理
        if (options.assessmentId) {
          defaultData.preselectedAssessmentId = parseInt(options.assessmentId);
        }
      }
    }
    
    // 设置初始数据
    this.setData(defaultData);
    
    // 验证必要参数
    this.validateRequiredParams();
    
    // 检查场景上下文
    this.checkSceneContext()
    
    this.initTheme()
    this.initPlayer()
    this.checkUserLogin()
    this.loadRecentAssessments()
    this.loadSubscriptionInfo()
    
    // 🔍 调试信息：验证修复效果
    console.log('🔍 调试信息:', {
      selectionMode: this.data.selectionMode,
      selectedAssessments: this.data.selectedAssessments,
      sceneId: this.data.sceneId,
      isFromSceneHistory: this.data.isFromSceneHistory
    });
  },
  
  /**
   * 初始化全局播放器引用 - 确保全局播放器在当前页面正常工作
   */
  initGlobalPlayerRef() {
    const app = getApp()
    if (app.globalData) {
      // 设置页面引用，供全局播放器组件使用
      app.globalData.currentPageInstance = this
      console.log('✅ 音乐生成页面 - 全局播放器引用已初始化')
    }
  },

  onShow() {
    // 检查场景上下文变化
    this.checkSceneContext()
    
    this.loadRecentAssessments()
    this.refreshSubscriptionStatus()
  },

  /**
   * 检查场景上下文
   */
  checkSceneContext() {
    const context = sceneContextManager.getCurrentContext()
    const isInSceneMode = !!context
    
    // 🔧 修复：统一使用多选模式，避免模式切换导致的参数传递问题
    // 多选1个就是单选，多选多个就是综合生成
    this.setData({
      sceneContext: context,
      isInSceneMode: isInSceneMode,
      selectionMode: 'multiple', // 统一使用多选模式
      sceneHint: context ? `当前在「${context.sceneName}」场景中，可选择多个评测进行综合生成` : '可选择多个评测进行综合生成，或单选一个评测'
    })
    
    console.log('🎯 音乐生成页面场景上下文:', {
      isInSceneMode: this.data.isInSceneMode,
      selectionMode: this.data.selectionMode,
      sceneContext: context
    })
    
    // 如果评测数据已经加载，重新过滤和预选评测
    if (this.data.recentAssessments.length > 0) {
      this.loadRecentAssessments()
    }
  },

  /**
   * 验证必要参数
   */
  validateRequiredParams() {
    const { selectedAssessments, sceneId, isFromSceneHistory } = this.data;
    
    if (isFromSceneHistory && !sceneId) {
      console.error('❌ 场景历史模式缺少sceneId');
      this.showErrorAndReturn('参数错误：缺少场景信息');
      return false;
    }
    
    if (isFromSceneHistory && (!selectedAssessments || selectedAssessments.length === 0)) {
      console.error('❌ 场景历史模式缺少评测数据');
      this.showErrorAndReturn('参数错误：缺少评测数据');
      return false;
    }
    
    console.log('✅ 参数验证通过:', { 
      isFromSceneHistory, 
      sceneId, 
      selectedAssessmentsCount: selectedAssessments ? selectedAssessments.length : 0 
    });
    return true;
  },

  /**
   * 错误提示并返回上一页
   */
  showErrorAndReturn(message) {
    wx.showModal({
      title: '错误',
      content: message,
      showCancel: false,
      success: () => {
        wx.navigateBack({
          delta: 1
        });
      }
    });
  },

  /**
   * 检查用户登录状态
   */
  async checkUserLogin() {
    try {
      const AuthService = require('../../../services/AuthService')
      const userInfo = AuthService.getCurrentUser()
      if (userInfo) {
        this.setData({ userInfo })
      } else {
        // 跳转到登录页面或自动登录
        wx.showToast({
          title: '请先登录',
          icon: 'error'
        })
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }, 2000)
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
    }
  },

  /**
   * 加载最近的评测记录
   */
  async loadRecentAssessments() {
    // 🔧 调试：添加用户信息检查日志
    console.log('🔍 [音乐生成] 开始加载评测记录，用户信息:', this.data.userInfo)
    
    if (!this.data.userInfo) {
      console.warn('⚠️ [音乐生成] 用户信息为空，无法加载评测记录')
      // 🔧 尝试重新获取用户信息
      try {
        const AuthService = require('../../../services/AuthService')
        const userInfo = AuthService.getCurrentUser()
        if (userInfo) {
          console.log('✅ [音乐生成] 重新获取到用户信息:', userInfo)
          this.setData({ userInfo })
        } else {
          console.error('❌ [音乐生成] 仍然无法获取用户信息')
          return
        }
      } catch (error) {
        console.error('❌ [音乐生成] 重新获取用户信息失败:', error)
        return
      }
    }

    this.setData({ loading: true })

    try {
      const result = await AssessmentAPI.getHistory(this.data.userInfo.id)
      
      if (result.success) {
        // 后端已经只返回已完成的评测，无需再次过滤
        let completedAssessments = result.data || []

        // 🔧 修复：过滤掉无效的评测ID（防止传递不存在的评测ID到后端）
        completedAssessments = completedAssessments.filter(item => {
          const isValid = item && item.id && typeof item.id === 'number' && item.id > 0
          if (!isValid) {
            console.warn('⚠️ 发现无效评测记录，已过滤:', item)
          }
          return isValid
        })

        console.log(`🔍 评测ID有效性验证完成，有效记录数: ${completedAssessments.length}`)

        // 🔧 新增：每个量表只保留最新的一条评测记录
        const originalCount = completedAssessments.length
        completedAssessments = this.getLatestAssessmentsByScale(completedAssessments)
        console.log(`🔧 量表去重: ${originalCount} -> ${completedAssessments.length}`)
        
        // 🛡️ 安全检查：如果去重后没有记录，但原来有记录，说明去重逻辑有问题
        if (originalCount > 0 && completedAssessments.length === 0) {
          console.error('❌ 严重错误：去重后所有记录都被过滤掉了，回退到原始数据')
          completedAssessments = result.data || []
          completedAssessments = completedAssessments.filter(item => {
            const isValid = item && item.id && typeof item.id === 'number' && item.id > 0
            return isValid
          })
        }

        // 🔧 修复：增强场景映射过滤的数据验证
        const { sceneContext, isInSceneMode } = this.data
        if (isInSceneMode && sceneContext && sceneContext.sceneId) {
          try {
            // 🔧 修复：添加数据验证，确保所有评测对象都有必要的字段
            const validAssessments = completedAssessments.filter(item => {
              const hasRequiredFields = item && 
                item.scale_name &&
                typeof item === 'object'
              
              if (!hasRequiredFields) {
                console.warn('⚠️ 发现缺少必要字段的评测记录，已跳过场景匹配:', item)
              }
              
              return hasRequiredFields
            })
            
            console.log(`🔍 音乐生成页面数据验证完成:`, {
              原始评测数量: completedAssessments.length,
              有效评测数量: validAssessments.length,
              场景ID: sceneContext.sceneId,
              场景名称: sceneContext.sceneName
            })
            
            const sceneFilterPromises = validAssessments.map(item => 
              sceneMappingService.isScaleMatchingScene(
                item, 
                sceneContext.sceneId, 
                sceneContext.sceneName
              )
            )
            
            const matchResults = await Promise.all(sceneFilterPromises)
            const filteredAssessments = validAssessments.filter((item, index) => matchResults[index])
            
            console.log(`🎯 音乐生成页面场景${sceneContext.sceneName}(ID:${sceneContext.sceneId})评测过滤:`, {
              验证后数量: validAssessments.length,
              场景相关: filteredAssessments.length
            })
            
            completedAssessments = filteredAssessments
            
          } catch (error) {
            console.error('❌ 音乐生成页面场景评测过滤失败，显示所有评测:', error)
            // 过滤失败时保持原始数据
          }
        }

        this.setData({
          recentAssessments: completedAssessments.slice(0, 5) // 最近5条
        })

        // 根据选择模式初始化选择状态
        this.initializeSelectionState(completedAssessments)
        
        console.log(`🎯 音乐生成页面评测记录加载完成:`, {
          模式: this.data.selectionMode,
          总数: completedAssessments.length,
          显示数量: Math.min(completedAssessments.length, 5)
        })
      }
    } catch (error) {
      console.error('加载评测历史失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 选择评测记录
   */
  onSelectAssessment(e) {
    const { assessment } = e.currentTarget.dataset
    
    // 🔧 修复：统一使用多选逻辑，切换选中状态
    this.toggleAssessmentSelection(assessment)
  },

  /**
   * 切换评测记录的选中状态（多选模式）
   */
  toggleAssessmentSelection(assessment) {
    const { selectedAssessments } = this.data
    const isSelected = selectedAssessments.some(item => item.id === assessment.id)
    
    let newSelectedAssessments
    if (isSelected) {
      // 取消选中
      newSelectedAssessments = selectedAssessments.filter(item => item.id !== assessment.id)
      console.log('🎯 多选模式取消选择:', assessment.scale_name)
    } else {
      // 选中
      newSelectedAssessments = [...selectedAssessments, assessment]
      console.log('🎯 多选模式选择评测:', assessment.scale_name)
    }
    
    this.setData({ selectedAssessments: newSelectedAssessments })
    
    // 更新UI状态
    this.updateUIState()
    
    console.log('🎯 多选模式当前选择:', {
      总数: newSelectedAssessments.length,
      量表: newSelectedAssessments.map(item => item.scale_name)
    })
  },

  /**
   * 检查评测是否被选中（用于UI显示）
   */
  isAssessmentSelected(assessment) {
    const { selectedAssessments } = this.data
    
    // 🔧 修复：统一使用多选逻辑
    return selectedAssessments.some(item => item.id === assessment.id)
  },

  /**
   * 初始化评测选择状态
   */
  initializeSelectionState(assessments) {
    const { preselectedAssessmentId } = this.data
    const displayAssessments = assessments.slice(0, 5)
    
    let initialSelections = []
    
    if (preselectedAssessmentId) {
      // 如果有预选评测ID，只选中该评测
      const preselected = displayAssessments.find(item => item.id === preselectedAssessmentId)
      if (preselected) {
        initialSelections = [preselected]
        console.log('🎯 预选评测匹配成功:', preselected.scale_name)
      } else {
        console.log('⚠️ 预选评测不存在，使用默认选择')
        // 如果预选评测不存在，选择第一个
        initialSelections = displayAssessments.length > 0 ? [displayAssessments[0]] : []
      }
    } else {
      // 没有预选评测，默认选择第一个（如果有的话）
      initialSelections = displayAssessments.length > 0 ? [displayAssessments[0]] : []
    }
    
    // 🔧 修复：统一使用多选逻辑
    this.setData({
      selectedAssessments: initialSelections
    })
    
    console.log('🎯 初始化选择评测:', initialSelections.map(item => item.scale_name))
    
    // 更新UI状态
    this.updateUIState()
  },

  /**
   * 检查是否可以生成音乐
   */
  canGenerateMusic() {
    const { selectedAssessments, generating } = this.data
    
    if (generating) return false
    
    // 🔧 修复：统一使用多选逻辑
    return selectedAssessments.length > 0
  },

  /**
   * 更新UI状态（简化WXML表达式）
   */
  updateUIState() {
    // 🔧 修复：添加 selectionMode 变量安全检查
    const selectionMode = this.data.selectionMode || this.selectionMode || 'single';
    const { selectedAssessments, generating, recentAssessments } = this.data
    
    console.log('🔍 updateUIState - selectionMode:', selectionMode);
    
    try {
      // 计算基础状态
      const selectedCount = selectedAssessments.length
      const canGenerate = !generating && selectedCount > 0
      
      // 🔧 修复：统一使用多选逻辑的按钮文案
      let generateButtonText
      let generatingText
      
      if (selectionMode === 'single') {
        // 单选模式UI更新
        generateButtonText = selectedCount > 0 ? '生成音乐' : '选择评测后生成'
        generatingText = '生成中...'
      } else if (selectionMode === 'multiple') {
        // 多选模式UI更新
        if (selectedCount === 1) {
          generateButtonText = '生成音乐 (1个评测)'
          generatingText = '生成中...'
        } else if (selectedCount > 1) {
          generateButtonText = `综合生成音乐 (${selectedCount}个评测)`
          generatingText = '综合生成中...'
        } else {
          generateButtonText = '选择评测后生成'
          generatingText = '生成中...'
        }
      } else if (selectionMode === 'scene_history') {
        // 🔧 新增：场景历史模式UI更新
        generateButtonText = selectedCount > 0 ? '基于历史评测生成音乐' : '选择评测后生成'
        generatingText = '基于历史评测生成中...'
      } else {
        // 默认处理
        console.warn('⚠️ 未知的selectionMode:', selectionMode, '使用默认单选模式');
        generateButtonText = selectedCount > 0 ? '生成音乐' : '选择评测后生成'
        generatingText = '生成中...'
      }
      
      // 给评测记录添加选中状态标记
      const updatedAssessments = recentAssessments.map(item => ({
        ...item,
        isSelected: this.isAssessmentSelected(item)
      }))
      
      // 批量更新状态
      this.setData({
        canGenerate,
        generateButtonText,
        generatingText,
        selectedCount,
        recentAssessments: updatedAssessments
      })
      
      console.log('🎯 UI状态更新:', {
        selectionMode,
        selectedCount,
        canGenerate,
        generateButtonText
      })
      
    } catch (error) {
      console.error('❌ updateUIState 执行失败:', error);
      // 降级处理：使用基础UI状态
      this.setData({
        selectionMode: 'single',
        canGenerate: false,
        generateButtonText: '选择评测后生成',
        generatingText: '生成中...'
      });
    }
  },

  /**
   * 加载订阅信息
   */
  async loadSubscriptionInfo() {
    try {
      const subscriptionInfo = await getSubscriptionInfo()
      this.setData({ 
        subscriptionInfo,
        canUseFeature: subscriptionInfo.is_subscribed
      })
    } catch (error) {
      console.error('加载订阅信息失败:', error)
    }
  },

  /**
   * 刷新订阅状态
   */
  async refreshSubscriptionStatus() {
    try {
      const subscriptionInfo = await getSubscriptionInfo(true) // 强制刷新
      this.setData({ 
        subscriptionInfo,
        canUseFeature: subscriptionInfo.is_subscribed
      })
    } catch (error) {
      console.error('刷新订阅状态失败:', error)
    }
  },

  /**
   * 生成音乐
   */
  async onGenerateMusic() {
    // 🔧 修复：统一使用多选逻辑验证
    const { selectedAssessments } = this.data
    
    if (selectedAssessments.length === 0) {
      wx.showToast({
        title: '请选择评测记录',
        icon: 'error'
      })
      return
    }

    // 检查订阅权限
    const permissionCheck = await requireSubscription('music_generate', {
      modalTitle: 'AI音乐生成',
      modalContent: 'AI音乐生成功能需要订阅后使用，订阅用户可无限次生成个性化音乐。',
      onConfirm: async (action) => {
        if (action === 'trial') {
          // 试用成功后继续生成音乐
          setTimeout(() => {
            this.generateMusicProcess()
          }, 1000)
        } else if (action === 'subscribe') {
          // 用户选择订阅，跳转到订阅页面
          // 订阅成功后用户可以回到这个页面继续操作
        }
      }
    })

    if (!permissionCheck.allowed) {
      return // 用户取消或需要订阅
    }

    // 有权限，继续生成音乐
    await this.generateMusicProcess()
  },

  /**
   * 音乐生成核心流程
   */
  async generateMusicProcess() {
    try {
      // 🔧 修复：确保 selectionMode 存在
      const selectionMode = this.data.selectionMode || 'multiple';
      const { selectedAssessments, sceneId, isFromSceneHistory } = this.data;
      
      console.log('🎵 开始生成音乐:', { selectionMode, selectedAssessments, sceneId });
      
      // 🔍 详细调试信息
      this.logGenerateDebugInfo({ selectionMode, selectedAssessments, sceneId, isFromSceneHistory });
      
      this.setData({ generating: true })
      this.updateUIState()

      let result
      const assessmentIds = selectedAssessments.map(item => item.id)
      
      console.log('🎵 生成音乐，评测IDs:', assessmentIds)
      console.log('🎵 基于量表:', selectedAssessments.map(item => item.scale_name))
      
      // 🔧 验证评测ID的有效性
      const invalidIds = assessmentIds.filter(id => !id || typeof id !== 'number' || id <= 0)
      if (invalidIds.length > 0) {
        throw new Error(`发现无效的评测ID: ${invalidIds.join(', ')}, 请重新选择评测`)
      }
      
      // 构建请求参数
      const generateParams = {
        assessment_id: assessmentIds[0], // 主评测ID
        duration_seconds: 60
      };
      
      // 🔧 确保scene_id传递：无场景时默认为0，避免与业务场景冲突
      generateParams.scene_id = (sceneId != null) ? sceneId : 0;
      
      // 根据模式添加额外参数
      if (selectionMode === 'multiple' || assessmentIds.length > 1) {
        generateParams.assessment_ids = assessmentIds;
        generateParams.generation_mode = 'comprehensive';
      }
      
      if (isFromSceneHistory && sceneId != null) {
        generateParams.scene_context = {
          sceneId: sceneId,
          source: 'history'
        };
      }
      
      // 传递场景上下文（如果存在）
      if (this.data.sceneContext) {
        generateParams.sceneContext = this.data.sceneContext;
        console.log('🎯 传递场景上下文:', this.data.sceneContext);
      }
      
      // 🔧 修复：统一使用多选逻辑处理
      // 当选择1个评测时相当于单选，多个评测时进行综合生成
      if (assessmentIds.length === 1) {
        // 只有一个评测，按单选模式调用API
        console.log('🎵 单个评测生成模式')
        console.log('🔍 单个生成API参数:', { assessmentId: assessmentIds[0], generateParams });
        result = await MusicAPI.generateMusic(assessmentIds[0], generateParams)
        
      } else {
        // 多个评测，按综合生成模式调用API
        console.log('🎵 多评测综合生成模式')
        const comprehensiveParams = {
          mode: 'comprehensive',
          additionalAssessments: assessmentIds.slice(1),
          ...generateParams
        };
        console.log('🔍 综合生成API参数:', { assessmentId: assessmentIds[0], comprehensiveParams });
        result = await MusicAPI.generateMusic(assessmentIds[0], comprehensiveParams)
      }
      
      console.log('🔍 API调用结果:', { success: result?.success, hasData: !!result?.data, error: result?.error });
      
      if (result.success) {
        this.handleGenerateSuccess(result);
      } else {
        this.handleGenerateError(result.error || '生成失败');
      }

    } catch (error) {
      console.error('❌ generateMusicProcess 执行失败:', error);
      
      // 🔧 改善错误信息传递
      let processedError;
      if (typeof error === 'string') {
        processedError = error;
      } else if (error && typeof error === 'object') {
        // 保留完整的错误对象，让 handleGenerateError 进一步处理
        processedError = error;
      } else {
        processedError = '音乐生成过程出错，请重试';
      }
      
      console.log('🔍 传递错误对象:', processedError);
      this.handleGenerateError(processedError);
    } finally {
      this.setData({ generating: false })
      this.updateUIState()
    }
  },

  /**
   * 记录生成音乐的调试信息
   */
  logGenerateDebugInfo(params) {
    console.log('🔍 ============ 音乐生成调试信息 ============');
    console.log('🔍 页面模式:', params.selectionMode);
    console.log('🔍 场景ID:', params.sceneId);
    console.log('🔍 来自场景历史:', params.isFromSceneHistory);
    console.log('🔍 选择的评测数量:', params.selectedAssessments?.length || 0);
    
    if (params.selectedAssessments?.length > 0) {
      params.selectedAssessments.forEach((assessment, index) => {
        console.log(`🔍 评测${index + 1}:`, {
          id: assessment.id,
          scale_name: assessment.scale_name,
          completed_at: assessment.completed_at
        });
      });
    }
    
    console.log('🔍 场景上下文:', this.data.sceneContext);
    console.log('🔍 ========================================');
  },

  /**
   * 处理音乐生成成功
   */
  handleGenerateSuccess(result) {
    this.setData({ musicResult: result.data })
    
    // 🔧 修复：根据选择数量生成成功消息
    const { selectedAssessments, selectionMode } = this.data;
    let successMessage;
    
    if (selectionMode === 'scene_history') {
      successMessage = '基于历史评测的音乐生成成功';
    } else if (selectedAssessments.length === 1) {
      successMessage = '音乐生成成功';
    } else {
      successMessage = `综合${selectedAssessments.length}个评测的音乐生成成功`;
    }
      
    wx.showToast({
      title: successMessage,
      icon: 'success'
    })

    // 跳转到播放页面
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/music/player/player?musicId=${result.data.music_id}&type=60s`
      })
    }, 1500)
  },

  /**
   * 处理音乐生成错误
   */
  handleGenerateError(error) {
    console.error('生成音乐失败:', error)
    
    // 🔧 改善错误处理，提取更详细的错误信息
    let errorMessage = '音乐生成失败，请重试';
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      // 处理不同格式的错误对象
      if (error.error && typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (error.message && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error.data && error.data.error) {
        errorMessage = error.data.error;
      } else if (error.details && error.details.error) {
        errorMessage = error.details.error;
      } else if (error.statusCode) {
        errorMessage = `服务器错误 (${error.statusCode}): ${error.error || '请稍后重试'}`;
      }
    }
    
    console.log('🔍 最终错误消息:', errorMessage);
    
    wx.showModal({
      title: '生成失败',
      content: errorMessage,
      showCancel: true,
      confirmText: '重试',
      success: (res) => {
        if (res.confirm) {
          this.generateMusicProcess() // 重试时调用核心流程方法
        }
      }
    })
  },

  /**
   * 去做评测
   */
  onGoToAssessment() {
    wx.switchTab({
      url: '/pages/assessment/scales/scales'
    })
  },

  /**
   * 获取每个量表的最新评测记录
   * @param {Array} assessments 评测记录数组
   * @returns {Array} 去重后的评测记录数组
   */
  getLatestAssessmentsByScale(assessments) {
    console.log('🔍 去重函数 - 输入数据样本:', assessments.length > 0 ? assessments[0] : '无数据')
    
    const latestAssessmentsByScale = {}
    
    assessments.forEach(item => {
      // 确定性字段获取 - 优先顺序固定
      const scaleName = item.scale_name || item.scaleName  // 使用量表名称作为唯一标识
      const completedAt = item.completed_at || item.completedAt  // 优先使用 completed_at
      
      console.log('🔍 处理评测记录:', {
        id: item.id,
        scale_name: scaleName,
        completed_at: completedAt
      })
      
      if (!scaleName) {
        console.warn('⚠️ 跳过无量表名称的记录:', item)
        return
      }
      
      if (!completedAt) {
        console.warn('⚠️ 跳过无完成时间的记录:', item)
        return
      }
      
      // 使用量表名称作为分组key（确定性）
      const groupKey = scaleName
      const itemDate = new Date(completedAt)
      const existing = latestAssessmentsByScale[groupKey]
      
      if (!existing) {
        latestAssessmentsByScale[groupKey] = item
        console.log('✅ 首次保留:', { 量表: groupKey, 时间: completedAt })
      } else {
        const existingDate = new Date(existing.completed_at || existing.completedAt)
        
        if (itemDate > existingDate) {
          latestAssessmentsByScale[groupKey] = item
          console.log('✅ 更新为最新:', { 
            量表: groupKey, 
            新时间: completedAt, 
            旧时间: existing.completed_at || existing.completedAt
          })
        } else {
          console.log('❌ 跳过旧记录:', { 
            量表: groupKey, 
            时间: completedAt
          })
        }
      }
    })
    
    const result = Object.values(latestAssessmentsByScale)
    console.log('🔧 去重结果 - 每个量表的最新记录:', result.map(item => ({
      id: item.id,
      量表: item.scale_name || item.scaleName,
      时间: item.completed_at || item.completedAt
    })))
    
    return result
  },

  /**
   * 查看音乐库
   */
  onViewMusicLibrary() {
    wx.switchTab({
      url: '/pages/music/library/library'
    })
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
   * 格式化时间
   */
  formatTime(timeString) {
    if (!timeString) return ''
    
    try {
      const date = new Date(timeString)
      const now = new Date()
      const diff = now - date
      
      if (diff < 60000) { // 1分钟内
        return '刚刚'
      } else if (diff < 3600000) { // 1小时内
        return `${Math.floor(diff / 60000)}分钟前`
      } else if (diff < 86400000) { // 1天内
        return `${Math.floor(diff / 3600000)}小时前`
      } else {
        return `${Math.floor(diff / 86400000)}天前`
      }
    } catch (error) {
      return timeString
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadRecentAssessments().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 初始化播放器
   */
  initPlayer() {
    const player = getGlobalPlayer()
    this.setData({ player })

    // 监听播放器事件
    player.on('play', this.onPlayerPlay.bind(this))
    player.on('pause', this.onPlayerPause.bind(this))
    player.on('stop', this.onPlayerStop.bind(this))
  },

  /**
   * 播放器事件处理
   */
  onPlayerPlay(music) {
    if (music) {
      this.setData({
        isPlaying: true
      })
    }
  },

  onPlayerPause() {
    this.setData({
      isPlaying: false
    })
  },

  onPlayerStop() {
    this.setData({
      isPlaying: false
    })
  },

  /**
   * 全局播放器事件处理
   */
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

  onExpandGlobalPlayer() {
    wx.navigateTo({
      url: '/pages/music/player/player'
    })
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: 'AI疗愈 - 个性化音乐生成',
      path: '/pages/music/generate/generate',
      imageUrl: '/images/share-music.png'
    }
  },

  /**
   * 初始化主题
   */
  initTheme() {
    try {
      const app = getApp();
      if (app.globalData && app.globalData.currentTheme) {
        this.setData({
          currentTheme: app.globalData.currentTheme,
          themeClass: app.globalData.themeConfig?.class || '',
          themeConfig: app.globalData.themeConfig
        });
      }
    } catch (error) {
      console.error('初始化主题失败:', error);
    }
  },

  /**
   * 主题切换事件处理
   */
  onThemeChange(e) {
    const { theme, themeConfig } = e.detail;
    console.log('音乐生成页面接收到主题切换:', theme, themeConfig);
    
    this.setData({
      currentTheme: theme,
      themeClass: themeConfig?.class || '',
      themeConfig: themeConfig
    });
    
    // 同步到全局
    const app = getApp();
    if (app.globalData) {
      app.globalData.currentTheme = theme;
      app.globalData.themeConfig = themeConfig;
    }
  }
})
