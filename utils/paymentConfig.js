/**
 * 支付配置和工具函数
 * 统一管理微信支付相关的配置和功能
 */

const { getPaymentConfig, getPaymentApiKey, getWechatAppId, getPaymentTimeout, getOrderQueryConfig } = require('./config')

/**
 * 支付配置类
 */
class PaymentConfig {
  
  /**
   * 获取完整的支付配置
   */
  static getConfig() {
    return getPaymentConfig()
  }
  
  /**
   * 获取支付API Key
   */
  static getApiKey() {
    return getPaymentApiKey()
  }
  
  /**
   * 获取微信小程序APPID
   */
  static getAppId() {
    return getWechatAppId()
  }
  
  /**
   * 获取支付超时时间
   */
  static getTimeout() {
    return getPaymentTimeout()
  }
  
  /**
   * 获取订单查询配置
   */
  static getOrderQueryConfig() {
    return getOrderQueryConfig()
  }
  
  /**
   * 验证支付配置是否完整
   */
  static validateConfig() {
    const config = this.getConfig()
    const errors = []
    
    if (!config.API_KEY) {
      errors.push('支付API Key未配置')
    }
    
    if (!config.WECHAT_APPID) {
      errors.push('微信小程序APPID未配置')
    }
    
    if (!config.PAYMENT_TIMEOUT || config.PAYMENT_TIMEOUT <= 0) {
      errors.push('支付超时时间配置无效')
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      config: config
    }
  }
  
  /**
   * 创建支付订单请求参数
   */
  static createOrderParams(planId, userId = null, couponCode = null) {
    const params = {
      plan_id: planId,
      payment_config: {
        api_key: this.getApiKey(),
        app_id: this.getAppId(),
        timeout: this.getTimeout()
      }
    }
    
    if (userId) {
      params.user_id = userId
    }
    
    if (couponCode) {
      params.coupon_code = couponCode
    }
    
    return params
  }
  
  /**
   * 格式化支付参数（用于微信支付）
   */
  static formatPaymentParams(paymentData) {
    // 确保支付参数包含必要的字段
    if (!paymentData.payment_params) {
      console.error('❌ 支付数据缺少payment_params字段')
      return null
    }
    
    const params = paymentData.payment_params
    
    // 验证必要的支付参数
    const requiredFields = ['timeStamp', 'nonceStr', 'package', 'signType', 'paySign']
    const missingFields = requiredFields.filter(field => !params[field])
    
    if (missingFields.length > 0) {
      console.error('❌ 支付参数缺少必要字段:', missingFields)
      return null
    }
    
    return {
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign
    }
  }
  
  /**
   * 记录支付日志
   */
  static logPaymentEvent(event, data = {}) {
    const timestamp = new Date().toISOString()
    const logData = {
      timestamp,
      event,
      data: {
        ...data,
        // 不记录敏感信息
        api_key: data.api_key ? '***已隐藏***' : undefined,
        paySign: data.paySign ? '***已隐藏***' : undefined
      }
    }
    
    console.log(`💰 [支付事件] ${event}:`, logData)
    
    // 可以在这里添加更多的日志记录逻辑，比如发送到服务器
  }
  
  /**
   * 处理支付错误
   */
  static handlePaymentError(error, context = '') {
    const errorInfo = {
      context,
      message: error.message || '未知错误',
      code: error.code || error.errMsg || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    }
    
    this.logPaymentEvent('PAYMENT_ERROR', errorInfo)
    
    // 根据不同的错误类型返回用户友好的错误消息
    if (error.errMsg && error.errMsg.includes('cancel')) {
      return {
        type: 'USER_CANCEL',
        message: '用户取消了支付',
        showToUser: false
      }
    } else if (error.errMsg && error.errMsg.includes('fail')) {
      return {
        type: 'PAYMENT_FAIL',
        message: '支付失败，请稍后重试',
        showToUser: true
      }
    } else if (error.code === 'NETWORK_ERROR') {
      return {
        type: 'NETWORK_ERROR',
        message: '网络异常，请检查网络连接',
        showToUser: true
      }
    } else {
      return {
        type: 'UNKNOWN_ERROR',
        message: '支付过程中出现问题，请稍后重试',
        showToUser: true
      }
    }
  }
  
  /**
   * 获取支付状态描述
   */
  static getPaymentStatusDescription(status) {
    const statusMap = {
      'pending': '等待支付',
      'paid': '支付成功',
      'failed': '支付失败',
      'expired': '订单已过期',
      'cancelled': '订单已取消',
      'refunded': '已退款',
      'partial_refunded': '部分退款'
    }
    
    return statusMap[status] || `未知状态: ${status}`
  }
  
  /**
   * 检查支付环境
   */
  static checkPaymentEnvironment() {
    const checks = {
      isWechatMiniProgram: typeof wx !== 'undefined',
      hasPaymentAPI: typeof wx !== 'undefined' && typeof wx.requestPayment === 'function',
      configValid: this.validateConfig().isValid
    }
    
    // 在非微信小程序环境中（如测试环境），支付API不可用是正常的
    const isTestEnvironment = typeof wx === 'undefined'
    const allChecksPass = checks.configValid && (isTestEnvironment || (checks.isWechatMiniProgram && checks.hasPaymentAPI))
    
    console.log('🔍 支付环境检查结果:', {
      ...checks,
      isTestEnvironment,
      overall: allChecksPass ? '✅ 环境正常' : '❌ 环境异常'
    })
    
    return {
      ...checks,
      isTestEnvironment,
      isReady: allChecksPass
    }
  }
}

/**
 * 支付工具函数
 */
const PaymentUtils = {
  
  /**
   * 格式化价格显示
   */
  formatPrice(price, currency = '¥') {
    if (!price && price !== 0) return '价格待定'
    if (price === 0) return '免费'
    if (typeof price !== 'number') {
      price = parseFloat(price) || 0
    }
    // 如果价格是分为单位，转换为元
    const yuan = price > 999 ? (price / 100).toFixed(2) : price.toFixed(2)
    return `${currency}${yuan}`
  },
  
  /**
   * 生成订单号
   */
  generateOrderNo(prefix = 'ORDER') {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9).toUpperCase()
    return `${prefix}_${timestamp}_${random}`
  },
  
  /**
   * 验证订单号格式
   */
  validateOrderNo(orderNo) {
    if (!orderNo || typeof orderNo !== 'string') return false
    // 基本格式检查：应该包含时间戳和随机字符
    return /^[A-Z_]+_\d{13}_[A-Z0-9]{9}$/.test(orderNo)
  },
  
  /**
   * 计算订单过期时间
   */
  calculateExpireTime(minutes = 30) {
    return new Date(Date.now() + minutes * 60 * 1000)
  }
}

module.exports = {
  PaymentConfig,
  PaymentUtils
}
