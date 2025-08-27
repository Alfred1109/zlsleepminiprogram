/**
 * AI疗愈系统 API请求封装
 */

const app = getApp()
const { getApiBaseUrl, getTimeout, getRetryCount, isDebug, useMock } = require('./config')
const networkManager = require('./networkManager')
const AuthService = require('../services/AuthService')
const { responseInterceptor, errorInterceptor, standardizeHttpError } = require('./responseFormatter')
const { requiresAuth, isPublicApi } = require('./apiClassifier')

// API基础配置（动态更新）
let API_CONFIG = {
  baseUrl: getApiBaseUrl(),
  timeout: getTimeout(),
  retryCount: getRetryCount()
}

// 强制刷新API配置
function refreshApiConfig() {
  API_CONFIG = {
    baseUrl: getApiBaseUrl(),
    timeout: getTimeout(),
    retryCount: getRetryCount()
  }
  console.log('API配置已刷新:', API_CONFIG)
  return API_CONFIG
}

/**
 * 通用请求方法
 */
function request(options) {
  return new Promise(async (resolve, reject) => {
    const {
      url,
      method = 'GET',
      data = {},
      header = {},
      timeout = API_CONFIG.timeout,
      showLoading = true,
      loadingText = '请求中...'
    } = options

    // 显示加载提示
    if (showLoading) {
      wx.showLoading({
        title: loadingText,
        mask: true
      })
    }

    // 确保使用最新配置
    refreshApiConfig()
    
    // 详细的URL检查和调试
    console.log('🔍 API请求详细调试:', {
      传入的url: url,
      url类型: typeof url,
      url长度: url ? url.length : 'undefined',
      baseUrl: API_CONFIG.baseUrl,
      baseUrl类型: typeof API_CONFIG.baseUrl,
      method: method,
      data: data,
      getApiBaseUrl结果: getApiBaseUrl()
    })

    // 构建完整URL前的检查
    if (!url) {
      console.error('❌ URL参数为空!', {
        url参数: url,
        options对象: options,
        调用栈: new Error().stack
      })
      reject(new Error('请求URL不能为空'))
      return
    }

    if (!API_CONFIG.baseUrl) {
      console.error('❌ baseUrl配置为空!', {
        API_CONFIG: API_CONFIG,
        getApiBaseUrl: getApiBaseUrl()
      })
      reject(new Error('API基础地址配置错误'))
      return
    }

    const fullUrl = url.startsWith('http') ? url : `${API_CONFIG.baseUrl}${url}`
    console.log('✅ 完整请求URL:', fullUrl)

    // 设置请求头
    const requestHeader = {
      'Content-Type': 'application/json',
      ...header
    }

    // 根据API类型决定是否添加认证头
    let finalHeader = requestHeader
    if (requiresAuth(url)) {
      // 只有需要认证的API才添加认证头
      try {
        finalHeader = await AuthService.addAuthHeader(requestHeader)
        console.log('✅ 为认证API添加了认证头:', url)
      } catch (error) {
        console.warn('⚠️ 认证API无法获取认证头:', url, error.message)
        // 认证失败时仍然使用原始header，让后端返回401
        finalHeader = requestHeader
      }
    } else {
      console.log('📖 公开API，无需认证头:', url)
      finalHeader = requestHeader
    }

    // 使用网络管理器发送请求
    networkManager.request({
      url: fullUrl,
      method: method,
      data: data,
      header: finalHeader,
      timeout: timeout
    }).then((res) => {
      if (showLoading) {
        wx.hideLoading()
      }

      // 检查HTTP状态码
      if (res.statusCode >= 200 && res.statusCode < 300) {
          // 使用响应拦截器标准化响应
          const standardResponse = responseInterceptor(res.data, { 
            debug: isDebug(),
            autoFormat: true 
          })
          
          // 检查业务状态码
          if (standardResponse.success) {
            resolve(standardResponse)
          } else {
            const standardError = errorInterceptor(
              new Error(standardResponse.error || '请求失败'), 
              { logErrors: true }
            )
            reject(standardError)
          }
        } else {
          // 检查是否是认证错误
          if (res.statusCode === 401) {
            // 401 统一交给 AuthService 处理退出并重定向
            AuthService.logout()
            wx.showModal({
              title: '请先登录',
              content: '需要登录后才能使用此功能',
              showCancel: true,
              cancelText: '取消',
              confirmText: '去登录',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.navigateTo({ url: '/pages/login/login' })
                }
              }
            })
            reject({
              statusCode: 401,
              error: '需要登录',
              message: '请先登录账户'
            })
            return
          }

          // 使用标准化HTTP错误处理
          const httpError = standardizeHttpError(res.statusCode, res.data?.error || res.data?.message)
          reject(httpError)
        }
      }).catch((err) => {
        if (showLoading) {
          wx.hideLoading()
        }

        console.error('API请求失败:', err)
        console.error('请求详情:', {
          url: fullUrl,
          method: method,
          data: data,
          error: err
        })

        // 使用标准化错误处理
        const networkError = errorInterceptor(err, { 
          logErrors: true,
          showToast: false 
        })
        
        reject(networkError)
      })
  })
}

/**
 * GET请求
 */
function get(url, params = {}, options = {}) {
  // 构建查询字符串
  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
  
  const fullUrl = queryString ? `${url}?${queryString}` : url

  return request({
    url: fullUrl,
    method: 'GET',
    ...options
  })
}

/**
 * POST请求
 */
function post(url, data = {}, options = {}) {
  return request({
    url: url,
    method: 'POST',
    data: data,
    ...options
  })
}

/**
 * PUT请求
 */
function put(url, data = {}, options = {}) {
  return request({
    url: url,
    method: 'PUT',
    data: data,
    ...options
  })
}

/**
 * DELETE请求
 */
function del(url, options = {}) {
  return request({
    url: url,
    method: 'DELETE',
    ...options
  })
}

/**
 * 下载文件
 */
function downloadFile(url, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      showLoading = true,
      loadingText = '下载中...'
    } = options

    if (showLoading) {
      wx.showLoading({
        title: loadingText,
        mask: true
      })
    }

    // 构建完整URL
    if (!url) {
      throw new Error('下载URL不能为空')
    }
    const fullUrl = url.startsWith('http') ? url : `${API_CONFIG.baseUrl}${url}`

    wx.downloadFile({
      url: fullUrl,
      success: (res) => {
        if (showLoading) {
          wx.hideLoading()
        }

        if (res.statusCode === 200) {
          resolve(res)
        } else {
          const error = new Error(`下载失败: ${res.statusCode}`)
          error.statusCode = res.statusCode
          reject(error)
        }
      },
      fail: (err) => {
        if (showLoading) {
          wx.hideLoading()
        }

        const error = new Error(err.errMsg || '下载失败')
        error.originalError = err
        reject(error)
      }
    })
  })
}

/**
 * 错误处理
 */
function handleError(error, showToast = true) {
  console.error('API请求错误:', error)

  let message = '请求失败'

  if (error.code === 'NETWORK_ERROR') {
    message = '网络连接失败，请检查网络设置'
  } else if (error.code === 'HTTP_ERROR') {
    if (error.statusCode === 404) {
      message = '请求的资源不存在'
    } else if (error.statusCode === 500) {
      message = '服务器内部错误'
    } else {
      message = `请求失败 (${error.statusCode})`
    }
  } else if (error.code === 'BUSINESS_ERROR') {
    message = error.message || '业务处理失败'
  } else {
    message = error.message || '未知错误'
  }

  if (showToast) {
    wx.showToast({
      title: message,
      icon: 'error',
      duration: 3000
    })
  }

  return message
}

/**
 * 重试请求
 */
function retryRequest(requestFn, maxRetries = API_CONFIG.retryCount) {
  return new Promise((resolve, reject) => {
    let retryCount = 0

    function attemptRequest() {
      requestFn()
        .then(resolve)
        .catch((error) => {
          retryCount++
          
          if (retryCount < maxRetries && error.code === 'NETWORK_ERROR') {
            console.log(`请求失败，正在重试 (${retryCount}/${maxRetries})`)
            setTimeout(attemptRequest, 1000 * retryCount) // 递增延迟
          } else {
            reject(error)
          }
        })
    }

    attemptRequest()
  })
}

/**
 * 检查网络状态
 */
function checkNetworkStatus() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (res) => {
        const networkType = res.networkType
        const isConnected = networkType !== 'none'
        
        resolve({
          isConnected,
          networkType,
          isWifi: networkType === 'wifi',
          isMobile: ['2g', '3g', '4g', '5g'].includes(networkType)
        })
      },
      fail: () => {
        resolve({
          isConnected: false,
          networkType: 'unknown'
        })
      }
    })
  })
}

/**
 * 设置API基础URL
 */
function setBaseUrl(baseUrl) {
  API_CONFIG.baseUrl = baseUrl
}

/**
 * 获取API基础URL
 */
function getBaseUrl() {
  return API_CONFIG.baseUrl
}

module.exports = {
  request,
  get,
  post,
  put,
  del,
  downloadFile,
  refreshApiConfig,
  handleError,
  retryRequest,
  checkNetworkStatus,
  setBaseUrl,
  getBaseUrl,
  API_CONFIG
}
