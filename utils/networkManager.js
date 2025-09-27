/**
 * 网络管理器 - 处理网络异常和重试机制
 */

const config = require('./config')

class NetworkManager {
  constructor() {
    this.isOnline = true
    this.retryQueue = []
    this.maxRetries = 3
    this.retryDelay = 1000 // 1秒
    
    // 监听网络状态变化
    this.initNetworkMonitor()
  }
  
  /**
   * 初始化网络监听
   */
  initNetworkMonitor() {
    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      console.log('网络状态变化:', res)
      this.isOnline = res.isConnected
      
      if (res.isConnected) {
        this.onNetworkReconnected()
      } else {
        this.onNetworkDisconnected()
      }
    })
    
    // 获取初始网络状态
    wx.getNetworkType({
      success: (res) => {
        this.isOnline = res.networkType !== 'none'
        console.log('初始网络状态:', res.networkType)
      }
    })
  }
  
  /**
   * 网络重连时的处理
   */
  onNetworkReconnected() {
    console.log('网络已重连，处理重试队列')
    
    // 显示网络恢复提示
    wx.showToast({
      title: '网络已恢复',
      icon: 'success',
      duration: 2000
    })
    
    // 处理重试队列
    this.processRetryQueue()
  }
  
  /**
   * 网络断开时的处理
   */
  onNetworkDisconnected() {
    console.log('网络已断开')
    
    // 显示网络断开提示
    wx.showToast({
      title: '网络连接已断开',
      icon: 'none',
      duration: 3000
    })
  }
  
  /**
   * 处理重试队列
   */
  processRetryQueue() {
    if (this.retryQueue.length === 0) return
    
    console.log(`处理重试队列，共 ${this.retryQueue.length} 个请求`)
    
    const queue = [...this.retryQueue]
    this.retryQueue = []
    
    queue.forEach(item => {
      setTimeout(() => {
        this.executeRequest(item.options, item.resolve, item.reject, item.retryCount)
      }, Math.random() * 1000) // 随机延迟避免并发
    })
  }
  
  /**
   * 执行网络请求（带重试机制）
   */
  request(options) {
    return new Promise((resolve, reject) => {
      this.executeRequest(options, resolve, reject, 0)
    })
  }
  
  /**
   * 执行具体的网络请求
   */
  executeRequest(options, resolve, reject, retryCount = 0) {
    // 检查网络状态
    if (!this.isOnline) {
      this.addToRetryQueue(options, resolve, reject, retryCount)
      return
    }
    
    // 设置默认超时时间，优先使用请求指定的超时时间
    const timeout = options.timeout || config.getTimeout()
    console.log('请求超时设置:', {
      url: options.url,
      requestTimeout: options.timeout,
      defaultTimeout: config.getTimeout(),
      finalTimeout: timeout
    })
    
    // 🔍 调试：记录请求详情（特别是认证头）
    if (options.url && options.url.includes('create_long_sequence')) {
      console.log('🔍 长序列请求调试信息:', {
        url: options.url,
        method: options.method,
        hasAuthHeader: !!(options.header && options.header.Authorization),
        authHeaderValue: options.header && options.header.Authorization ? 
          options.header.Authorization.substring(0, 30) + '...' : 'none',
        fullHeaders: options.header,
        dataKeys: options.data ? Object.keys(options.data) : 'none'
      })
    }

    // 创建请求
    const requestTask = wx.request({
      ...options,
      timeout, // 使用计算出的超时时间
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res)
        } else {
          // 🔍 调试：记录失败响应详情
          if (options.url && options.url.includes('create_long_sequence')) {
            console.log('🔍 长序列请求失败详情:', {
              statusCode: res.statusCode,
              responseData: res.data,
              responseHeaders: res.header,
              fullResponse: res
            })
            // 特别输出具体的错误信息
            if (res.data) {
              console.log('🔍 服务器返回的具体错误:', JSON.stringify(res.data, null, 2))
            }
          }
          this.handleRequestError(res, options, resolve, reject, retryCount)
        }
      },
      fail: (err) => {
        console.error('网络请求失败:', err)
        this.handleRequestError(err, options, resolve, reject, retryCount)
      }
    })

    // 微信小程序的wx.request已经内置了超时处理，不需要额外的setTimeout
  }
  
  /**
   * 处理请求错误
   */
  handleRequestError(error, options, resolve, reject, retryCount) {
    // 只在第一次失败时记录详细错误，重试时简化日志
    if (retryCount === 0) {
      console.log('网络请求失败:', error)
      console.log('请求详情:', {
        url: options.url,
        method: options.method,
        timeout: options.timeout,
        error: error
      })
    } else {
      console.log(`重试 ${retryCount}/${this.maxRetries} 失败: ${options.url}`)
    }

    // 判断是否需要重试
    if (this.shouldRetry(error, retryCount)) {
      const delay = this.calculateRetryDelay(retryCount)

      if (retryCount === 0) {
        console.log(`${delay}ms 后重试请求`)
      }

      setTimeout(() => {
        this.executeRequest(options, resolve, reject, retryCount + 1)
      }, delay)
    } else {
      // 不再重试，返回错误
      console.log('网络请求最终失败:', options.url)
      const enhancedError = this.enhanceError(error, options)
      reject(enhancedError)
    }
  }
  
  /**
   * 判断是否应该重试
   */
  shouldRetry(error, retryCount) {
    // 超过最大重试次数
    if (retryCount >= this.maxRetries) {
      return false
    }
    
    // 网络错误或超时错误可以重试
    if (error.errMsg && (
      error.errMsg.includes('timeout') ||
      error.errMsg.includes('fail') ||
      error.errMsg.includes('network')
    )) {
      return true
    }
    
    // 5xx 服务器错误可以重试
    if (error.statusCode >= 500) {
      return true
    }
    
    // 408 请求超时可以重试
    if (error.statusCode === 408) {
      return true
    }
    
    return false
  }
  
  /**
   * 计算重试延迟（指数退避）
   */
  calculateRetryDelay(retryCount) {
    return Math.min(this.retryDelay * Math.pow(2, retryCount), 10000) // 最大10秒
  }
  
  /**
   * 添加到重试队列
   */
  addToRetryQueue(options, resolve, reject, retryCount) {
    console.log('添加请求到重试队列')
    
    this.retryQueue.push({
      options,
      resolve,
      reject,
      retryCount
    })
    
    // 显示离线提示
    wx.showToast({
      title: '网络不可用，将在网络恢复后重试',
      icon: 'none',
      duration: 3000
    })
  }
  
  /**
   * 增强错误信息
   */
  enhanceError(error, options) {
    const enhancedError = {
      ...error,
      url: options.url,
      method: options.method || 'GET',
      timestamp: new Date().toISOString()
    }
    
    // 添加用户友好的错误消息
    if (error.errMsg && error.errMsg.includes('timeout')) {
      enhancedError.userMessage = '请求超时，请检查网络连接'
    } else if (error.statusCode === 404) {
      enhancedError.userMessage = '请求的资源不存在'
    } else if (error.statusCode >= 500) {
      enhancedError.userMessage = '服务器暂时不可用，请稍后重试'
    } else if (error.statusCode === 401) {
      enhancedError.userMessage = '登录已过期，请重新登录'
    } else {
      enhancedError.userMessage = '网络请求失败，请稍后重试'
    }
    
    return enhancedError
  }
  
  /**
   * 检查网络连接
   */
  checkNetworkConnection() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          const isConnected = res.networkType !== 'none'
          this.isOnline = isConnected
          resolve(isConnected)
        },
        fail: () => {
          this.isOnline = false
          resolve(false)
        }
      })
    })
  }
  
  /**
   * 获取网络状态信息
   */
  getNetworkInfo() {
    return {
      isOnline: this.isOnline,
      retryQueueLength: this.retryQueue.length,
      maxRetries: this.maxRetries
    }
  }
  
  /**
   * 清空重试队列
   */
  clearRetryQueue() {
    console.log('清空重试队列')
    this.retryQueue = []
  }
}

// 创建全局实例
const networkManager = new NetworkManager()

module.exports = networkManager
