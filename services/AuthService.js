// AuthService.js
// 精简统一认证服务
// -------------------------------------------
// 整合 tokenManager 核心功能，去除不必要的代理层
// -------------------------------------------

const EventEmitter = require('../utils/eventEmitter')

class AuthService {
  constructor() {
    this.emitter = EventEmitter
    this.isRefreshing = false
    this.refreshCallbacks = []
    
    // 存储键名
    this.keys = {
      token: 'access_token',
      refreshToken: 'refresh_token', 
      tokenExpires: 'token_expires',
      refreshExpires: 'refresh_expires',
      userInfo: 'user_info'
    }
    
    // 自动刷新配置
    this.refreshThreshold = 5 * 60 * 1000 // 5分钟提前刷新
  }

  /* === 基础 Token 操作 === */
  
  getAccessToken() {
    try {
      return wx.getStorageSync(this.keys.token) || null
    } catch (error) {
      console.error('获取token失败:', error)
      return null
    }
  }

  setAccessToken(token) {
    try {
      wx.setStorageSync(this.keys.token, token)
    } catch (error) {
      console.error('保存token失败:', error)
    }
  }

  getRefreshToken() {
    try {
      return wx.getStorageSync(this.keys.refreshToken) || null
    } catch (error) {
      console.error('获取refresh token失败:', error)
      return null
    }
  }

  setRefreshToken(token) {
    try {
      wx.setStorageSync(this.keys.refreshToken, token)
    } catch (error) {
      console.error('保存refresh token失败:', error)
    }
  }

  getCurrentUser() {
    try {
      return wx.getStorageSync(this.keys.userInfo) || null
    } catch (error) {
      console.error('获取用户信息失败:', error)
      return null
    }
  }

  setCurrentUser(userInfo) {
    try {
      wx.setStorageSync(this.keys.userInfo, userInfo)
    } catch (error) {
      console.error('保存用户信息失败:', error)
    }
  }

  /* === 高级认证操作 === */

  // 检查是否已登录
  isLoggedIn() {
    const user = this.getCurrentUser()
    const token = this.getAccessToken()
    return !!(user && token && !this.isTokenExpired(token))
  }

  // 检查token是否过期
  isTokenExpired(token) {
    if (!token) return true
    
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return true
      
      const payload = JSON.parse(this.base64Decode(parts[1]))
      const exp = payload.exp * 1000 // JWT使用秒，转为毫秒
      return Date.now() >= exp
    } catch (error) {
      console.error('检查token过期失败:', error)
      return true
    }
  }

  // Base64解码
  base64Decode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
    let result = ''
    let i = 0
    
    str = str.replace(/[^A-Za-z0-9+/]/g, '')
    while (str.length % 4) {
      str += '='
    }
    
    while (i < str.length) {
      const encoded1 = chars.indexOf(str.charAt(i++))
      const encoded2 = chars.indexOf(str.charAt(i++))
      const encoded3 = chars.indexOf(str.charAt(i++))
      const encoded4 = chars.indexOf(str.charAt(i++))
      
      const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4
      
      result += String.fromCharCode((bitmap >> 16) & 255)
      if (encoded3 !== 64) result += String.fromCharCode((bitmap >> 8) & 255)
      if (encoded4 !== 64) result += String.fromCharCode(bitmap & 255)
    }
    
    return result
  }

  // 刷新访问token
  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      throw new Error('没有刷新token')
    }

    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.refreshCallbacks.push({ resolve, reject })
      })
    }

    this.isRefreshing = true

    try {
      const response = await new Promise((resolve, reject) => {
        // 确保获取正确的API基础URL
        const app = getApp()
        let apiBaseUrl = app.globalData.apiBaseUrl
        
        if (!apiBaseUrl) {
          try {
            const { getApiBaseUrl } = require('../utils/config')
            apiBaseUrl = getApiBaseUrl()
          } catch (error) {
            console.error('获取API基础URL失败:', error)
            apiBaseUrl = 'https://medsleep.cn/api'
          }
        }
        
        wx.request({
          url: `${apiBaseUrl}/auth/refresh-token`,
          method: 'POST',
          data: { refresh_token: refreshToken },
          header: { 'Content-Type': 'application/json' },
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data)
            } else {
              reject(new Error(`刷新失败: ${res.data?.message || 'HTTP ' + res.statusCode}`))
            }
          },
          fail: reject
        })
      })

      if (response?.success) {
        const { access_token, access_expires } = response.data
        this.setAccessToken(access_token)
        if (access_expires) {
          wx.setStorageSync(this.keys.tokenExpires, access_expires)
        }
        
        // 通知等待的回调
        this.refreshCallbacks.forEach(callback => callback.resolve(access_token))
        this.refreshCallbacks = []
        
        return access_token
      } else {
        throw new Error(response?.message || 'Token刷新失败')
      }
    } catch (error) {
      // 刷新失败，清理所有token
      this.clearTokens()
      this.refreshCallbacks.forEach(callback => callback.reject(error))
      this.refreshCallbacks = []
      throw error
    } finally {
      this.isRefreshing = false
    }
  }

  // 账号密码登录
  async accountLogin(username, password) {
    try {
      if (!username || !password) {
        throw new Error('用户名和密码不能为空')
      }

      const response = await new Promise((resolve, reject) => {
        // 确保获取正确的API基础URL
        const app = getApp()
        let apiBaseUrl = app.globalData.apiBaseUrl
        
        if (!apiBaseUrl) {
          try {
            const { getApiBaseUrl } = require('../utils/config')
            apiBaseUrl = getApiBaseUrl()
          } catch (error) {
            console.error('获取API基础URL失败:', error)
            apiBaseUrl = 'https://medsleep.cn/api'
          }
        }
        
        console.log('账号登录请求详情:', {
          url: `${apiBaseUrl}/auth/account-login`,
          method: 'POST',
          data: { username, password: '***' },
          header: { 'Content-Type': 'application/json' }
        })
        
        wx.request({
          url: `${apiBaseUrl}/auth/account-login`,
          method: 'POST',
          data: { username, password },
          header: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          success: (res) => {
            console.log('账号登录响应详情:', {
              statusCode: res.statusCode,
              data: res.data,
              dataType: typeof res.data,
              dataLength: res.data ? JSON.stringify(res.data).length : 0,
              headers: res.header,
              rawResponse: res
            })
            if (res.statusCode === 200) {
              resolve(res.data)
            } else {
              reject(new Error(`账号登录失败: ${res.data?.message || 'HTTP ' + res.statusCode}`))
            }
          },
          fail: (err) => {
            console.error('账号登录请求失败:', err)
            reject(err)
          }
        })
      })

      if (response?.success) {
        const { access_token, refresh_token, access_expires, refresh_expires, user } = response.data
        
        this.setAccessToken(access_token)
        this.setRefreshToken(refresh_token)
        this.setCurrentUser(user)
        
        if (access_expires) {
          wx.setStorageSync(this.keys.tokenExpires, access_expires)
        }
        if (refresh_expires) {
          wx.setStorageSync(this.keys.refreshExpires, refresh_expires)
        }

        console.log('账号登录成功，返回数据:', response)
        this.emitter.emit('auth:changed', { status: 'logged_in', user })
        return response // 返回完整的响应对象，包含success字段
      } else {
        throw new Error(response?.message || '账号登录失败')
      }
    } catch (error) {
      console.error('账号登录失败:', error)
      throw error
    }
  }



  // 确保有有效token（自动刷新或要求登录）
  async ensureValidToken() {
    console.log('🔍 检查token有效性...')
    let token = this.getAccessToken()

    // 没有token，抛出错误要求用户登录
    if (!token) {
      console.log('❌ 没有找到access token')
      throw new Error('用户未登录，请先登录')
    }
    
    console.log('🔍 检查token是否过期...')
    // token过期，尝试刷新
    if (this.isTokenExpired(token)) {
      console.log('⏰ Token已过期，尝试刷新...')
      try {
        token = await this.refreshAccessToken()
        console.log('✅ Token刷新成功')
      } catch (error) {
        console.log('❌ Token刷新失败:', error.message)
        // 刷新失败，清除用户信息并要求重新登录
        this.clearTokens()
        throw new Error('登录已过期，请重新登录')
      }
    } else {
      console.log('✅ Token有效，无需刷新')
    }

    return token
  }

  // 为请求添加认证头
  async addAuthHeader(headers = {}) {
    try {
      console.log('🔍 开始添加认证头...')
      const token = await this.ensureValidToken()
      console.log('🔍 获取到token:', {
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        tokenPrefix: token ? token.substring(0, 10) + '...' : 'none'
      })
      
      // 临时调试：输出完整token用于服务器端测试
      if (token && token.length > 50) {
        console.log('🔍 完整token（用于调试）:', token)
      }
      
      if (token) {
        const authHeaders = { ...headers, Authorization: `Bearer ${token}` }
        console.log('✅ 认证头添加成功')
        return authHeaders
      }
      
      console.warn('⚠️ 没有可用的token，使用原始headers')
      return headers
    } catch (error) {
      console.error('❌ 添加认证头失败:', error.message, error)
      throw error // 让调用者决定如何处理
    }
  }

  // 清理所有认证信息
  clearTokens() {
    try {
      wx.removeStorageSync(this.keys.token)
      wx.removeStorageSync(this.keys.refreshToken)
      wx.removeStorageSync(this.keys.tokenExpires)
      wx.removeStorageSync(this.keys.refreshExpires)
      wx.removeStorageSync(this.keys.userInfo)
    } catch (error) {
      console.error('清理token失败:', error)
    }
  }

  // 登出
  async logout() {
    this.clearTokens()
    this.emitter.emit('auth:changed', { status: 'logged_out' })
  }

  // 微信登录（仅完成基础登录，不获取用户信息）
  async wechatLogin() {
    try {
      console.log('开始微信登录流程...')
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject })
      })

      if (!loginRes.code) {
        throw new Error('获取登录凭证失败')
      }

      console.log('使用基础微信登录，不请求用户信息')

      // 准备API请求负载（仅包含code）
      const payload = { code: loginRes.code }

      // 调用后端微信登录接口
      const response = await new Promise((resolve, reject) => {
        // 确保获取正确的API基础URL
        const app = getApp()
        let apiBaseUrl = app.globalData.apiBaseUrl
        
        // 如果全局API URL为空，使用配置文件的方法获取
        if (!apiBaseUrl) {
          try {
            const { getApiBaseUrl } = require('../utils/config')
            apiBaseUrl = getApiBaseUrl()
            console.log('微信登录：使用配置文件API地址:', apiBaseUrl)
          } catch (error) {
            console.error('获取API基础URL失败:', error)
            apiBaseUrl = 'https://medsleep.cn/api' // 兜底配置
          }
        }
        
        const fullUrl = `${apiBaseUrl}/auth/wechat-login`
        console.log('微信登录API完整URL:', fullUrl)
        
        wx.request({
          url: fullUrl,
          method: 'POST',
          data: payload,
          header: { 'Content-Type': 'application/json' },
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data)
            } else {
              reject(new Error(`微信登录失败: ${res.data?.message || 'HTTP ' + res.statusCode}`))
            }
          },
          fail: reject
        })
      })

      if (response?.success) {
        console.log('微信登录成功')
        this.saveAuthResponse(response)
        
        console.log('基础登录完成，如需用户信息请在个人中心授权')
        
        return response
      } else {
        throw new Error(response?.error || '微信登录失败')
      }
    } catch (error) {
      console.error('微信登录失败:', error)
      throw error
    }
  }

  // 保存登录响应（微信登录、账号登录等使用）
  saveAuthResponse(response) {
    try {
      const data = response.data || response
      
      if (data.access_token) {
        this.setAccessToken(data.access_token)
      }
      if (data.refresh_token) {
        this.setRefreshToken(data.refresh_token)
      }
      if (data.access_expires) {
        wx.setStorageSync(this.keys.tokenExpires, data.access_expires)
      }
      if (data.refresh_expires) {
        wx.setStorageSync(this.keys.refreshExpires, data.refresh_expires)
      }
      if (data.user) {
        this.setCurrentUser(data.user)
      }
      
      const user = data.user || this.getCurrentUser()
      if (user) {
        this.emitter.emit('auth:changed', { status: 'logged_in', user })
      }
    } catch (error) {
      console.error('保存认证响应失败:', error)
      throw error
    }
  }

  /* === 事件系统 === */
  
  on(event, listener) {
    this.emitter.on(event, listener)
  }

  off(event, listener) {
    this.emitter.off(event, listener)
  }

  // 单独的用户信息授权方法（仅在用户主动点击时调用）
  async requestUserProfile() {
    try {
      const profile = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: resolve,
          fail: reject
        })
      })
      
      if (profile && profile.userInfo) {
        console.log('用户授权成功，获取到用户信息')
        // 可以在这里更新用户信息到后端
        return { success: true, userInfo: profile.userInfo }
      }
    } catch (e) {
      console.log('用户拒绝授权:', e.errMsg)
      return { success: false, error: '用户拒绝授权' }
    }
  }
}

// 导出单例
module.exports = new AuthService()
