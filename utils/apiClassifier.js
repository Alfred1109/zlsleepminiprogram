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
  '/api/music/categories',
  '/music/categories',  // 兼容旧路径
  
  // 预设音乐（公开） - 修复关键问题
  '/api/preset-music/category',
  '/preset-music/category',
  '/preset-music',
  
  // 评测量表（公开）
  '/api/assessment/scales',
  '/assessment/scales',  // 兼容旧路径
  
  // 七牛云文件（公开）
  '/api/music/qiniu/categories',
  '/music/qiniu/categories',  // 兼容旧路径
  '/api/music/qiniu_signed_url',
  '/music/qiniu_signed_url',  // 兼容旧路径
  
  // 场景相关（公开）
  '/api/scene/mappings',
  '/api/scene/list',
  '/api/scene/detail',
  '/scene/mappings',  // 兼容旧路径
  '/scene/list',      // 兼容旧路径
  
  // 其他公开API
  '/api/music/random', // 随机音乐可以是公开的
  '/music/random',  // 兼容旧路径
  
  // 实物商品相关（公开）
  '/api/physical-products/list',
  '/api/physical-products/categories',
  '/api/physical-products/search',
  '/api/physical-products/delivery-methods',
  '/api/physical-products/',  // 商品详情 (GET /api/physical-products/{id}/detail)
  '/physical-products/list',  // 兼容旧路径
  '/physical-products/categories',  // 兼容旧路径
  '/physical-products/search',  // 兼容旧路径
  '/physical-products/delivery-methods',  // 兼容旧路径
  '/physical-products/',  // 商品详情兼容旧路径
]

// 需要认证的API列表
const PRIVATE_APIS = [
  // 用户认证
  '/api/auth/',
  
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
  '/api/music/user_music',
  '/api/music/user_long_sequences',
  '/api/music/long_sequence_status',
  '/api/music/long_sequence_progress/',
  '/api/music/generate',
  '/api/music/long_sequence',
  '/api/music/create_long_sequence',  // 🔧 修复：添加创建长序列API
  '/api/music/status/',               // 🔧 修复：音乐状态查询
  '/api/music/download/',             // 🔧 修复：音乐下载
  '/api/music/delete/',               // 🔧 修复：音乐删除
  '/api/music/personalized_recommendations/',  // 🔧 修复：个性化推荐
  '/api/music/refresh_url/',          // 🔧 修复：刷新URL
  '/api/music/download_long_sequence/', // 🔧 修复：长序列下载
  '/api/music/check_long_sequence_file/', // 🔧 修复：检查长序列文件
  '/api/music/delete_long_sequence/',  // 🔧 修复：删除长序列
  '/api/music/refresh_long_sequence_url/', // 🔧 修复：刷新长序列URL
  
  // 设备绑定（需要认证）
  '/devices/bind',
  '/devices/unbind',
  '/devices/my-devices',
  
  // 实物商品相关（需要认证的）
  '/api/physical-products/addresses',
  '/api/physical-products/create-order',
  '/api/physical-products/orders',
  '/api/physical-products/calculate-delivery',
  '/physical-products/addresses',  // 兼容旧路径
  '/physical-products/create-order',  // 兼容旧路径
  '/physical-products/orders',  // 兼容旧路径
  '/physical-products/calculate-delivery',  // 兼容旧路径
  
  // 评测历史（用户特定）
  '/api/assessment/history',
  '/api/assessment/submit',
  
  // 次数套餐和优惠券（需要认证）
  '/api/count-package/',
  
  // 企业功能
  '/enterprise/',
  
  // 管理功能
  '/admin/'
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
  
  // 先检查是否为需要认证的API（私有API优先，避免被宽泛的公开API规则误判）
  for (const privatePath of PRIVATE_APIS) {
    if (cleanUrl.includes(privatePath)) {
      console.log(`✅ 匹配到私有API: ${privatePath}`)
      return true
    }
  }
  
  // 再检查是否为公开API
  for (const publicPath of PUBLIC_APIS) {
    if (cleanUrl.includes(publicPath)) {
      console.log(`✅ 匹配到公开API: ${publicPath}`)
      return false
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
