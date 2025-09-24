/**
 * AI疗愈系统专用API
 */

const { get, post, del, downloadFile, handleError, request } = require('./api')

/**
 * 心理评测API
 */
const AssessmentAPI = {
  /**
   * 获取评测量表列表
   */
  getScales() {
    return get('/api/assessment/scales')
  },

  /**
   * 获取量表题目
   */
  getQuestions(scaleId) {
    return get(`/api/assessment/scales/${scaleId}/questions`)
  },

  /**
   * 开始评测
   */
  startAssessment(scaleId, userId) {
    return post('/api/assessment/start', {
      scale_id: scaleId,
      user_id: userId
    })
  },

  /**
   * 提交答案
   */
  submitAnswer(assessmentId, questionId, answerValue) {
    return post('/api/assessment/submit_answer', {
      assessment_id: assessmentId,
      question_id: questionId,
      answer_value: answerValue
    })
  },

  /**
   * 完成评测
   */
  completeAssessment(assessmentId) {
    return post('/api/assessment/complete', {
      assessment_id: assessmentId
    })
  },

  /**
   * 获取评测历史
   */
  getHistory(userId) {
    return get(`/api/assessment/history/${userId}`)
  },

  /**
   * 获取单个评测结果
   */
  getResult(assessmentId) {
    return get(`/api/assessment/result/${assessmentId}`)
  },
  
  /**
   * 获取用户最新评测结果（用于推荐）
   */
  getLatestAssessment(userId) {
    return get(`/api/assessment/history/${userId}`).then(result => {
      if (result.success && result.data && result.data.length > 0) {
        // 返回最新的已完成评测
        const latestAssessment = result.data.find(assessment => 
          assessment.status === 'completed'
        );
        return {
          success: true,
          data: latestAssessment
        };
      }
      return {
        success: false,
        data: null
      };
    })
  }
}

/**
 * 场景映射API - 统一接口
 */
const SceneMappingAPI = {
  /**
   * 获取场景映射关系（兼容旧接口）
   * @deprecated 建议使用 getSceneDetail() 获取完整场景信息
   */
  getMappings() {
    // 🔧 更新：优先尝试新接口，回退到旧接口
    return get('/api/scene/mappings').catch(() => {
      console.warn('⚠️ 新接口不可用，使用旧接口')
      return get('/scene/mappings')
    })
  },

  /**
   * 获取场景完整信息（统一接口）
   * @param {string|number} sceneIdentifier - 场景标识符（ID或代码）
   * @param {object} options - 选项
   * @param {string} options.include - 包含的数据类型（'scales', 'music', 'all'）
   * @param {string} options.format - 返回数据格式（'simple', 'full'）
   */
  getSceneDetail(sceneIdentifier, options = {}) {
    const params = new URLSearchParams()
    
    if (options.include) {
      params.append('include', options.include)
    }
    
    if (options.format) {
      params.append('format', options.format)
    }
    
    const queryString = params.toString()
    const url = `/api/scene/${sceneIdentifier}${queryString ? '?' + queryString : ''}`
    
    return get(url)
  },

  /**
   * 根据场景ID获取评测量表类型（废弃接口，请使用getSceneDetail）
   * @deprecated 使用 getSceneDetail(sceneId) 替代
   */
  getScaleTypesByScene(sceneId) {
    console.warn('⚠️ getScaleTypesByScene 接口已废弃，请使用 getSceneDetail() 替代')
    // 转发到新接口
    return this.getSceneDetail(sceneId).then(result => {
      if (result.success && result.data && result.data.assessment_scales) {
        return {
          success: true,
          data: result.data.assessment_scales
        }
      }
      return { success: false, error: '场景不存在或无对应量表' }
    })
  },

  /**
   * 根据场景ID获取音乐类型（废弃接口，请使用getSceneDetail）
   * @deprecated 使用 getSceneDetail(sceneId) 替代
   */
  getMusicTypesByScene(sceneId) {
    console.warn('⚠️ getMusicTypesByScene 接口已废弃，请使用 getSceneDetail() 替代')
    // 转发到新接口
    return this.getSceneDetail(sceneId).then(result => {
      if (result.success && result.data && result.data.music_categories) {
        return {
          success: true,
          data: result.data.music_categories
        }
      }
      return { success: false, error: '场景不存在或无对应音乐分类' }
    })
  }
}

/**
 * 音乐生成API
 */
const MusicAPI = {
  /**
   * 生成60秒音乐片段
   * @param {number} assessmentId - 主评测ID
   * @param {object} options - 可选参数
   * @param {array} options.additionalAssessments - 额外的评测ID数组（多选模式）
   * @param {string} options.mode - 生成模式：'single' | 'comprehensive'
   * @param {object} options.sceneContext - 场景上下文信息
   */
  generateMusic(assessmentId, options = {}) {
    // 🔧 修复：验证主评测ID的有效性
    if (!assessmentId || typeof assessmentId !== 'number' || assessmentId <= 0) {
      console.error('❌ 无效的主评测ID:', assessmentId)
      return Promise.reject(new Error(`无效的评测ID: ${assessmentId}`))
    }

    const requestData = { assessment_id: assessmentId }
    
    // 如果有多选参数，添加综合生成相关字段
    if (options.additionalAssessments && options.additionalAssessments.length > 0) {
      // 🔧 修复：验证额外评测ID的有效性
      const validAdditionalAssessments = options.additionalAssessments.filter(id => {
        const isValid = id && typeof id === 'number' && id > 0
        if (!isValid) {
          console.warn('⚠️ 过滤无效的额外评测ID:', id)
        }
        return isValid
      })

      if (validAdditionalAssessments.length === 0) {
        console.warn('⚠️ 所有额外评测ID都无效，切换到单一生成模式')
        // 如果所有额外评测ID都无效，则切换到单一生成模式
        console.log('🎵 发送单一音乐生成请求（额外ID无效）:', assessmentId)
        return post('/api/music/generate', requestData)
      }

      requestData.assessment_ids = [assessmentId, ...validAdditionalAssessments]
      requestData.generation_mode = options.mode || 'comprehensive'
      
      if (options.sceneContext) {
        requestData.scene_context = options.sceneContext
      }
      
      console.log('🎵 发送综合音乐生成请求:', {
        主评测ID: assessmentId,
        全部评测IDs: requestData.assessment_ids,
        生成模式: requestData.generation_mode,
        场景上下文: requestData.scene_context
      })
    } else {
      console.log('🎵 发送单一音乐生成请求:', assessmentId)
    }
    
    return post('/api/music/generate', requestData, {
      loadingText: options.mode === 'comprehensive' ? '正在综合分析生成音乐...' : '正在生成音乐...',
      timeout: 90000 // 综合生成可能需要更长时间，调整为90秒
    })
  },

  /**
   * 查询音乐生成状态
   */
  getMusicStatus(musicId) {
    return get(`/api/music/status/${musicId}`)
  },

  /**
   * 下载音乐文件
   */
  downloadMusic(musicId) {
    return downloadFile(`/api/music/download/${musicId}`, {
      loadingText: '下载音乐中...'
    })
  },

  /**
   * 获取用户音乐历史
   */
  getUserMusic(userId) {
    // 参数验证
    if (!userId || userId === 'undefined' || userId === 'null') {
      return Promise.reject(new Error('用户ID无效，无法获取音乐数据'))
    }
    return get(`/api/music/user_music/${userId}`)
  },

  /**
   * 删除音乐文件
   */
  deleteMusic(musicId) {
    return del(`/api/music/delete/${musicId}`)
  },

  /**
   * 获取个性化推荐音乐
   */
  getPersonalizedRecommendations(userId) {
    return get(`/api/music/personalized_recommendations/${userId}`).then(response => {
      // 🔍 诊断：检查后端返回的URL是否缺少token
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((music, index) => {
          if (music.url && music.url.includes('cdn.medsleep.cn') && !music.url.includes('token=')) {
            console.error(`❌ 后端API返回的URL缺少token (第${index + 1}个音频):`)
            console.error('  音频ID:', music.id)
            console.error('  问题URL:', music.url)
            console.error('  🎯 根本问题: 后端 /api/music/personalized_recommendations/${userId} 接口返回的URL未经过CDN token签名')
            console.error('  💡 解决方案: 需要后端开发者修复URL生成逻辑，确保返回带token的URL')
          }
        })
      }
      return response
    })
  },

  /**
   * 刷新音频URL（获取最新的CDN访问链接）
   */
  refreshAudioUrl(musicId, originalUrl = null) {
    console.log('🔄 请求刷新音频URL, musicId:', musicId, 'originalUrl:', originalUrl)
    
    // 如果有原始URL，尝试从中提取文件路径
    if (originalUrl && originalUrl.includes('cdn.medsleep.cn')) {
      const urlParts = originalUrl.split('/')
      if (urlParts.length >= 4) {
        const filePath = urlParts.slice(3).join('/') // 修复：正确提取完整路径
        console.log('🔄 从URL提取文件路径:', filePath)
        
        // 使用七牛云签名URL API
        return this.getQiniuSignedUrl(filePath, 7200).then(response => {
          console.log('🔄 七牛云签名URL响应:', response)
          
          if (response.success && response.data && response.data.signed_url) {
            console.log('✅ 签名URL生成成功:', response.data.signed_url)
            return {
              success: true,
              data: {
                url: response.data.signed_url
              }
            }
          } else {
            console.error('❌ 签名URL生成失败:', response.error)
            return response
          }
        }).catch(error => {
          console.error('❌ 签名URL请求失败:', error)
          throw error
        })
      }
    }
    
    // 回退到原来的API（虽然可能不存在）
    console.warn('⚠️ 无法从URL提取文件路径，尝试原API (可能失败)')
    return get(`/api/music/refresh_url/${musicId}`).then(response => {
      console.log('🔄 音频URL刷新响应:', response)
      
      if (response.success && response.data && response.data.url) {
        console.log('✅ 音频URL刷新成功:', response.data.url)
      } else {
        console.error('❌ 音频URL刷新失败:', response.error)
      }
      
      return response
    }).catch(error => {
      console.error('❌ 音频URL刷新请求失败:', error)
      throw error
    })
  },

  /**
   * 获取音乐分类（新增统一接口）
   */
  getCategories() {
    return get('/api/music/categories')
  },

  /**
   * 按分类获取七牛云文件（新增统一接口）
   */
  getQiniuFilesByCategory(category) {
    return get(`/api/music/qiniu/categories/${category}/files`)
  },

  /**
   * 🎯 按分类获取数据库记录的音乐（优先使用）
   */
  getPresetMusicByCategory(categoryId) {
    return get(`/api/preset-music/category/${categoryId}`)
  },

  /**
   * 随机获取分类音频（新增统一接口）
   */
  getRandomAudioByCategory(category) {
    return get(`/api/music/qiniu/random/${category}`)
  },

  /**
   * 批量生成七牛云签名URL（新增统一接口）
   */
  getBatchSignedUrls(fileKeys, expiresIn = 7200) {
    return post('/api/music/qiniu/batch_signed_urls', {
      file_keys: fileKeys,
      expires_in: expiresIn
    })
  },

  /**
   * 生成单个文件签名URL（统一API路径）
   */
  getQiniuSignedUrl(filePath, expiresIn = 3600) {
    return post('/api/music/qiniu_signed_url', {
      file_path: filePath,
      expires_in: expiresIn
    })
  }
}

/**
 * 处理订阅权限响应
 */
function handleSubscriptionResponse(response) {
  if (response.success && response.data && response.data.subscription_required) {
    const data = response.data
    
    wx.showModal({
      title: data.title,
      content: `${data.message}\n\n${data.description}`,
      showCancel: true,
      cancelText: '返回',
      confirmText: data.trial_available ? '免费试用' : '立即订阅',
      success: (modalRes) => {
        if (modalRes.confirm) {
          if (data.trial_available) {
            // 开启试用期
            SubscriptionAPI.startTrial().then(result => {
              if (result.success) {
                wx.showToast({
                  title: '试用期已开启',
                  icon: 'success'
                })
                // 可以重新执行原操作
              }
            }).catch(error => {
              wx.showToast({
                title: '开启试用失败',
                icon: 'error'
              })
            })
          } else {
            // 跳转到订阅页面
            wx.navigateTo({
              url: '/pages/subscription/subscription'
            })
          }
        }
      }
    })
    return true // 表示已处理订阅响应
  }
  return false // 表示不是订阅响应
}

/**
 * 长序列音乐API
 */
const LongSequenceAPI = {
  /**
   * 创建长序列音乐
   * @param {number} assessmentId - 主评测ID
   * @param {number} durationMinutes - 时长（分钟）
   * @param {object} options - 可选参数
   * @param {array} options.additionalAssessments - 额外的评测ID数组（多选模式）
   * @param {string} options.mode - 生成模式：'single' | 'comprehensive'
   * @param {object} options.sceneContext - 场景上下文信息
   */
  createLongSequence(assessmentId, durationMinutes = 30, options = {}) {
    // 🔧 修复：验证主评测ID的有效性
    if (!assessmentId || typeof assessmentId !== 'number' || assessmentId <= 0) {
      console.error('❌ 无效的主评测ID:', assessmentId)
      return Promise.reject(new Error(`无效的评测ID: ${assessmentId}`))
    }

    const requestData = {
      assessment_id: assessmentId,
      duration_minutes: durationMinutes
    }
    
    // 如果有多选参数，添加综合生成相关字段
    if (options.additionalAssessments && options.additionalAssessments.length > 0) {
      // 🔧 修复：验证额外评测ID的有效性
      const validAdditionalAssessments = options.additionalAssessments.filter(id => {
        const isValid = id && typeof id === 'number' && id > 0
        if (!isValid) {
          console.warn('⚠️ 过滤无效的额外评测ID:', id)
        }
        return isValid
      })

      if (validAdditionalAssessments.length === 0) {
        console.warn('⚠️ 所有额外评测ID都无效，切换到单一生成模式')
        // 如果所有额外评测ID都无效，则切换到单一生成模式
        console.log('🎶 发送单一长序列创建请求（额外ID无效）:', assessmentId, durationMinutes)
        return post('/api/music/create_long_sequence', requestData)
      }

      requestData.assessment_ids = [assessmentId, ...validAdditionalAssessments]
      requestData.generation_mode = options.mode || 'comprehensive'
      
      if (options.sceneContext) {
        requestData.scene_context = options.sceneContext
      }
      
      console.log('🎶 发送综合长序列创建请求:', {
        主评测ID: assessmentId,
        时长: durationMinutes,
        全部评测IDs: requestData.assessment_ids,
        生成模式: requestData.generation_mode,
        场景上下文: requestData.scene_context
      })
    } else {
      console.log('🎶 发送单一长序列创建请求:', assessmentId, durationMinutes)
    }
    
    return post('/api/music/create_long_sequence', requestData, {
      loadingText: options.mode === 'comprehensive' ? '正在综合分析生成长序列...' : '正在生成长序列音乐...',
      timeout: 180000 // 综合生成长序列需要更长时间，调整为3分钟
    }).then(response => {
      console.log('🎶 长序列创建API响应 success:', response?.success)
      
      // 检查响应的完整性
      if (response.success && response.data) {
        console.log('✅ 长序列创建响应成功')
        console.log('🔍 响应关键字段:', !!response.data.session_id, response.data.status)
        
        // 验证必要字段
        if (!response.data.session_id) {
          console.error('❌ 响应缺少session_id字段')
        }
      } else {
        console.error('❌ 长序列创建响应异常:', response)
      }
      
      if (handleSubscriptionResponse(response)) {
        // 如果是订阅提示，返回特殊标识
        return { ...response, subscription_handled: true }
      }
      return response
    }).catch(error => {
      console.error('❌ 长序列创建请求失败:', error)
      console.error('❌ 请求参数:', requestData)
      throw error
    })
  },

  /**
   * 查询长序列状态
   */
  getLongSequenceStatus(sessionId) {
    console.log('🔍 查询长序列状态')
    
    return get(`/api/music/long_sequence_status/${sessionId}`).then(response => {
      // 避免打印完整响应对象
      console.log('🔍 长序列状态 success:', response?.success)
      
      if (response.success && response.data) {
        console.log('✅ 长序列状态查询成功')
        // 仅输出关键状态
        console.log('📊 状态:', response.data.status, '进度:', response.data.progress_percentage)
        
        // 🔍 状态异常检测
        if (response.data.status === 'failed') {
          console.error('❌ 长序列生成失败，错误信息:', response.data.error_message)
        } else if (response.data.status === 'completed' && !response.data.final_file_path) {
          console.error('❌ 状态为completed但缺少文件路径!')
        } else if (response.data.status === 'generating') {
          console.log('⏳ 长序列正在生成中，进度:', response.data.progress_percentage || 0, '%')
        }
      } else {
        console.error('❌ 长序列状态查询失败:', response)
      }
      
      if (handleSubscriptionResponse(response)) {
        // 如果是订阅提示，返回特殊标识
        return { ...response, subscription_handled: true }
      }
      return response
    }).catch(error => {
      console.error('❌ 长序列状态查询请求失败:', error)
      console.error('❌ 会话ID:', sessionId)
      throw error
    })
  },

  /**
   * 下载长序列音乐
   */
  downloadLongSequence(sessionId) {
    return downloadFile(`/api/music/download_long_sequence/${sessionId}`, {
      loadingText: '下载长序列音乐中...'
    })
  },

  /**
   * 获取用户长序列历史
   */
  getUserLongSequences(userId) {
    // 参数验证
    if (!userId || userId === 'undefined' || userId === 'null') {
      return Promise.reject(new Error('用户ID无效，无法获取长序列数据'))
    }
    return get(`/api/music/user_long_sequences/${userId}`)
  },

  /**
   * 检查长序列音频文件是否存在
   */
  checkLongSequenceFile(sessionId) {
    return get(`/api/music/check_long_sequence_file/${sessionId}`).catch(error => {
      console.warn('检查长序列文件失败:', error)
      // 如果接口不存在，返回假设存在的默认结果
      return { success: true, data: { exists: true } }
    })
  },

  /**
   * 删除长序列音乐
   */
  deleteLongSequence(sessionId) {
    console.log('🗑️ 发送长序列删除请求, sessionId:', sessionId)
    
    return del(`/api/music/delete_long_sequence/${sessionId}`, {
      loadingText: '正在删除长序列...'
    }).then(response => {
      console.log('🗑️ 长序列删除API响应:', response)
      
      if (response.success) {
        console.log('✅ 长序列删除成功')
      } else {
        console.error('❌ 长序列删除失败:', response.error)
      }
      
      if (handleSubscriptionResponse(response)) {
        return { ...response, subscription_handled: true }
      }
      return response
    }).catch(error => {
      console.error('❌ 长序列删除请求失败:', error)
      console.error('❌ 会话ID:', sessionId)
      throw error
    })
  },

  /**
   * 刷新长序列音频URL（获取最新的CDN访问链接）
   */
  refreshLongSequenceUrl(sessionId) {
    console.log('🔄 请求刷新长序列URL, sessionId:', sessionId)
    
    return get(`/api/music/refresh_long_sequence_url/${sessionId}`).then(response => {
      console.log('🔄 长序列URL刷新响应:', response)
      
      if (response.success && response.data && response.data.final_file_path) {
        console.log('✅ 长序列URL刷新成功:', response.data.final_file_path)
      } else {
        console.error('❌ 长序列URL刷新失败:', response.error)
      }
      
      return response
    }).catch(error => {
      console.error('❌ 长序列URL刷新请求失败:', error)
      throw error
    })
  }
}

/**
 * 用户管理API
 */
const UserAPI = {
  /**
   * 微信登录
   */
  async wechatLogin(data) {
    try {
      const response = await request({
        url: '/api/auth/wechat-login',
        method: 'POST',
        data: data
      })
      return response
    } catch (error) {
      throw new Error(error.message || '微信登录失败')
    }
  },

  // 手机号登录功能暂时禁用 - 需要完善验证码功能
  // /**
  //  * 手机号登录
  //  */
  // async phoneLogin(data) {
  //   try {
  //     const response = await request({
  //       url: '/api/auth/phone-login',
  //       method: 'POST',
  //       data: data
  //     })
  //     return response
  //   } catch (error) {
  //     throw new Error(error.message || '手机号登录失败')
  //   }
  // },

  /**
   * 账号密码登录
   */
  async accountLogin(data) {
    try {
      const response = await request({
        url: '/api/auth/account-login',
        method: 'POST',
        data: data
      })
      return response
    } catch (error) {
      throw new Error(error.message || '账号登录失败')
    }
  },



  /**
   * 验证token
   */
  async validateToken(token) {
    try {
      const response = await request({
        url: '/api/auth/validate-token',
        method: 'POST',
        data: { token }
      })
      return response
    } catch (error) {
      return { success: false, message: 'Token验证失败' }
    }
  },

  /**
   * 刷新token
   */
  async refreshToken(refreshToken) {
    try {
      const response = await request({
      url: '/api/auth/refresh-token',
        method: 'POST',
        data: { refreshToken }
      })
      return response
    } catch (error) {
      throw new Error(error.message || 'Token刷新失败')
    }
  },

  /**
   * 退出登录
   */
  async logout() {
    try {
      const token = wx.getStorageSync('token')
      if (token) {
        await request({
      url: '/api/auth/logout',
          method: 'POST',
          data: { token }
        })
      }

      // 清除本地存储
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('token')

      const app = getApp()
      app.globalData.userInfo = null
      app.globalData.isLoggedIn = false

      return {
        success: true,
        message: '退出成功'
      }
    } catch (error) {
      // 即使后台退出失败，也要清除本地信息
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('token')

      return {
        success: true,
        message: '退出成功'
      }
    }
  },

  /**
   * 获取用户信息
   */
  async getUserInfo() {
    try {
      const response = await request({
      url: '/api/user/profile',
        method: 'GET'
      })
      return response
    } catch (error) {
      throw new Error(error.message || '获取用户信息失败')
    }
  },

  /**
   * 更新用户信息
   */
  async updateUserInfo(data) {
    try {
      const response = await request({
      url: '/api/auth/user/update',
        method: 'PUT',
        data: data
      })
      return response
    } catch (error) {
      throw new Error(error.message || '更新用户信息失败')
    }
  },

  /**
   * 生成设备ID
   */
  generateDeviceId() {
    const deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    wx.setStorageSync('deviceId', deviceId)
    return deviceId
  },

  /**
   * 模拟用户登录（开发测试用）
   */
  async mockLogin(username = 'test_user') {
    try {
      const userInfo = {
        id: 1,
        username: username,
        nickname: '测试用户',
        avatar: '/images/default-avatar.png',
        token: 'mock_token_' + Date.now(),
        tokenExpire: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7天后过期
        permissions: ['user'],
        createdAt: new Date().toISOString()
      }

      // 保存到本地存储（同时保存到两个key以保证兼容性）
      wx.setStorageSync('userInfo', userInfo)    // 兼容旧代码
      wx.setStorageSync('user_info', userInfo)   // tokenManager期望的key
      wx.setStorageSync('token', userInfo.token)

      // 更新全局状态
      const app = getApp()
      app.globalData.userInfo = userInfo
      app.globalData.isLoggedIn = true

      return {
        success: true,
        data: userInfo
      }
    } catch (error) {
      throw new Error('登录失败')
    }
  },

  /**
   * 获取用户信息
   */
  getUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      return Promise.resolve({
        success: true,
        data: userInfo
      })
    } else {
      return Promise.reject(new Error('用户未登录'))
    }
  },

  /**
   * 获取用户下载列表
   */
  async getUserDownloads(params = {}) {
    try {
      // GET /api/downloads/
      const response = await get('/api/downloads/', params)
      return response
    } catch (error) {
      if (error && (error.statusCode === 404 || error.code === 'HTTP_ERROR')) {
        return { success: true, data: [] }
      }
      throw new Error(error.message || '获取下载列表失败')
    }
  },

  // 下载统计 GET /api/downloads/stats
  async getDownloadsStats() {
    try {
      return await get('/api/downloads/stats/')
    } catch (error) {
      return { success: false, error: error.message || '获取下载统计失败' }
    }
  },

  // 生成安全下载链接 GET /api/downloads/url/<music_id>
  async getSecureDownloadUrl(musicId, quality = 'standard') {
    return get(`/api/downloads/url/${musicId}/`, { quality })
  },

  // 删除下载记录 DELETE /api/downloads/<download_id>
  async deleteDownloadRecord(downloadId) {
    return del(`/api/downloads/${downloadId}/`)
  },

  /**
   * 获取用户收藏列表
   */
  async getUserFavorites(params = {}) {
    try {
      // GET /api/favorites/
      const response = await get('/api/favorites/', params)
      return response
    } catch (error) {
      if (error && (error.statusCode === 404 || error.code === 'HTTP_ERROR')) {
        return { success: true, data: [] }
      }
      throw new Error(error.message || '获取收藏列表失败')
    }
  },

  /**
   * 添加到收藏
   */
  async addToFavorites(itemId, itemType = 'music', itemData = {}) {
    try {
      // POST /api/favorites/
      return await post('/api/favorites/', {
        item_id: itemId,
        item_type: itemType,
        item_data: itemData
      })
    } catch (error) {
      throw new Error(error.message || '添加收藏失败')
    }
  },

  /**
   * 从收藏中移除
   */
  async removeFromFavorites(itemIdOrFavoriteId, isItemId = true) {
    try {
      // 优先按项目ID删除 /api/favorites/item/<item_id>
      const url = isItemId ? `/favorites/item/${itemIdOrFavoriteId}/` : `/favorites/${itemIdOrFavoriteId}/`
      return await del(url)
    } catch (error) {
      throw new Error(error.message || '移除收藏失败')
    }
  },

  // 检查是否已收藏 GET /api/favorites/check/<item_id>
  async checkFavorite(itemId) {
    return get(`/api/favorites/check/${itemId}/`)
  },

  // 收藏统计 GET /api/favorites/stats
  async getFavoritesStats() {
    try { return await get('/api/favorites/stats/') } catch (e) { return { success: false, error: e.message } }
  },

  // 批量同步收藏 PUT /api/favorites/sync
  async syncFavorites(payload) {
    return post('/api/favorites/sync/', payload, { method: 'PUT' })
  },

  /**
   * 获取播放历史
   */
  async getPlayHistory() {
    try {
      const response = await request({
        url: '/api/user/play-history',
        method: 'GET'
      })
      return response
    } catch (error) {
      throw new Error(error.message || '获取播放历史失败')
    }
  },

  /**
   * 记录播放历史
   */
  async recordPlayHistory(itemId, itemType = 'music', duration = 0) {
    try {
      const response = await request({
        url: '/api/user/play-history',
        method: 'POST',
        data: {
          item_id: itemId,
          item_type: itemType,
          play_duration: duration
        }
      })
      return response
    } catch (error) {
      console.warn('记录播放历史失败:', error.message)
      // 播放历史记录失败不应该影响用户体验，所以只警告不抛出错误
      return { success: false, error: error.message }
    }
  }
}

/**
 * 综合API调用示例
 */
const WorkflowAPI = {
  /**
   * 完整的疗愈流程
   * @param {number} scaleId - 量表ID
   * @param {array} answers - 答案数组
   * @param {number} userId - 用户ID
   * @param {object} options - 可选参数
   * @param {array} options.additionalAssessments - 额外的评测ID数组（多选模式）
   * @param {string} options.mode - 生成模式：'single' | 'comprehensive'
   * @param {object} options.sceneContext - 场景上下文信息
   */
  async completeHealingWorkflow(scaleId, answers, userId = 1, options = {}) {
    try {
      // 1. 开始评测
      const assessmentResult = await AssessmentAPI.startAssessment(scaleId, userId)
      const assessmentId = assessmentResult.data.assessment_id

      // 2. 提交答案
      for (let i = 0; i < answers.length; i++) {
        await AssessmentAPI.submitAnswer(
          assessmentId,
          answers[i].questionId,
          answers[i].answerValue
        )
      }

      // 3. 完成评测
      const completedAssessment = await AssessmentAPI.completeAssessment(assessmentId)

      // 4. 生成音乐
      const musicResult = await MusicAPI.generateMusic(assessmentId, options)

      return {
        assessment: completedAssessment.data,
        music: musicResult.data
      }
    } catch (error) {
      handleError(error)
      throw error
    }
  },

  /**
   * 生成长序列音乐流程
   * @param {number} assessmentId - 主评测ID
   * @param {number} durationMinutes - 时长（分钟）
   * @param {object} options - 可选参数
   * @param {array} options.additionalAssessments - 额外的评测ID数组（多选模式）
   * @param {string} options.mode - 生成模式：'single' | 'comprehensive'
   * @param {object} options.sceneContext - 场景上下文信息
   */
  async generateLongSequenceWorkflow(assessmentId, durationMinutes = 30, options = {}) {
    try {
      // 创建长序列
      const sessionResult = await LongSequenceAPI.createLongSequence(assessmentId, durationMinutes, options)
      
      return sessionResult.data
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

/**
 * 错误处理包装器
 */
function withErrorHandling(apiFunction) {
  return async (...args) => {
    try {
      return await apiFunction(...args)
    } catch (error) {
      handleError(error)
      throw error
    }
  }
}

/**
 * 带重试的API调用
 */
function withRetry(apiFunction, maxRetries = 3) {
  return async (...args) => {
    let lastError
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await apiFunction(...args)
      } catch (error) {
        lastError = error
        
        // 如果是网络错误，等待后重试
        if (error.code === 'NETWORK_ERROR' && i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
          continue
        }
        
        // 其他错误直接抛出
        throw error
      }
    }
    
    throw lastError
  }
}

/**
 * 次数套餐API
 */
const CountPackageAPI = {
  /**
   * 获取次数套餐列表
   */
  async getPlans() {
    try {
      const response = await request({
        url: '/api/count-package/plans',
        method: 'GET'
      })
      return response
    } catch (error) {
      throw new Error(error.message || '获取次数套餐失败')
    }
  },

  /**
   * 创建次数套餐订单
   */
  async createOrder(orderData) {
    try {
      console.log('🔍 开始创建次数套餐订单，参数验证:')
      console.log('  - 参数完整性:', !!orderData)
      console.log('  - plan_id:', orderData?.plan_id, typeof orderData?.plan_id)
      console.log('  - user_id:', orderData?.user_id, typeof orderData?.user_id)
      console.log('  - payment_config:', !!orderData?.payment_config)
      
      // 参数验证
      if (!orderData) {
        throw new Error('订单数据为空')
      }
      if (!orderData.plan_id) {
        throw new Error('套餐ID为空')
      }
      if (!orderData.payment_config || !orderData.payment_config.api_key) {
        throw new Error('支付配置不完整')
      }
      
      const response = await request({
        url: '/api/count-package/create-order',
        method: 'POST',
        data: orderData,
        timeout: 20000
      })
      
      console.log('✅ 次数套餐订单创建API调用成功')
      return response
      
    } catch (error) {
      console.error('❌ 创建次数套餐订单失败:', {
        errorMessage: error.message,
        statusCode: error.statusCode,
        errorDetails: error
      })
      
      // 根据不同的错误类型提供更具体的错误信息
      if (error.statusCode === 500) {
        throw new Error(`服务器内部错误 (${error.statusCode}): 可能是参数格式问题或后端服务异常，请检查订单参数或稍后重试`)
      } else if (error.statusCode === 400) {
        throw new Error(`请求参数错误 (${error.statusCode}): ${error.message || '订单参数格式不正确'}`)
      } else if (error.statusCode === 401) {
        throw new Error(`认证失败 (${error.statusCode}): 请重新登录后再试`)
      } else if (error.statusCode === 403) {
        throw new Error(`访问被拒绝 (${error.statusCode}): 可能是支付配置问题`)
      } else {
        throw new Error(error.message || '创建次数套餐订单失败')
      }
    }
  },

  /**
   * 兑换优惠券
   */
  async redeemCoupon(couponCode) {
    try {
      const response = await request({
        url: '/api/count-package/coupon/redeem',
        method: 'POST',
        data: { code: couponCode }
      })
      return response
    } catch (error) {
      throw new Error(error.message || '优惠券兑换失败')
    }
  },

  /**
   * 获取用户次数信息
   */
  async getUserCounts() {
    try {
      const response = await request({
        url: '/api/count-package/user-counts',
        method: 'GET'
      })
      return response
    } catch (error) {
      throw new Error(error.message || '获取次数信息失败')
    }
  }
}

/**
 * 订阅管理API
 */
const SubscriptionAPI = {
  /**
   * 获取用户订阅信息
   */
  async getSubscriptionInfo() {
    try {
      const response = await request({
        url: '/api/subscription/info',
        method: 'GET'
      })
      return response
    } catch (error) {
      throw new Error(error.message || '获取订阅信息失败')
    }
  },

  /**
   * 检查功能权限
   */
  async checkPermission(feature) {
    try {
      const response = await request({
        url: '/api/subscription/check-permission',
        method: 'POST',
        data: { feature }
      })
      return response
    } catch (error) {
      throw new Error(error.message || '检查权限失败')
    }
  },

  /**
   * 开始免费试用
   */
  async startTrial() {
    try {
      const response = await request({
        url: '/api/subscription/start-trial',
        method: 'POST'
      })
      return response
    } catch (error) {
      console.error('开始试用失败:', error)
      throw error
    }
  },

  /**
   * 订阅服务
   */
  async subscribe(subscriptionData) {
    try {
      const response = await request({
        url: '/api/subscription/subscribe',
        method: 'POST',
        data: subscriptionData
      })
      return response
    } catch (error) {
      throw new Error(error.message || '订阅失败')
    }
  },

  /**
   * 取消订阅
   */
  async cancelSubscription() {
    try {
      const response = await request({
        url: '/api/subscription/cancel',
        method: 'POST'
      })
      return response
    } catch (error) {
      throw new Error(error.message || '取消订阅失败')
    }
  },

  /**
   * 获取订阅套餐列表
   */
  async getPlans() {
    try {
      const response = await request({
        url: '/api/subscription/plans',
        method: 'GET'
      })
      return response
    } catch (error) {
      throw new Error(error.message || '获取套餐信息失败')
    }
  },

  /**
   * 创建订阅订单
   */
  async createOrder(orderData) {
    try {
      console.log('🔍 开始创建订阅订单，参数验证:')
      console.log('  - 参数完整性:', !!orderData)
      console.log('  - plan_id:', orderData?.plan_id, typeof orderData?.plan_id)
      console.log('  - user_id:', orderData?.user_id, typeof orderData?.user_id)
      console.log('  - payment_config:', !!orderData?.payment_config)
      console.log('  - api_key存在:', !!orderData?.payment_config?.api_key)
      
      // 参数验证
      if (!orderData) {
        throw new Error('订单数据为空')
      }
      if (!orderData.plan_id) {
        throw new Error('套餐ID为空')
      }
      if (!orderData.payment_config || !orderData.payment_config.api_key) {
        throw new Error('支付配置不完整')
      }
      
      const response = await request({
        url: '/api/subscription/create-order',
        method: 'POST',
        data: orderData,
        timeout: 20000 // 增加超时时间，因为订单创建可能需要更长时间
      })
      
      console.log('✅ 订单创建API调用成功')
      return response
      
    } catch (error) {
      console.error('❌ 创建订阅订单失败:', {
        errorMessage: error.message,
        statusCode: error.statusCode,
        errorDetails: error
      })
      
      // 根据不同的错误类型提供更具体的错误信息
      if (error.statusCode === 500) {
        throw new Error(`服务器内部错误 (${error.statusCode}): 可能是参数格式问题或后端服务异常，请检查订单参数或稍后重试`)
      } else if (error.statusCode === 400) {
        throw new Error(`请求参数错误 (${error.statusCode}): ${error.message || '订单参数格式不正确'}`)
      } else if (error.statusCode === 401) {
        throw new Error(`认证失败 (${error.statusCode}): 请重新登录后再试`)
      } else if (error.statusCode === 403) {
        throw new Error(`访问被拒绝 (${error.statusCode}): 可能是支付配置问题`)
      } else {
        throw new Error(error.message || '创建订单失败')
      }
    }
  },

  /**
   * 查询订单支付状态
   */
  async queryOrder(orderNo) {
    try {
      const response = await request({
        url: `/subscription/payment/query-order/${orderNo}`,
        method: 'GET'
      })
      return response
    } catch (error) {
      throw new Error(error.message || '查询订单失败')
    }
  },

  /**
   * 申请退款
   */
  async requestRefund(refundData) {
    try {
      const response = await request({
        url: '/api/subscription/payment/refund',
        method: 'POST',
        data: refundData
      })
      return response
    } catch (error) {
      throw new Error(error.message || '申请退款失败')
    }
  }
}

// 设备白名单API
class DeviceAPI {
  /**
   * 获取设备白名单
   */
  static async getWhitelist() {
    try {
      const response = await request({
        url: '/api/devices/whitelist',
        method: 'GET',
        timeout: 15000, // 增加到15秒超时
        showLoading: false // 不显示加载提示
      })
      return response
    } catch (error) {
      console.warn('获取设备白名单失败，返回空白名单:', error.message)
      // 返回空白名单而不是抛出错误，让调用者能够优雅降级
      return {
        success: false,
        data: [],
        total: 0,
        error: error.message || '获取设备白名单失败'
      }
    }
  }
  
  /**
   * 验证设备是否在白名单中
   */
  static async verifyDevice(data) {
    try {
      const response = await request({
        url: '/api/devices/verify',
        method: 'POST',
        data: data,
        timeout: 3000, // 3秒超时
        showLoading: false // 不显示加载提示
      })
      return response
    } catch (error) {
      console.warn('设备验证失败，返回拒绝状态:', error.message)
      // 返回验证失败的结果而不是抛出错误
      return {
        success: false,
        data: {
          is_whitelisted: false,
          can_bind: false,
          reason: 'api_unavailable',
          message: '设备验证服务不可用'
        },
        error: error.message || '验证设备失败'
      }
    }
  }
  
  /**
   * 绑定设备
   */
  static async bindDevice(data) {
    try {
      const response = await request({
        url: '/api/devices/bind',
        method: 'POST',
        data: data,
        timeout: 15000, // 15秒超时
        showLoading: false // 不显示加载提示
      })
      return response
    } catch (error) {
      console.warn('设备绑定失败，但不影响连接:', error.message)
      // 返回绑定失败的结果，但不影响设备连接
      return {
        success: false,
        data: null,
        error: error.message || '绑定设备失败'
      }
    }
  }
  
  /**
   * 解绑设备
   */
  static async unbindDevice(data) {
    try {
      const response = await request({
        url: '/api/devices/unbind',
        method: 'POST',
        data: data
      })
      return response
    } catch (error) {
      throw new Error(error.message || '解绑设备失败')
    }
  }
  
  /**
   * 获取用户绑定的设备列表
   */
  static async getMyDevices() {
    try {
      const response = await request({
        url: '/api/devices/my-devices',
        method: 'GET'
      })
      return response
    } catch (error) {
      throw new Error(error.message || '获取设备列表失败')
    }
  }
}

module.exports = {
  AssessmentAPI,
  SceneMappingAPI,
  MusicAPI,
  LongSequenceAPI,
  UserAPI,
  CountPackageAPI,
  SubscriptionAPI,
  WorkflowAPI,
  DeviceAPI,
  withErrorHandling,
  withRetry
}
