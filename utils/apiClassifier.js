/**
 * API分类器 - 明确区分需要认证和不需要认证的API
 */

// 不需要认证的公开API列表
const PUBLIC_APIS = [
  // 健康检查
  '/health',
  
  // 设备相关（公开）
  '/devices/whitelist',
  '/devices/verify',
  
  // 音乐分类（公开）
  '/music/categories',
  
  // 评测量表（公开）
  '/assessment/scales',
  
  // 七牛云文件（公开）
  '/music/qiniu/categories',
  
  // 其他公开API
  '/music/random', // 随机音乐可以是公开的
]

// 需要认证的API列表
const PRIVATE_APIS = [
  // 用户认证
  '/auth/',
  
  // 用户相关
  '/user/',
  '/subscription/',
  
  // 用户收藏和下载（新增）
  '/api/favorites',
  '/api/downloads',
  '/favorites',
  '/downloads',
  
  // 播放记录（用户特定数据）
  '/play-records/',
  
  // 用户特定的音乐
  '/music/user_music',
  '/music/user_long_sequences',
  '/music/long_sequence_status',
  '/music/generate',
  '/music/long_sequence',
  
  // 设备绑定（需要认证）
  '/devices/bind',
  '/devices/unbind',
  '/devices/my-devices',
  
  // 评测历史（用户特定）
  '/assessment/history',
  '/assessment/submit',
  
  // 企业功能
  '/enterprise/',
  
  // 管理功能
  '/admin/',
]

/**
 * 判断API是否需要认证
 * @param {string} url - API路径
 * @returns {boolean} - true表示需要认证，false表示公开API
 */
function requiresAuth(url) {
  // 移除查询参数
  const cleanUrl = url.split('?')[0]
  
  console.log(`🔍 API分类检查: ${url} -> ${cleanUrl}`)
  
  // 检查是否为公开API
  for (const publicPath of PUBLIC_APIS) {
    if (cleanUrl.includes(publicPath)) {
      console.log(`✅ 匹配到公开API: ${publicPath}`)
      return false
    }
  }
  
  // 检查是否为需要认证的API
  for (const privatePath of PRIVATE_APIS) {
    if (cleanUrl.includes(privatePath)) {
      console.log(`✅ 匹配到私有API: ${privatePath}`)
      return true
    }
  }
  
  // 默认需要认证（安全优先）
  console.warn(`未分类的API: ${url}，默认需要认证`)
  console.warn(`可用的私有API路径:`, PRIVATE_APIS.slice(0, 10)) // 只显示前10个避免日志过长
  return true
}

/**
 * 判断API是否为公开API
 * @param {string} url - API路径
 * @returns {boolean} - true表示公开API，false表示需要认证
 */
function isPublicApi(url) {
  return !requiresAuth(url)
}

module.exports = {
  requiresAuth,
  isPublicApi,
  PUBLIC_APIS,
  PRIVATE_APIS
}
