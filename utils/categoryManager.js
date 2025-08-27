// 小程序分类管理器（兼容层）
// 与后台统一分类配置保持同步
// 现在委托给统一音乐管理器处理

const { unifiedMusicManager } = require('./unifiedMusicManager')

/**
 * 分类管理器 - 统一管理音乐分类
 */
class CategoryManager {
  constructor() {
    this.categories = []
    this.categoryMap = new Map()
    this.lastUpdateTime = null
    this.storageKey = 'music_categories_cache'
    
    // 默认分类配置（作为fallback）
    this.defaultCategories = [
      {
        id: 1,
        name: '自然音',
        code: 'natural_sound',
        description: '大自然的真实声音，如雨声、海浪声、森林声',
        icon: '🌿',
        emoji_code: 'nature',
        tags: ['放松', '睡眠', '自然', '冥想'],
        music_count: 0
      },
      {
        id: 2,
        name: '白噪音',
        code: 'white_noise',
        description: '各种频率的白噪音，帮助专注和睡眠',
        icon: '🔊',
        emoji_code: 'noise',
        tags: ['专注', '睡眠', '噪音', '掩蔽'],
        music_count: 0
      },
      {
        id: 3,
        name: '脑波音频',
        code: 'brainwave',
        description: '不同频率的脑波音频，促进特定脑波状态',
        icon: '🧠',
        emoji_code: 'brainwave',
        tags: ['脑波', '冥想', '专注', '睡眠', '放松'],
        music_count: 0
      },
      {
        id: 4,
        name: 'AI音乐',
        code: 'ai_music',
        description: 'AI生成的个性化音乐',
        icon: '🤖',
        emoji_code: 'ai',
        tags: ['AI', '个性化', '生成', '疗愈'],
        music_count: 0
      },
      {
        id: 5,
        name: '疗愈资源',
        code: 'healing_resource',
        description: '专业的疗愈资源',
        icon: '💚',
        emoji_code: 'healing',
        tags: ['疗愈', '专业', '治疗', '康复'],
        music_count: 0
      }
    ]
  }

  /**
   * 初始化分类管理器
   */
  async init() {
    try {
      console.log('初始化分类管理器（委托给统一音乐管理器）...')
      
      // 委托给统一音乐管理器
      const success = await unifiedMusicManager.init()
      
      if (success) {
        // 同步数据
        this.categories = unifiedMusicManager.getAllCategories()
        this.buildCategoryMap()
        this.lastUpdateTime = new Date()
      }
      
      console.log('分类管理器初始化完成')
      return success
    } catch (error) {
      console.error('分类管理器初始化失败:', error)
      this.useDefaultCategories()
      return false
    }
  }

  /**
   * 从缓存加载分类
   */
  async loadFromCache() {
    try {
      const cached = wx.getStorageSync(this.storageKey)
      if (cached && cached.categories && cached.timestamp) {
        const cacheAge = Date.now() - cached.timestamp
        // 缓存有效期24小时
        if (cacheAge < 24 * 60 * 60 * 1000) {
          this.categories = cached.categories
          this.buildCategoryMap()
          this.lastUpdateTime = new Date(cached.timestamp)
          console.log('从缓存加载分类成功:', this.categories.length)
          return true
        }
      }
    } catch (error) {
      console.warn('从缓存加载分类失败:', error)
    }
    return false
  }

  /**
   * 从服务器更新分类
   */
  async updateFromServer() {
    try {
      console.log('从服务器更新分类（委托给统一音乐管理器）...')
      
      // 委托给统一音乐管理器
      const success = await unifiedMusicManager.refreshCategories()
      
      if (success) {
        // 同步数据
        this.categories = unifiedMusicManager.getAllCategories()
        this.buildCategoryMap()
        this.lastUpdateTime = new Date()
        
        console.log('服务器分类更新成功:', this.categories.length)
      }
      
      return success
    } catch (error) {
      console.error('从服务器更新分类失败:', error)
      return false
    }
  }

  /**
   * 保存分类到缓存
   */
  async saveToCache() {
    try {
      const cacheData = {
        categories: this.categories,
        timestamp: Date.now(),
        version: '1.0'
      }
      wx.setStorageSync(this.storageKey, cacheData)
      console.log('分类缓存保存成功')
    } catch (error) {
      console.warn('保存分类缓存失败:', error)
    }
  }

  /**
   * 使用默认分类
   */
  useDefaultCategories() {
    console.log('使用默认分类配置')
    this.categories = [...this.defaultCategories]
    this.buildCategoryMap()
  }

  /**
   * 构建分类映射表
   */
  buildCategoryMap() {
    this.categoryMap.clear()
    this.categories.forEach(category => {
      this.categoryMap.set(category.id, category)
    })
  }

  /**
   * 获取所有分类
   */
  getAllCategories() {
    return [...this.categories]
  }

  /**
   * 根据ID获取分类
   */
  getCategoryById(id) {
    return this.categoryMap.get(id) || null
  }

  /**
   * 根据代码获取分类
   */
  getCategoryByCode(code) {
    return this.categories.find(cat => cat.code === code) || null
  }

  /**
   * 根据标签获取分类
   */
  getCategoriesByTag(tag) {
    return this.categories.filter(cat => 
      cat.tags && cat.tags.some(t => 
        t.toLowerCase().includes(tag.toLowerCase())
      )
    )
  }

  /**
   * 搜索分类
   */
  searchCategories(keyword) {
    if (!keyword) return this.getAllCategories()
    
    const searchTerm = keyword.toLowerCase()
    return this.categories.filter(cat =>
      cat.name.toLowerCase().includes(searchTerm) ||
      cat.description.toLowerCase().includes(searchTerm) ||
      (cat.tags && cat.tags.some(tag => 
        tag.toLowerCase().includes(searchTerm)
      ))
    )
  }

  /**
   * 获取分类音乐列表
   */
  async getCategoryMusic(categoryId, limit = 0) {
    try {
      // 委托给统一音乐管理器
      const musicData = await unifiedMusicManager.getMusicByCategory(categoryId)
      
      // 包装为列表格式以保持兼容性
      let musicList = [musicData]
      
      // 如果需要限制数量
      if (limit > 0 && musicList.length > limit) {
        musicList = musicList.slice(0, limit)
      }
      
      return {
        success: true,
        data: musicList,
        category_info: {
          id: categoryId,
          name: this.getCategoryById(categoryId)?.name || '未知分类'
        },
        total_count: musicList.length
      }
    } catch (error) {
      console.error('获取分类音乐失败:', error)
      return {
        success: false,
        error: error.message,
        data: []
      }
    }
  }

  /**
   * 获取随机音乐
   */
  async getRandomMusic(categoryId) {
    try {
      // 委托给统一音乐管理器
      const musicData = await unifiedMusicManager.getMusicByCategory(categoryId)
      
      return {
        success: true,
        data: musicData
      }
    } catch (error) {
      console.error('获取随机音乐失败:', error)
      return {
        success: false,
        error: error.message,
        data: null
      }
    }
  }

  /**
   * 搜索音乐
   */
  async searchMusic(keyword, categoryId = null) {
    try {
      let url = `/music/search?q=${encodeURIComponent(keyword)}`
      if (categoryId) {
        url += `&category_id=${categoryId}`
      }

      const response = await api.request({
        url: url,
        method: 'GET'
      })

      if (response && response.success) {
        return {
          success: true,
          data: response.data || [],
          keyword: keyword,
          category_filter: categoryId,
          total_count: response.total_count || 0
        }
      } else {
        throw new Error(response?.message || '搜索失败')
      }
    } catch (error) {
      console.error('搜索音乐失败:', error)
      return {
        success: false,
        error: error.message,
        data: []
      }
    }
  }

  /**
   * 获取推荐分类（基于用户偏好）
   */
  getRecommendedCategories(userPreferences = []) {
    if (!userPreferences.length) {
      // 返回音乐数量最多的分类
      return [...this.categories]
        .sort((a, b) => (b.music_count || 0) - (a.music_count || 0))
        .slice(0, 3)
    }
    
    // 基于用户偏好推荐
    const scored = this.categories.map(category => {
      let score = 0
      userPreferences.forEach(pref => {
        if (category.tags && category.tags.includes(pref)) {
          score += 1
        }
        if (category.name.includes(pref)) {
          score += 2
        }
      })
      return { ...category, score }
    })
    
    return scored
      .filter(cat => cat.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    const totalMusic = this.categories.reduce((sum, cat) => sum + (cat.music_count || 0), 0)
    const availableCategories = this.categories.filter(cat => (cat.music_count || 0) > 0).length
    
    return {
      totalCategories: this.categories.length,
      availableCategories: availableCategories,
      totalMusic: totalMusic,
      lastUpdateTime: this.lastUpdateTime,
      cacheStatus: this.lastUpdateTime ? 'cached' : 'default'
    }
  }

  /**
   * 强制刷新分类
   */
  async refresh() {
    try {
      console.log('强制刷新分类...')
      const success = await this.updateFromServer()
      if (success) {
        console.log('分类刷新成功')
        return true
      } else {
        console.warn('分类刷新失败，使用缓存数据')
        return false
      }
    } catch (error) {
      console.error('强制刷新分类失败:', error)
      return false
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    try {
      // 委托给统一音乐管理器
      unifiedMusicManager.clearCache()
      
      // 清除自己的缓存
      wx.removeStorageSync(this.storageKey)
      console.log('分类缓存已清除')
    } catch (error) {
      console.warn('清除分类缓存失败:', error)
    }
  }
}

// 创建全局实例
const categoryManager = new CategoryManager()

module.exports = {
  CategoryManager,
  categoryManager
}
