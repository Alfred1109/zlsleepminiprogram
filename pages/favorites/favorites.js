// pages/favorites/favorites.js
const app = getApp()
const api = require('../../utils/api')
const AuthService = require('../../services/AuthService')

Page({
  data: {
    loading: true,
    refreshing: false,
    isEmpty: false,
    favorites: [],
    filteredFavorites: [],
    
    // 搜索和筛选
    searchKeyword: '',
    filterType: 'all', // all, music, assessment, sequence
    showFilter: false,
    
    // 统计信息
    stats: {
      total: 0,
      musicCount: 0,
      assessmentCount: 0,
      sequenceCount: 0
    },
    
    // 筛选选项
    typeOptions: [
      { value: 'all', label: '全部', icon: '📁' },
      { value: 'music', label: '音乐', icon: '🎵' },
      { value: 'assessment', label: '评测', icon: '📊' },
      { value: 'sequence', label: '长序列', icon: '🎼' }
    ]
  },

  onLoad() {
    this.loadFavorites()
  },

  onShow() {
    // 每次显示页面时重新加载，确保数据是最新的
    this.loadFavorites()
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadFavorites().finally(() => {
      wx.stopPullDownRefresh()
      this.setData({ refreshing: false })
    })
  },

  /**
   * 加载收藏列表
   */
  async loadFavorites() {
    try {
      this.setData({ loading: true, isEmpty: false })

      // 检查登录状态
      if (!AuthService.isLoggedIn()) {
        wx.showModal({
          title: '需要登录',
          content: '请先登录后查看收藏',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              wx.navigateBack()
              wx.navigateTo({ url: '/pages/login/login' })
            } else {
              wx.navigateBack()
            }
          }
        })
        return
      }

      // 从本地存储加载收藏数据
      const storedFavorites = wx.getStorageSync('userFavorites') || []
      
      // 如果没有本地数据，尝试从服务器获取
      let favorites = storedFavorites
      if (favorites.length === 0) {
        // 这里可以调用API获取服务器端的收藏数据
        // const result = await api.request({
        //   url: '/user/favorites',
        //   method: 'GET',
        //   showLoading: false
        // })
        // favorites = result.success ? result.data : []
        favorites = this.generateMockFavorites() // 暂时使用模拟数据
      }

      // 处理收藏数据
      this.processFavoritesData(favorites)
      this.applyFilters()

    } catch (error) {
      console.error('加载收藏失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({
        loading: false,
        isEmpty: true
      })
    }
  },

  /**
   * 生成模拟收藏数据
   */
  generateMockFavorites() {
    const mockData = [
      {
        id: 'fav_1',
        type: 'music',
        title: '深度放松冥想音乐',
        subtitle: '舒缓 | 冥想类',
        cover: '/assets/images/sounds/meditation.jpg',
        duration: 360,
        favoriteTime: Date.now() - 86400000, // 1天前
        metadata: {
          category: '冥想',
          tags: ['放松', '冥想', '深度睡眠']
        }
      },
      {
        id: 'fav_2',
        type: 'assessment',
        title: '睡眠质量评测',
        subtitle: '评测结果：轻度失眠',
        cover: '/images/assessment.svg',
        favoriteTime: Date.now() - 172800000, // 2天前
        metadata: {
          score: 65,
          level: '轻度失眠'
        }
      },
      {
        id: 'fav_3',
        type: 'sequence',
        title: '个性化长序列音乐',
        subtitle: '基于心率变异性生成',
        cover: '/assets/images/sounds/nature.jpg',
        duration: 1800,
        favoriteTime: Date.now() - 259200000, // 3天前
        metadata: {
          sessionId: 'seq_123',
          hrv_data: '已关联'
        }
      },
      {
        id: 'fav_4',
        type: 'music',
        title: '自然白噪音',
        subtitle: '自然 | 白噪音类',
        cover: '/assets/images/sounds/rain.jpg',
        duration: 420,
        favoriteTime: Date.now() - 345600000, // 4天前
        metadata: {
          category: '自然',
          tags: ['白噪音', '雨声', '专注']
        }
      }
    ]
    
    return mockData
  },

  /**
   * 处理收藏数据并生成统计信息
   */
  processFavoritesData(favorites) {
    const stats = {
      total: favorites.length,
      musicCount: favorites.filter(item => item.type === 'music').length,
      assessmentCount: favorites.filter(item => item.type === 'assessment').length,
      sequenceCount: favorites.filter(item => item.type === 'sequence').length
    }

    this.setData({
      favorites: favorites,
      stats: stats,
      loading: false,
      isEmpty: favorites.length === 0
    })
  },

  /**
   * 应用搜索和筛选
   */
  applyFilters() {
    let filtered = [...this.data.favorites]

    // 应用类型筛选
    if (this.data.filterType !== 'all') {
      filtered = filtered.filter(item => item.type === this.data.filterType)
    }

    // 应用搜索关键词
    if (this.data.searchKeyword.trim()) {
      const keyword = this.data.searchKeyword.trim().toLowerCase()
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(keyword) ||
        item.subtitle.toLowerCase().includes(keyword) ||
        (item.metadata.tags && item.metadata.tags.some(tag => tag.toLowerCase().includes(keyword)))
      )
    }

    // 按收藏时间排序（最新的在前）
    filtered.sort((a, b) => b.favoriteTime - a.favoriteTime)

    this.setData({
      filteredFavorites: filtered
    })
  },

  /**
   * 搜索输入处理
   */
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
    this.applyFilters()
  },

  /**
   * 清除搜索
   */
  clearSearch() {
    this.setData({
      searchKeyword: ''
    })
    this.applyFilters()
  },

  /**
   * 切换筛选面板
   */
  toggleFilter() {
    this.setData({
      showFilter: !this.data.showFilter
    })
  },

  /**
   * 选择筛选类型
   */
  selectFilterType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      filterType: type,
      showFilter: false
    })
    this.applyFilters()
  },

  /**
   * 格式化时长
   */
  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '未知'
    
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes < 60) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }
  },

  /**
   * 格式化收藏时间
   */
  formatFavoriteTime(timestamp) {
    const now = Date.now()
    const diff = now - timestamp
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    
    if (days === 0) {
      const hours = Math.floor(diff / (60 * 60 * 1000))
      if (hours === 0) {
        const minutes = Math.floor(diff / (60 * 1000))
        return minutes <= 1 ? '刚刚' : `${minutes}分钟前`
      }
      return `${hours}小时前`
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return new Date(timestamp).toLocaleDateString()
    }
  },

  /**
   * 点击收藏项目
   */
  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    
    if (item.type === 'music') {
      // 跳转到音乐播放器
      wx.navigateTo({
        url: `/pages/music/player/player?id=${item.id}&title=${encodeURIComponent(item.title)}`
      })
    } else if (item.type === 'assessment') {
      // 跳转到评测结果页面
      wx.navigateTo({
        url: `/pages/assessment/result/result?id=${item.id}`
      })
    } else if (item.type === 'sequence') {
      // 跳转到长序列播放器
      wx.navigateTo({
        url: `/pages/longSequence/player/player?sessionId=${item.metadata.sessionId}`
      })
    }
  },

  /**
   * 取消收藏
   */
  onRemoveFavorite(e) {
    const item = e.currentTarget.dataset.item
    
    wx.showModal({
      title: '取消收藏',
      content: `确定要取消收藏"${item.title}"吗？`,
      confirmText: '取消收藏',
      confirmColor: '#FF5722',
      success: (res) => {
        if (res.confirm) {
          this.removeFavoriteItem(item.id)
        }
      }
    })
  },

  /**
   * 移除收藏项目
   */
  removeFavoriteItem(itemId) {
    try {
      const favorites = this.data.favorites.filter(item => item.id !== itemId)
      
      // 更新本地存储
      wx.setStorageSync('userFavorites', favorites)
      
      // 更新页面数据
      this.processFavoritesData(favorites)
      this.applyFilters()
      
      wx.showToast({
        title: '已取消收藏',
        icon: 'success'
      })
      
      // 可以在这里调用API同步到服务器
      // this.syncFavoritesToServer(favorites)
      
    } catch (error) {
      console.error('取消收藏失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  /**
   * 分享收藏项目
   */
  onShareItem(e) {
    const item = e.currentTarget.dataset.item
    
    // 这里可以实现分享功能
    wx.showActionSheet({
      itemList: ['分享给好友', '生成分享链接', '复制标题'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            // 分享给好友的逻辑
            wx.showToast({ title: '分享功能开发中', icon: 'none' })
            break
          case 1:
            // 生成分享链接的逻辑
            wx.showToast({ title: '链接已复制', icon: 'success' })
            break
          case 2:
            // 复制标题
            wx.setClipboardData({
              data: item.title,
              success: () => {
                wx.showToast({ title: '标题已复制', icon: 'success' })
              }
            })
            break
        }
      }
    })
  }
})
