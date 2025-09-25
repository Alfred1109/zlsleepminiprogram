/**
 * 订阅权限管理工具
 * 处理用户订阅状态检查和权限控制
 */

const { SubscriptionAPI } = require('./healingApi')

/**
 * 缓存订阅信息，避免重复请求
 */
let subscriptionCache = {
  data: null,
  timestamp: 0,
  expiry: 5 * 60 * 1000 // 5分钟缓存
}

/**
 * 获取用户订阅信息（带缓存）
 */
async function getSubscriptionInfo(forceRefresh = false) {
  try {
    const now = Date.now()
    
    // 如果缓存有效且不强制刷新，返回缓存数据
    if (!forceRefresh && 
        subscriptionCache.data && 
        (now - subscriptionCache.timestamp) < subscriptionCache.expiry) {
      return subscriptionCache.data
    }
    
    // 从API获取最新数据
    const result = await SubscriptionAPI.getSubscriptionInfo()
    if (result.success) {
      subscriptionCache = {
        data: result.data,
        timestamp: now,
        expiry: subscriptionCache.expiry
      }
      return result.data
    }
    
    throw new Error(result.error || '获取订阅信息失败')
    
  } catch (error) {
    console.error('获取订阅信息失败:', error)
    
    // 检查是否是认证错误
    const AuthService = require('../services/AuthService')
    const isLoggedIn = AuthService.isLoggedIn()
    
    console.log('🔍 获取订阅信息失败，检查认证状态:', {
      isLoggedIn,
      errorType: error.statusCode,
      errorMessage: error.message || error.error
    })
    
    // 如果有缓存数据，返回缓存的
    if (subscriptionCache.data) {
      console.warn('使用缓存的订阅信息')
      return subscriptionCache.data
    }
    
    // 如果是认证问题，返回需要登录状态
    if (!isLoggedIn || error.statusCode === 401) {
      return {
        type: 'free',
        status: 'inactive',
        is_subscribed: false,
        trial_available: false,
        requires_login: true,
        error: '需要登录'
      }
    }
    
    // 其他错误，返回默认的未订阅状态
    return {
      type: 'free',
      status: 'inactive',
      is_subscribed: false,
      trial_available: false,
      error: '获取状态失败'
    }
  }
}

/**
 * 检查用户是否有特定功能的权限
 */
async function checkFeaturePermission(feature) {
  try {
    const result = await SubscriptionAPI.checkPermission(feature)
    if (result.success) {
      return result.data
    }
    throw new Error(result.error || '权限检查失败')
    
  } catch (error) {
    console.error('权限检查失败:', error)
    
    // 发生错误时的默认策略
    return {
      has_permission: false,
      reason: 'check_failed',
      subscription_info: {
        type: 'free',
        status: 'inactive',
        is_subscribed: false
      }
    }
  }
}

/**
 * 权限拦截器 - 在需要权限的功能调用前使用
 */
async function requireSubscription(feature, options = {}) {
  const {
    showModal = true,
    modalTitle = '需要订阅',
    modalContent = '此功能需要订阅后使用，是否立即订阅？',
    onCancel = null,
    onConfirm = null
  } = options
  
  try {
    const permission = await checkFeaturePermission(feature)
    
    if (permission.has_permission) {
      return { allowed: true, permission }
    }
    
    if (showModal) {
      return new Promise((resolve) => {
        let content = modalContent
        let showTrial = false
        
        // 根据不同原因显示不同内容
        if (permission.reason === 'subscription_required') {
          if (permission.subscription_info?.trial_available) {
            content = '此功能需要订阅使用。您可以先免费试用7天，或直接订阅服务。'
            showTrial = true
          } else {
            content = '此功能需要订阅使用，是否立即订阅？'
          }
        } else if (permission.reason === 'limited_access') {
          content = '您当前使用的是免费版本，功能受限。订阅后可无限制使用。'
        }
        
        const buttons = ['取消']
        if (showTrial) {
          buttons.push('免费试用')
        }
        buttons.push('立即订阅')
        
        wx.showModal({
          title: modalTitle,
          content: content,
          showCancel: buttons.length > 2,
          cancelText: buttons[0],
          confirmText: buttons[buttons.length - 1],
          success: async (res) => {
            if (res.confirm) {
              // 立即订阅
              if (onConfirm) {
                await onConfirm('subscribe')
              } else {
                navigateToSubscription()
              }
              resolve({ allowed: false, action: 'subscribe', permission })
            } else if (res.cancel && showTrial) {
              // 这里实际上是点击了免费试用（因为微信小程序模态框限制）
              // 需要用 showActionSheet 来提供更多选项
              wx.showActionSheet({
                itemList: ['免费试用7天', '立即订阅'],
                success: async (actionRes) => {
                  if (actionRes.tapIndex === 0) {
                    // 免费试用
                    if (onConfirm) {
                      await onConfirm('trial')
                    } else {
                      await startFreeTrial()
                    }
                    resolve({ allowed: false, action: 'trial', permission })
                  } else if (actionRes.tapIndex === 1) {
                    // 立即订阅
                    if (onConfirm) {
                      await onConfirm('subscribe')
                    } else {
                      navigateToSubscription()
                    }
                    resolve({ allowed: false, action: 'subscribe', permission })
                  }
                },
                fail: () => {
                  if (onCancel) onCancel()
                  resolve({ allowed: false, action: 'cancel', permission })
                }
              })
            } else {
              // 取消
              if (onCancel) onCancel()
              resolve({ allowed: false, action: 'cancel', permission })
            }
          }
        })
      })
    }
    
    return { allowed: false, permission }
    
  } catch (error) {
    console.error('权限检查失败:', error)
    return { 
      allowed: false, 
      error: error.message,
      permission: { has_permission: false, reason: 'check_failed' }
    }
  }
}

/**
 * 开始免费试用
 */
async function startFreeTrial() {
  try {
    wx.showLoading({ title: '开始试用...' })
    
    // 在开始试用前先检查订阅状态（包含登录检查）
    const subscriptionInfo = await getSubscriptionInfo(true) // 强制刷新
    
    // 如果需要登录，引导用户登录
    if (subscriptionInfo.requires_login) {
      wx.hideLoading()
      wx.showModal({
        title: '请先登录',
        content: '使用免费试用需要先登录账户',
        showCancel: true,
        cancelText: '取消',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent(getCurrentPages()[getCurrentPages().length - 1].route) })
          }
        }
      })
      return false
    }
    
    // 更严格的状态检查
    
    // 检查是否已订阅
    if (subscriptionInfo.is_subscribed) {
      wx.hideLoading()
      
      wx.showModal({
        title: '无需试用',
        content: '您当前已有有效订阅，无需试用',
        showCancel: false,
        confirmText: '知道了'
      })
      
      return false
    }
    
    // 检查是否正在试用中
    const now = new Date()
    const trialEndDate = subscriptionInfo.trial_end_date ? new Date(subscriptionInfo.trial_end_date) : null
    const isInTrial = subscriptionInfo.status === 'active' && trialEndDate && trialEndDate > now
    
    if (isInTrial) {
      const daysLeft = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24))
      wx.hideLoading()
      
      wx.showModal({
        title: '正在试用中',
        content: `您正在免费试用中，还剩${daysLeft}天。试用期内可享受所有高级功能。`,
        showCancel: false,
        confirmText: '知道了'
      })
      
      return false
    }
    
    // 检查是否可以试用
    if (!subscriptionInfo.trial_available) {
      wx.hideLoading()
      
      wx.showModal({
        title: '无法试用',
        content: '您已经使用过试用期，请直接订阅享受高级功能',
        showCancel: false,
        confirmText: '知道了'
      })
      
      return false
    }
    
    const result = await SubscriptionAPI.startTrial()
    
    wx.hideLoading()
    
    if (result.success) {
      // 清除缓存，强制刷新订阅状态
      subscriptionCache.data = null
      
      wx.showModal({
        title: '试用开始',
        content: `恭喜！您已成功开始7天免费试用，试用期内可使用所有高级功能。`,
        showCancel: false,
        confirmText: '立即体验',
        success: () => {
          // 可以触发页面刷新或跳转
          getCurrentPages().forEach(page => {
            if (page.refreshSubscriptionStatus) {
              page.refreshSubscriptionStatus()
            }
          })
        }
      })
      
      return true
    } else {
      throw new Error(result.error || '开始试用失败')
    }
    
  } catch (error) {
    wx.hideLoading()
    console.error('开始试用失败:', error)
    
    wx.showModal({
      title: '试用失败', 
      content: error.message || '开始试用失败，请稍后重试',
      showCancel: false
    })
    
    return false
  }
}

/**
 * 跳转到订阅页面
 */
function navigateToSubscription(plan = null) {
  const url = plan ? 
    `/pages/subscription/subscription?plan=${plan}` :
    `/pages/subscription/subscription`
  
  wx.navigateTo({
    url: url,
    fail: (err) => {
      console.error('跳转订阅页面失败:', err)
      wx.showToast({
        title: '页面跳转失败',
        icon: 'none'
      })
    }
  })
}

/**
 * 清除订阅缓存
 */
function clearSubscriptionCache() {
  subscriptionCache = {
    data: null,
    timestamp: 0,
    expiry: subscriptionCache.expiry
  }
}

/**
 * 订阅状态变更通知
 */
function notifySubscriptionChange() {
  // 清除缓存
  clearSubscriptionCache()
  
  // 通知所有页面刷新订阅状态
  const pages = getCurrentPages()
  pages.forEach(page => {
    if (page.refreshSubscriptionStatus) {
      page.refreshSubscriptionStatus()
    }
    // 同时调用新的统一加载方法
    if (page.loadSubscriptionStatus) {
      page.loadSubscriptionStatus()
    }
  })
  
  // 发送全局事件
  getApp().globalData.subscriptionChanged = Date.now()
  
  console.log('📢 订阅状态变更通知已发送，缓存已清除')
}

/**
 * 格式化订阅剩余时间
 */
function formatRemainingTime(endDate) {
  if (!endDate) return ''
  
  const end = new Date(endDate)
  const now = new Date()
  const diff = end - now
  
  if (diff <= 0) return '已过期'
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  
  if (days > 0) {
    return `剩余${days}天`
  } else if (hours > 0) {
    return `剩余${hours}小时`
  } else {
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `剩余${minutes}分钟`
  }
}

/**
 * 获取订阅类型显示名称
 */
function getSubscriptionTypeName(type) {
  const typeNames = {
    'free': '免费版',
    'premium': '高级版',
    'vip': 'VIP版',
    'trial': '试用版'
  }
  return typeNames[type] || type
}

/**
 * 统一的订阅状态解析器
 * 解决不同页面状态判断不一致的问题
 */
function parseSubscriptionStatus(subscriptionInfo) {
  if (!subscriptionInfo) {
    return {
      isSubscribed: false,
      isInTrial: false,
      isFree: true,
      type: 'free',
      displayName: '免费用户',
      status: 'inactive',
      trialAvailable: true,
      trialDaysLeft: 0,
      subscriptionEndDate: null,
      trialEndDate: null
    }
  }

  // 统一处理时间字段
  const now = new Date()
  const trialEndDate = subscriptionInfo.trial_end_date ? new Date(subscriptionInfo.trial_end_date) : null
  const subscriptionEndDate = subscriptionInfo.subscription_end_date ? new Date(subscriptionInfo.subscription_end_date) : null

  // 判断是否正在试用中（综合多个字段判断）
  const isInTrial = (
    subscriptionInfo.status === 'active' &&
    trialEndDate &&
    trialEndDate > now &&
    !subscriptionInfo.is_subscribed && // 没有付费订阅
    (subscriptionInfo.subscription_type === 'trial' || subscriptionInfo.type === 'trial')
  )

  // 判断是否已订阅（付费订阅）
  const isSubscribed = subscriptionInfo.is_subscribed === true || 
    (subscriptionInfo.status === 'active' && 
     subscriptionEndDate && 
     subscriptionEndDate > now && 
     !isInTrial)

  // 确定订阅类型
  let type = 'free'
  let displayName = '免费用户'
  
  if (isSubscribed) {
    type = subscriptionInfo.subscription_type || subscriptionInfo.type || 'premium'
    displayName = getSubscriptionTypeName(type)
  } else if (isInTrial) {
    type = 'trial'
    displayName = '试用会员'
  }

  // 计算试用剩余天数
  const trialDaysLeft = isInTrial && trialEndDate ? 
    Math.max(0, Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24))) : 0

  return {
    isSubscribed,
    isInTrial,
    isFree: !isSubscribed && !isInTrial,
    type,
    displayName,
    status: subscriptionInfo.status || 'inactive',
    trialAvailable: subscriptionInfo.trial_available || false,
    trialDaysLeft,
    subscriptionEndDate,
    trialEndDate,
    // 保留原始数据用于兼容
    raw: subscriptionInfo
  }
}

/**
 * 获取统一的订阅状态信息
 * 所有页面应该使用这个方法获取标准化的订阅状态
 */
async function getUnifiedSubscriptionStatus(forceRefresh = false) {
  const subscriptionInfo = await getSubscriptionInfo(forceRefresh)
  return parseSubscriptionStatus(subscriptionInfo)
}

module.exports = {
  getSubscriptionInfo,
  checkFeaturePermission,
  requireSubscription,
  startFreeTrial,
  navigateToSubscription,
  clearSubscriptionCache,
  notifySubscriptionChange,
  formatRemainingTime,
  getSubscriptionTypeName,
  parseSubscriptionStatus,
  getUnifiedSubscriptionStatus
}
