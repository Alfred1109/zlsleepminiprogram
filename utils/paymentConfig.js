/**
 * 支付配置和工具函数
 * 统一管理微信支付相关的配置和功能
 */

const { getPaymentConfig, getPaymentApiKey, getWechatAppId, getWechatMchId, getPaymentTimeout, getOrderQueryConfig } = require('./config')

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
   * 获取微信支付商户号
   */
  static getMchId() {
    return getWechatMchId()
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
    
    if (!config.MCH_ID) {
      errors.push('微信支付商户号未配置')
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
    // 参数验证和清理
    if (!planId) {
      throw new Error('planId 不能为空')
    }
    
    // 确保所有ID都是字符串类型，符合RESTful API标准
    const cleanPlanId = String(planId).trim()
    const cleanUserId = userId ? String(userId).trim() : null
    const cleanCouponCode = couponCode ? String(couponCode).trim() : null
    
    // 验证API配置
    const apiKey = this.getApiKey()
    const appId = this.getAppId()
    const mchId = this.getMchId()
    const timeout = this.getTimeout()
    
    if (!apiKey) {
      throw new Error('支付 API Key 未配置')
    }
    if (!appId) {
      throw new Error('微信小程序 APPID 未配置')
    }
    if (!mchId) {
      throw new Error('微信支付商户号未配置')
    }
    if (!timeout || timeout <= 0) {
      throw new Error('支付超时时间配置无效')
    }
    
    const params = {
      plan_id: cleanPlanId,
      payment_config: {
        api_key: apiKey,
        app_id: appId,
        mch_id: mchId,
        timeout: timeout
      }
    }
    
    // 只有当userId有值时才添加，避免发送null或undefined
    if (cleanUserId) {
      params.user_id = cleanUserId
    }
    
    // 只有当couponCode有值时才添加
    if (cleanCouponCode) {
      params.coupon_code = cleanCouponCode
    }
    
    // 最终参数验证
    if (!params.plan_id) {
      throw new Error('处理后的 plan_id 为空')
    }
    
    return params
  }
  
  /**
   * 格式化支付参数（用于微信支付）
   */
  static formatPaymentParams(paymentData) {
    // 确保支付参数包含必要的字段
    if (!paymentData.payment_params) {
      console.warn('❗ 支付数据缺少 payment_params 字段（小程序侧不需要 total_fee，仅后端统一下单使用）')
      console.warn('🔍 完整的paymentData:', paymentData)
      
      // 检查是否是后端返回的错误信息
      if (paymentData.error && paymentData.error.includes('total_fee')) {
        console.warn('🚧 检测到后端微信支付API total_fee 提示:', paymentData.error)
        console.warn('📋 说明: total_fee 为后端统一下单必填，与小程序 wx.requestPayment 无关')
        console.warn('💡 建议后端排查: 统一下单接口的 total_fee（单位分）是否为正整数')
      }
      
      return null
    }
    
    const params = paymentData.payment_params
    
    console.log('🔍 后端返回的完整支付数据:', {
      hasPaymentParams: !!paymentData.payment_params,
      paymentParamsKeys: Object.keys(params),
      orderNo: paymentData.order_no,
      rawParams: params
    })
    
    // 验证package参数格式（应该包含prepay_id）
    if (params.package && !params.package.startsWith('prepay_id=')) {
      console.warn('⚠️ package参数格式异常:', params.package)
      console.warn('💡 正确格式应为: prepay_id=wx201222229874569b201de80e089456213')
    }
    
    // 验证必要的微信小程序支付参数 (微信小程序不需要total_fee)
    const requiredFields = ['timeStamp', 'nonceStr', 'package', 'signType', 'paySign']
    const missingFields = requiredFields.filter(field => !params[field])
    
    if (missingFields.length > 0) {
      console.error('❌ 支付参数缺少必要字段:', missingFields)
      console.error('📋 后端返回的所有字段:', Object.keys(params))
      console.error('📄 字段值详情:', {
        timeStamp: params.timeStamp,
        nonceStr: params.nonceStr,
        package: params.package,
        signType: params.signType,
        paySign: params.paySign,
        // total_fee仅用于调试输出，微信小程序支付不使用此参数
        total_fee_debug: params.total_fee || '未设置（小程序支付不需要）'
      })
      
      // 提供具体的修复建议
      if (missingFields.includes('package')) {
        console.error('🔧 修复建议: package参数缺失，这通常是后端统一下单失败导致的')
        console.error('   请检查后端微信统一下单接口的调用是否成功')
      }
      
      return null
    }
    
    // 构建微信小程序支付参数 (不包含total_fee，金额信息在package中)
    const paymentParams = {
      timeStamp: String(params.timeStamp),
      nonceStr: String(params.nonceStr),
      package: String(params.package),
      signType: String(params.signType || 'MD5').toUpperCase(),
      paySign: String(params.paySign)
    }

    // 二次严格校验（按官方指引）
    if (!paymentParams.package.startsWith('prepay_id=')) {
      console.error('❌ package 参数格式错误，应为 prepay_id=... 实际为:', paymentParams.package)
      return null
    }
    if (typeof paymentParams.timeStamp !== 'string') {
      console.error('❌ timeStamp 必须为字符串')
      return null
    }
    
    console.log('✅ 格式化后的微信支付参数:', paymentParams)
    
    return paymentParams
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
    
    // 检查是否是后端微信支付API相关的错误（小程序侧不需要 total_fee，不对用户提示）
    if (error.message && error.message.includes('total_fee')) {
      console.warn('🚧 捕获到 total_fee 相关错误提示（仅记录，不向用户展示）:', error.message)
      return {
        type: 'BACKEND_PAYMENT_CONFIG_ERROR',
        message: '后端支付参数提示（total_fee）',
        showToUser: false,
        debugInfo: '统一下单 total_fee 提示，已在前端忽略'
      }
    }
    
    // 检查是否是prepay_id相关的错误
    if (error.message && (error.message.includes('prepay_id') || error.message.includes('package'))) {
      return {
        type: 'PREPAY_ERROR',
        message: '支付订单生成失败，请稍后重试',
        showToUser: true,
        debugInfo: '微信统一下单失败或prepay_id无效'
      }
    }
    
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
    
    // 判断价格单位：
    // 1. 如果价格>=100且是整数，认为是分为单位，需要转换为元
    // 2. 如果价格<100或有小数，认为是元为单位，直接显示
    let yuan
    if (price >= 100 && price % 1 === 0) {
      // 价格>=100且是整数，认为是分为单位，转换为元
      yuan = (price / 100).toFixed(2)
    } else {
      // 价格<100或有小数，认为是元为单位
      yuan = price.toFixed(2)
    }
    
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

