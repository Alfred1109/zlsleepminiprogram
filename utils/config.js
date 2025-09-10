/**
 * 环境配置文件
 * 用于管理不同环境下的API地址和其他配置
 */

// 环境类型
const ENV_TYPES = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
  LOCAL: 'local' // 新增本地开发环境
}

// 当前环境（可以根据需要修改）
// 可以通过编译时变量或者动态检测来确定环境
let CURRENT_ENV = ENV_TYPES.DEVELOPMENT

// 动态环境检测 - 现在所有环境都使用统一配置，主要用于设置调试级别
function detectEnvironment() {
  // 检查是否在微信小程序环境中
  if (typeof wx === 'undefined') {
    // 非微信小程序环境（如 Node.js 测试环境）
    console.log('🧪 非微信小程序环境 - 使用开发环境配置')
    return ENV_TYPES.DEVELOPMENT
  }
  
  try {
    const accountInfo = wx.getAccountInfoSync()
    console.log('环境检测信息:', accountInfo.miniProgram)
    
    if (accountInfo.miniProgram.envVersion === 'release') {
      console.log('✅ 正式版环境 - 使用统一服务器配置')
      return ENV_TYPES.PRODUCTION
    } else if (accountInfo.miniProgram.envVersion === 'trial') {
      console.log('✅ 体验版环境 - 使用统一服务器配置')
      return ENV_TYPES.TEST
    } else {
      // 开发环境：本地调试和真机调试现在都使用统一的服务器配置
      // 无论哪种调试方式都连接同一个服务器，确保100%一致性
      const deviceInfo = wx.getDeviceInfo()
      const isSimulator = deviceInfo.platform === 'devtools'
      
      if (isSimulator) {
        console.log('✅ 开发工具环境 - 使用统一服务器配置（本地调试）')
        return ENV_TYPES.LOCAL
      } else {
        console.log('✅ 真机调试环境 - 使用统一服务器配置（真机调试）')
        return ENV_TYPES.DEVELOPMENT
      }
    }
  } catch (error) {
    console.warn('⚠️ 环境检测失败，使用默认开发环境:', error.message)
    return ENV_TYPES.DEVELOPMENT
  }
}

// 统一环境配置 - 所有环境使用相同的服务器地址，确保一致性
// 这样无论是本地调试、真机调试、体验版还是正式版都不会出错
const UNIFIED_CONFIG = {
  // 核心服务器配置 - 所有环境统一
  API_BASE_URL: 'https://medsleep.cn/api',
  STATIC_BASE_URL: 'https://medsleep.cn',
  QINIU_BASE_DOMAIN: 'https://cdn.medsleep.cn',
  QINIU_CATEGORY_DIRS: {
    sleep: 'zl-sleep/',
    relax: 'zl-relax/',
    focus: 'zl-focus/',
    default: ''
  },
  // 网络配置 - 统一超时和重试策略
  TIMEOUT: 15000,
  RETRY_COUNT: 3,
  // 功能开关 - 统一关闭以避免复杂性
  ENABLE_IP_DETECTION: false,
  ENABLE_DEVICE_WHITELIST: false,
  USE_MOCK: false,
  // 支付配置 - 微信支付相关设置
  PAYMENT: {
    // 支付 API Key
    API_KEY: 'zhiruitechdonglixingA1B2C3D4E5F6G7H8',
    // 微信小程序 APPID (来自 project.config.json)
    WECHAT_APPID: 'wxd0f3dc2792ca55fb',
    // 微信支付商户号 (北京溢兰科技有限公司)
    MCH_ID: '1727118040',
    // 支付回调配置
    PAYMENT_TIMEOUT: 300000, // 5分钟支付超时
    // 订单查询重试配置
    ORDER_QUERY_RETRY_COUNT: 5,
    ORDER_QUERY_RETRY_INTERVAL: 1000, // 1秒
    // 支付通知设置
    ENABLE_PAYMENT_NOTIFICATIONS: true
  }
}

// 环境配置 - 现在所有环境都基于统一配置，只有调试级别不同
const ENV_CONFIG = {
  [ENV_TYPES.DEVELOPMENT]: {
    ...UNIFIED_CONFIG,
    DEBUG: true,
    LOG_LEVEL: 'debug'
  },
  [ENV_TYPES.PRODUCTION]: {
    ...UNIFIED_CONFIG,
    DEBUG: false,
    LOG_LEVEL: 'error'
  },
  [ENV_TYPES.TEST]: {
    ...UNIFIED_CONFIG,
    DEBUG: true,
    LOG_LEVEL: 'info'
  },
  [ENV_TYPES.LOCAL]: {
    ...UNIFIED_CONFIG,
    DEBUG: true,
    LOG_LEVEL: 'debug'
  }
}

// 获取当前环境配置
function getCurrentConfig() {
  // 优先使用动态检测的环境
  const detectedEnv = detectEnvironment()
  return ENV_CONFIG[detectedEnv] || ENV_CONFIG[CURRENT_ENV] || ENV_CONFIG[ENV_TYPES.DEVELOPMENT]
}

// 获取API基础URL（支持动态配置和IP检测）
function getApiBaseUrl() {
  const config = getCurrentConfig()
  let baseUrl = config.API_BASE_URL

  // 避免高频日志：仅在baseUrl变化时输出一次
  try {
    if (!global.__lastLoggedBaseUrl || global.__lastLoggedBaseUrl !== baseUrl) {
      if (config.DEBUG) {
        console.log('当前API基础地址:', baseUrl)
      }
      global.__lastLoggedBaseUrl = baseUrl
    }
  } catch (_) {
    // 忽略日志记录错误
  }

  // 可以从本地存储中获取自定义API地址（用于调试）
  try {
    const customApiUrl = wx.getStorageSync('custom_api_url')
    if (customApiUrl && config.DEBUG) {
      console.log('使用自定义API地址:', customApiUrl)
      return customApiUrl
    }
  } catch (e) {
    console.warn('获取自定义API地址失败:', e)
  }

  // 真机调试时，根据配置决定是否使用动态IP
  if (config.DEBUG && baseUrl.includes('127.0.0.1') && config.ENABLE_IP_DETECTION) {
    try {
      // 只有启用IP检测时才使用自动检测的IP
      // 检查自动检测的IP
      const autoDetectedIP = wx.getStorageSync('auto_detected_ip')
      if (autoDetectedIP && autoDetectedIP.ip && autoDetectedIP.autoDetected) {
        const dynamicUrl = baseUrl.replace('127.0.0.1', autoDetectedIP.ip)
        console.log('使用自动检测的IP:', dynamicUrl)
        return dynamicUrl
      }
      
      // 检查手动配置的IP（无论是否启用IP检测都可用）
      const devServerIP = wx.getStorageSync('dev_server_ip')
      if (devServerIP && devServerIP.ip && devServerIP.ip !== '127.0.0.1') {
        const dynamicUrl = baseUrl.replace('127.0.0.1', devServerIP.ip)
        console.log('使用手动配置的IP:', dynamicUrl)
        return dynamicUrl
      }
    } catch (e) {
      console.warn('获取动态IP失败:', e)
    }
  }

  return baseUrl
}

// 获取超时时间
function getTimeout() {
  return getCurrentConfig().TIMEOUT
}

// 获取重试次数
function getRetryCount() {
  return getCurrentConfig().RETRY_COUNT
}

// 是否为调试模式
function isDebug() {
  return getCurrentConfig().DEBUG
}

// 是否使用模拟数据
function useMock() {
  return getCurrentConfig().USE_MOCK
}

// 获取日志级别
function getLogLevel() {
  return getCurrentConfig().LOG_LEVEL
}

// 设置环境（用于动态切换）
function setEnvironment(env) {
  if (ENV_CONFIG[env]) {
    CURRENT_ENV = env
    console.log(`环境已切换到: ${env}`)
    return true
  } else {
    console.error(`无效的环境类型: ${env}`)
    return false
  }
}

// 获取完整的配置对象
function getFullConfig() {
  return {
    currentEnv: CURRENT_ENV,
    config: getCurrentConfig(),
    envTypes: ENV_TYPES
  }
}

// 获取七牛基础域名，如未配置则返回默认CDN域名
function getQiniuBaseDomain() {
  const cfg = getCurrentConfig()
  return cfg.QINIU_BASE_DOMAIN || 'https://cdn.medsleep.cn'
}

// 获取七牛目录前缀，按业务分类（如 'sleep'、'relax'），末尾保证带斜杠或为空字符串
function getQiniuDir(category) {
  const cfg = getCurrentConfig()
  const dirs = cfg.QINIU_CATEGORY_DIRS || {}
  const key = (category || 'default')
  let dir = dirs[key] != null ? dirs[key] : (dirs.default || '')
  if (dir && !dir.endsWith('/')) {
    dir = dir + '/'
  }
  return dir
}

// 获取支付配置
function getPaymentConfig() {
  return getCurrentConfig().PAYMENT || {}
}

// 获取支付API Key
function getPaymentApiKey() {
  const paymentConfig = getPaymentConfig()
  return paymentConfig.API_KEY || ''
}

// 获取微信小程序APPID
function getWechatAppId() {
  const paymentConfig = getPaymentConfig()
  return paymentConfig.WECHAT_APPID || ''
}

// 获取支付超时时间
function getPaymentTimeout() {
  const paymentConfig = getPaymentConfig()
  return paymentConfig.PAYMENT_TIMEOUT || 300000 // 默认5分钟
}

// 获取订单查询重试配置
function getOrderQueryConfig() {
  const paymentConfig = getPaymentConfig()
  return {
    retryCount: paymentConfig.ORDER_QUERY_RETRY_COUNT || 5,
    retryInterval: paymentConfig.ORDER_QUERY_RETRY_INTERVAL || 1000
  }
}

// 获取微信支付商户号
function getWechatMchId() {
  const paymentConfig = getPaymentConfig()
  return paymentConfig.MCH_ID || ''
}

module.exports = {
  ENV_TYPES,
  getCurrentConfig,
  getApiBaseUrl,
  getTimeout,
  getRetryCount,
  isDebug,
  useMock,
  getLogLevel,
  setEnvironment,
  getFullConfig,
  getQiniuBaseDomain,
  getQiniuDir,
  // 支付相关配置函数
  getPaymentConfig,
  getPaymentApiKey,
  getWechatAppId,
  getWechatMchId,
  getPaymentTimeout,
  getOrderQueryConfig
}
