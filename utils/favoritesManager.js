// utils/favoritesManager.js
/**
 * 收藏管理器
 * 负责管理用户的收藏功能，包括本地存储和服务器同步
 */

const AuthService = require('../services/AuthService')

class FavoritesManager {
  constructor() {
    this.storageKey = 'userFavorites'
  }

  /**
   * 获取所有收藏项目
   */
  getAllFavorites() {
    try {
      return wx.getStorageSync(this.storageKey) || []
    } catch (error) {
      console.error('获取收藏列表失败:', error)
      return []
    }
  }

  /**
   * 检查是否已收藏
   */
  isFavorited(itemId) {
    const favorites = this.getAllFavorites()
    return favorites.some(item => item.id === itemId)
  }

  /**
   * 添加收藏
   */
  async addFavorite(item) {
    try {
      if (!AuthService.isLoggedIn()) {
        throw new Error('需要登录才能收藏')
      }

      if (this.isFavorited(item.id)) {
        throw new Error('已经收藏过了')
      }

      const favorites = this.getAllFavorites()
      const favoriteItem = {
        id: item.id,
        type: item.type || 'music', // music, assessment, sequence
        title: item.title || item.name || '未知标题',
        subtitle: item.subtitle || item.category || '',
        cover: item.cover || item.coverUrl || item.image || '/images/default-music-cover.svg',
        duration: item.duration || 0,
        favoriteTime: Date.now(),
        metadata: {
          category: item.category,
          tags: item.tags || [],
          ...item.metadata
        },
        originalData: item // 保存原始数据
      }

      favorites.unshift(favoriteItem) // 添加到开头
      wx.setStorageSync(this.storageKey, favorites)

      // 异步同步到服务器
      this.syncToServer(favoriteItem, 'add').catch(error => {
        console.warn('同步收藏到服务器失败:', error)
      })

      return true
    } catch (error) {
      console.error('添加收藏失败:', error)
      throw error
    }
  }

  /**
   * 取消收藏
   */
  async removeFavorite(itemId) {
    try {
      if (!AuthService.isLoggedIn()) {
        throw new Error('需要登录才能操作收藏')
      }

      const favorites = this.getAllFavorites()
      const index = favorites.findIndex(item => item.id === itemId)
      
      if (index === -1) {
        throw new Error('未找到该收藏项目')
      }

      const removedItem = favorites[index]
      favorites.splice(index, 1)
      wx.setStorageSync(this.storageKey, favorites)

      // 异步同步到服务器
      this.syncToServer(removedItem, 'remove').catch(error => {
        console.warn('同步取消收藏到服务器失败:', error)
      })

      return true
    } catch (error) {
      console.error('取消收藏失败:', error)
      throw error
    }
  }

  /**
   * 切换收藏状态
   */
  async toggleFavorite(item) {
    if (this.isFavorited(item.id)) {
      await this.removeFavorite(item.id)
      return { isFavorited: false, action: 'removed' }
    } else {
      await this.addFavorite(item)
      return { isFavorited: true, action: 'added' }
    }
  }

  /**
   * 获取收藏统计
   */
  getStats() {
    const favorites = this.getAllFavorites()
    return {
      total: favorites.length,
      musicCount: favorites.filter(item => item.type === 'music').length,
      assessmentCount: favorites.filter(item => item.type === 'assessment').length,
      sequenceCount: favorites.filter(item => item.type === 'sequence').length,
      recentCount: favorites.filter(item => 
        Date.now() - item.favoriteTime < 7 * 24 * 60 * 60 * 1000 // 最近7天
      ).length
    }
  }

  /**
   * 根据类型筛选收藏
   */
  getFavoritesByType(type) {
    const favorites = this.getAllFavorites()
    if (type === 'all') return favorites
    return favorites.filter(item => item.type === type)
  }

  /**
   * 搜索收藏
   */
  searchFavorites(keyword) {
    if (!keyword.trim()) return this.getAllFavorites()
    
    const favorites = this.getAllFavorites()
    const lowerKeyword = keyword.toLowerCase()
    
    return favorites.filter(item => 
      item.title.toLowerCase().includes(lowerKeyword) ||
      item.subtitle.toLowerCase().includes(lowerKeyword) ||
      (item.metadata.tags && item.metadata.tags.some(tag => 
        tag.toLowerCase().includes(lowerKeyword)
      ))
    )
  }

  /**
   * 清空所有收藏
   */
  async clearAllFavorites() {
    try {
      if (!AuthService.isLoggedIn()) {
        throw new Error('需要登录才能操作收藏')
      }

      wx.removeStorageSync(this.storageKey)
      
      // 同步到服务器
      this.syncToServer(null, 'clear').catch(error => {
        console.warn('同步清空收藏到服务器失败:', error)
      })

      return true
    } catch (error) {
      console.error('清空收藏失败:', error)
      throw error
    }
  }

  /**
   * 同步到服务器
   */
  async syncToServer(item, action) {
    try {
      if (!AuthService.isLoggedIn()) return

      const user = AuthService.getCurrentUser()
      if (!user) return

      // 这里实现与服务器的同步逻辑
      // const api = require('./api')
      // const result = await api.request({
      //   url: '/user/favorites',
      //   method: action === 'add' ? 'POST' : action === 'remove' ? 'DELETE' : 'PUT',
      //   data: {
      //     user_id: user.id,
      //     item_id: item?.id,
      //     action: action,
      //     item_data: item
      //   }
      // })

      console.log('收藏同步到服务器:', { action, item: item?.title })
    } catch (error) {
      console.error('同步收藏到服务器失败:', error)
      // 不抛出错误，避免影响本地操作
    }
  }

  /**
   * 从服务器拉取收藏数据
   */
  async syncFromServer() {
    try {
      if (!AuthService.isLoggedIn()) return []

      const user = AuthService.getCurrentUser()
      if (!user) return []

      // 这里实现从服务器拉取收藏数据的逻辑
      // const api = require('./api')
      // const result = await api.request({
      //   url: `/user/favorites/${user.id}`,
      //   method: 'GET'
      // })

      // if (result.success && result.data) {
      //   // 合并本地和服务器数据
      //   const localFavorites = this.getAllFavorites()
      //   const serverFavorites = result.data
      //   const mergedFavorites = this.mergeFavorites(localFavorites, serverFavorites)
      //   wx.setStorageSync(this.storageKey, mergedFavorites)
      //   return mergedFavorites
      // }

      console.log('从服务器同步收藏数据')
      return this.getAllFavorites()
    } catch (error) {
      console.error('从服务器同步收藏失败:', error)
      return this.getAllFavorites()
    }
  }

  /**
   * 合并本地和服务器收藏数据
   */
  mergeFavorites(local, server) {
    const merged = [...local]
    const localIds = new Set(local.map(item => item.id))

    // 添加服务器端有但本地没有的收藏
    server.forEach(serverItem => {
      if (!localIds.has(serverItem.id)) {
        merged.push(serverItem)
      }
    })

    // 按收藏时间排序
    return merged.sort((a, b) => b.favoriteTime - a.favoriteTime)
  }

  /**
   * 导出收藏数据
   */
  exportFavorites() {
    const favorites = this.getAllFavorites()
    const exportData = {
      exportTime: Date.now(),
      count: favorites.length,
      favorites: favorites.map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        favoriteTime: item.favoriteTime,
        metadata: item.metadata
      }))
    }
    
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * 导入收藏数据
   */
  async importFavorites(importDataStr) {
    try {
      const importData = JSON.parse(importDataStr)
      if (!importData.favorites || !Array.isArray(importData.favorites)) {
        throw new Error('导入数据格式错误')
      }

      const currentFavorites = this.getAllFavorites()
      const importedFavorites = importData.favorites
      const merged = this.mergeFavorites(currentFavorites, importedFavorites)
      
      wx.setStorageSync(this.storageKey, merged)
      
      return {
        success: true,
        imported: importedFavorites.length,
        total: merged.length
      }
    } catch (error) {
      console.error('导入收藏失败:', error)
      throw error
    }
  }
}

// 导出单例实例
const favoritesManager = new FavoritesManager()

module.exports = {
  favoritesManager,
  FavoritesManager
}
