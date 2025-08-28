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
    return get('/assessment/scales')
  },

  /**
   * 获取量表题目
   */
  getQuestions(scaleId) {
    return get(`/assessment/scales/${scaleId}/questions`)
  },

  /**
   * 开始评测
   */
  startAssessment(scaleId, userId) {
    return post('/assessment/start', {
      scale_id: scaleId,
      user_id: userId
    })
  },

  /**
   * 提交答案
   */
  submitAnswer(assessmentId, questionId, answerValue) {
    return post('/assessment/submit_answer', {
      assessment_id: assessmentId,
      question_id: questionId,
      answer_value: answerValue
    })
  },

  /**
   * 完成评测
   */
  completeAssessment(assessmentId) {
    return post('/assessment/complete', {
      assessment_id: assessmentId
    })
  },

  /**
   * 获取评测历史
   */
  getHistory(userId) {
    return get(`/assessment/history/${userId}`)
  },

  /**
   * 获取单个评测结果
   */
  getResult(assessmentId) {
    return get(`/assessment/result/${assessmentId}`)
  },
  
  /**
   * 获取用户最新评测结果（用于推荐）
   */
  getLatestAssessment(userId) {
    return get(`/assessment/history/${userId}`).then(result => {
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
 * 音乐生成API
 */
const MusicAPI = {
  /**
   * 生成60秒音乐片段
   */
  generateMusic(assessmentId) {
    return post('/music/generate', {
      assessment_id: assessmentId
    }, {
      loadingText: '正在生成音乐...',
      timeout: 60000 // 60秒超时
    })
  },

  /**
   * 查询音乐生成状态
   */
  getMusicStatus(musicId) {
    return get(`/music/status/${musicId}`)
  },

  /**
   * 下载音乐文件
   */
  downloadMusic(musicId) {
    return downloadFile(`/music/download/${musicId}`, {
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
    return get(`/music/user_music/${userId}`)
  },

  /**
   * 删除音乐文件
   */
  deleteMusic(musicId) {
    return del(`/music/delete/${musicId}`)
  },

  /**
   * 获取个性化推荐音乐
   */
  getPersonalizedRecommendations(userId) {
    return get(`/music/personalized_recommendations/${userId}`)
  },

  /**
   * 获取音乐分类（新增统一接口）
   */
  getCategories() {
    return get('/music/categories')
  },

  /**
   * 按分类获取七牛云文件（新增统一接口）
   */
  getQiniuFilesByCategory(category) {
    return get(`/music/qiniu/categories/${category}/files`)
  },

  /**
   * 随机获取分类音频（新增统一接口）
   */
  getRandomAudioByCategory(category) {
    return get(`/music/qiniu/random/${category}`)
  },

  /**
   * 批量生成七牛云签名URL（新增统一接口）
   */
  getBatchSignedUrls(fileKeys, expiresIn = 7200) {
    return post('/music/qiniu/batch_signed_urls', {
      file_keys: fileKeys,
      expires_in: expiresIn
    })
  },

  /**
   * 生成单个文件签名URL（统一API路径）
   */
  getQiniuSignedUrl(filePath, expiresIn = 3600) {
    return post('/music/qiniu_signed_url', {
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
   * 创建30分钟长序列音乐
   */
  createLongSequence(assessmentId, durationMinutes = 30) {
    console.log('🎶 发送长序列创建请求:', {
      assessment_id: assessmentId,
      duration_minutes: durationMinutes,
      timestamp: new Date().toISOString()
    })
    
    return post('/music/create_long_sequence', {
      assessment_id: assessmentId,
      duration_minutes: durationMinutes
    }, {
      loadingText: '正在生成长序列音乐...',
      timeout: 120000 // 2分钟超时
    }).then(response => {
      console.log('🎶 长序列创建API原始响应:', response)
      
      // 检查响应的完整性
      if (response.success && response.data) {
        console.log('✅ 长序列创建响应成功')
        console.log('🔍 检查响应数据完整性:')
        console.log('  - session_id:', response.data.session_id)
        console.log('  - status:', response.data.status) 
        console.log('  - final_file_path:', response.data.final_file_path)
        console.log('  - 预计完成时间:', response.data.estimated_completion_time)
        
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
      console.error('❌ 请求参数:', { assessmentId, durationMinutes })
      throw error
    })
  },

  /**
   * 查询长序列状态
   */
  getLongSequenceStatus(sessionId) {
    console.log('🔍 查询长序列状态, sessionId:', sessionId)
    
    return get(`/music/long_sequence_status/${sessionId}`).then(response => {
      console.log('🔍 长序列状态查询响应:', response)
      
      if (response.success && response.data) {
        console.log('✅ 长序列状态查询成功')
        console.log('📊 状态数据详情:')
        console.log('  - 状态:', response.data.status)
        console.log('  - 会话ID:', response.data.session_id) 
        console.log('  - 创建时间:', response.data.created_at)
        console.log('  - 更新时间:', response.data.updated_at)
        console.log('  - 文件路径:', response.data.final_file_path)
        console.log('  - 文件大小:', response.data.final_file_size)
        console.log('  - 错误信息:', response.data.error_message)
        console.log('  - 进度:', response.data.progress_percentage)
        
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
    return downloadFile(`/music/download_long_sequence/${sessionId}`, {
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
    return get(`/music/user_long_sequences/${userId}`)
  },

  /**
   * 检查长序列音频文件是否存在
   */
  checkLongSequenceFile(sessionId) {
    return get(`/music/check_long_sequence_file/${sessionId}`).catch(error => {
      console.warn('检查长序列文件失败:', error)
      // 如果接口不存在，返回假设存在的默认结果
      return { success: true, data: { exists: true } }
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
        url: '/auth/wechat-login',
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
  //       url: '/auth/phone-login',
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
        url: '/auth/account-login',
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
        url: '/auth/validate-token',
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
      url: '/auth/refresh-token',
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
      url: '/auth/logout',
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
      url: '/user/info',
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
      url: '/auth/user/update',
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
  }
}

/**
 * 综合API调用示例
 */
const WorkflowAPI = {
  /**
   * 完整的疗愈流程
   */
  async completeHealingWorkflow(scaleId, answers, userId = 1) {
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
      const musicResult = await MusicAPI.generateMusic(assessmentId)

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
   */
  async generateLongSequenceWorkflow(assessmentId, durationMinutes = 30) {
    try {
      // 创建长序列
      const sessionResult = await LongSequenceAPI.createLongSequence(assessmentId, durationMinutes)
      
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
 * 订阅管理API
 */
const SubscriptionAPI = {
  /**
   * 获取用户订阅信息
   */
  async getSubscriptionInfo() {
    try {
      const response = await request({
        url: '/subscription/info',
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
        url: '/subscription/check-permission',
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
        url: '/subscription/start-trial',
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
        url: '/subscription/subscribe',
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
        url: '/subscription/cancel',
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
        url: '/subscription/plans',
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
      const response = await request({
        url: '/subscription/create-order',
        method: 'POST',
        data: orderData
      })
      return response
    } catch (error) {
      throw new Error(error.message || '创建订单失败')
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
        url: '/subscription/payment/refund',
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
        url: '/devices/whitelist',
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
        url: '/devices/verify',
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
        url: '/devices/bind',
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
        url: '/devices/unbind',
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
        url: '/devices/my-devices',
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
  MusicAPI,
  LongSequenceAPI,
  UserAPI,
  SubscriptionAPI,
  WorkflowAPI,
  DeviceAPI,
  withErrorHandling,
  withRetry
}
