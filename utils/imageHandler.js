// 图片错误处理工具类
const imageHandler = {
  /**
   * 处理头像加载错误
   * @param {string} fallbackUrl 默认头像路径
   * @returns {string} 处理后的头像URL
   */
  handleAvatarError(fallbackUrl = '/images/default-avatar.svg') {
    return fallbackUrl
  },

  /**
   * 处理音乐封面加载错误
   * @param {string} fallbackUrl 默认封面路径
   * @returns {string} 处理后的封面URL
   */
  handleMusicCoverError(fallbackUrl = '/images/default-music-cover.svg') {
    return fallbackUrl
  },

  /**
   * 通用图片错误处理
   * @param {Event} e 错误事件
   * @param {Object} options 选项
   * @param {string} options.fallbackUrl 默认图片路径
   * @param {string} options.logPrefix 日志前缀
   * @returns {string} 处理后的图片URL
   */
  handleImageError(e, options = {}) {
    const {
      fallbackUrl = '/assets/images/default-image.png',
      logPrefix = '图片'
    } = options

    console.error(`❌ ${logPrefix}加载失败:`, e?.detail?.errMsg || e)
    
    return fallbackUrl
  },

  /**
   * 获取安全的头像URL
   * @param {Object} userInfo 用户信息
   * @returns {string} 安全的头像URL
   */
  getSafeAvatarUrl(userInfo) {
    if (!userInfo) {
      return '/images/default-avatar.svg'
    }

    const avatarUrl = userInfo.avatarUrl || userInfo.avatar_url || userInfo.avatar
    
    // 检查是否是有效的URL
    if (avatarUrl && this.isValidImageUrl(avatarUrl)) {
      return avatarUrl
    }
    
    return '/images/default-avatar.svg'
  },

  /**
   * 检查是否是有效的图片URL
   * @param {string} url 图片URL
   * @returns {boolean} 是否有效
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') {
      return false
    }

    // 检查是否是data URI或本地路径
    if (url.startsWith('data:') || url.startsWith('/')) {
      return true
    }

    // 检查是否是有效的HTTP URL
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch (error) {
      return false
    }
  },

  /**
   * 创建图片错误处理方法
   * @param {Object} pageContext 页面上下文
   * @param {string} dataField 数据字段名
   * @param {string} fallbackUrl 默认图片URL
   * @returns {Function} 错误处理方法
   */
  createErrorHandler(pageContext, dataField, fallbackUrl) {
    return function(e) {
      console.error(`❌ ${dataField}图片加载失败:`, e.detail.errMsg)
      
      const updateData = {}
      updateData[dataField] = fallbackUrl
      
      pageContext.setData(updateData)
      
      console.log(`🔄 ${dataField}已切换到默认图片`)
    }
  }
}

module.exports = imageHandler
