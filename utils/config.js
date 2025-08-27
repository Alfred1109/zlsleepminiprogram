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

// 动态环境检测（可选）
function detectEnvironment() {
  // 可以根据域名、版本号等来自动检测环境
  const accountInfo = wx.getAccountInfoSync()
  console.log('环境检测信息:', accountInfo.miniProgram)
  
  if (accountInfo.miniProgram.envVersion === 'release') {
    return ENV_TYPES.PRODUCTION
  } else if (accountInfo.miniProgram.envVersion === 'trial') {
    return ENV_TYPES.TEST
  } else {
    // 开发环境：真机调试时使用生产环境，本地调试时使用本地环境
    // 可以通过检查是否在真机环境来决定
    const systemInfo = wx.getSystemInfoSync()
    const isSimulator = systemInfo.platform === 'devtools'
    
    if (isSimulator) {
      console.log('检测到开发工具环境，使用本地配置')
      return ENV_TYPES.LOCAL
    } else {
      console.log('检测到真机环境，使用生产配置')
      return ENV_TYPES.PRODUCTION
    }
  }
}

// 环境配置
const ENV_CONFIG = {
  [ENV_TYPES.DEVELOPMENT]: {
    // 真机调试时使用生产服务器，本地调试时使用本地地址
    API_BASE_URL: 'https://medsleep.cn/api', // 真机调试使用生产服务器（443端口HTTPS）
    // 静态资源基础URL（用于音频文件等）
    STATIC_BASE_URL: 'https://medsleep.cn', // 真机调试使用生产服务器（443端口HTTPS）
    // IP自动检测开关（真机调试时关闭）
    ENABLE_IP_DETECTION: false, // 真机调试时关闭IP检测，使用生产服务器
    // 设备白名单预加载开关
    ENABLE_DEVICE_WHITELIST: false, // 设为true启用设备白名单预加载
    // 网络诊断功能已移除 - 改用API调用时优雅降级
    // ENABLE_NETWORK_DIAGNOSTIC: false, // 已废弃
    // 七牛云基础域名与目录映射（可按需调整）
    QINIU_BASE_DOMAIN: 'http://cdn.zhiruitech.com.cn',
    QINIU_CATEGORY_DIRS: {
      // 按业务分类配置目录前缀，末尾带斜杠
      sleep: 'zl-sleep/',
      relax: 'zl-relax/',
      focus: 'zl-focus/',
      default: ''
    },
    DEBUG: true,
    LOG_LEVEL: 'debug',
    TIMEOUT: 15000, // 真机环境增加超时时间
    RETRY_COUNT: 3, // 真机环境增加重试次数
    USE_MOCK: false // 使用真实后台API
  },
  [ENV_TYPES.PRODUCTION]: {
    API_BASE_URL: 'https://medsleep.cn/api', // 生产环境API地址（通过Nginx反向代理）
    STATIC_BASE_URL: 'https://medsleep.cn', // 静态资源域名（通过Nginx反向代理）
    // 生产环境开关
    ENABLE_IP_DETECTION: false, // 生产环境不需要IP检测
    ENABLE_DEVICE_WHITELIST: true, // 生产环境启用设备白名单
    // ENABLE_NETWORK_DIAGNOSTIC: true, // 已废弃
    QINIU_BASE_DOMAIN: 'http://cdn.zhiruitech.com.cn', // 七牛云CDN域名保持不变
    QINIU_CATEGORY_DIRS: {
      sleep: 'zl-sleep/',
      relax: 'zl-relax/',
      focus: 'zl-focus/',
      default: ''
    },
    DEBUG: false,
    LOG_LEVEL: 'error',
    TIMEOUT: 15000,
    RETRY_COUNT: 2,
    USE_MOCK: false
  },
  [ENV_TYPES.TEST]: {
    API_BASE_URL: 'https://medsleep.cn/api', // 测试环境也使用生产服务器（通过Nginx反向代理）
    STATIC_BASE_URL: 'https://medsleep.cn', // 静态资源域名（通过Nginx反向代理）
    // 测试环境开关
    ENABLE_IP_DETECTION: false, // 测试环境使用固定地址
    ENABLE_DEVICE_WHITELIST: false, // 测试环境禁用设备白名单
    // ENABLE_NETWORK_DIAGNOSTIC: false, // 已废弃
    QINIU_BASE_DOMAIN: 'http://cdn.zhiruitech.com.cn', // 七牛云CDN域名保持不变
    QINIU_CATEGORY_DIRS: {
      sleep: 'zl-sleep/',
      relax: 'zl-relax/',
      focus: 'zl-focus/',
      default: ''
    },
    DEBUG: true,
    LOG_LEVEL: 'info',
    TIMEOUT: 20000,
    RETRY_COUNT: 1,
    USE_MOCK: false
  },
  [ENV_TYPES.LOCAL]: {
    // 本地开发环境配置
    API_BASE_URL: 'http://127.0.0.1:5000/api', // 本地开发使用本地地址
    STATIC_BASE_URL: 'http://127.0.0.1:5000', // 本地开发使用本地地址
    // IP自动检测开关
    ENABLE_IP_DETECTION: true, // 本地开发启用IP检测
    // 设备白名单预加载开关
    ENABLE_DEVICE_WHITELIST: false, // 本地开发禁用设备白名单
    // 七牛云基础域名与目录映射（可按需调整）
    QINIU_BASE_DOMAIN: 'http://cdn.zhiruitech.com.cn',
    QINIU_CATEGORY_DIRS: {
      // 按业务分类配置目录前缀，末尾带斜杠
      sleep: 'zl-sleep/',
      relax: 'zl-relax/',
      focus: 'zl-focus/',
      default: ''
    },
    DEBUG: true,
    LOG_LEVEL: 'debug',
    TIMEOUT: 15000, // 本地环境超时时间
    RETRY_COUNT: 3, // 本地环境重试次数
    USE_MOCK: false // 使用真实后台API
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
  
  console.log('当前API配置:', {
    env: config,
    baseUrl: baseUrl,
    timestamp: new Date().toLocaleString()
  })

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
  return cfg.QINIU_BASE_DOMAIN || 'http://cdn.zhiruitech.com.cn'
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
  getQiniuDir
}
