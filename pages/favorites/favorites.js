// pages/favorites/favorites.js
const app = getApp()
const api = require('../../utils/api')
const AuthService = require('../../services/AuthService')
const { UserAPI } = require('../../utils/healingApi')

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
    ],
    typeLabelMap: { all: '全部', music: '音乐', assessment: '评测', sequence: '长序列' },
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null
  },

  onLoad() {
    this.initTheme()
    this.loadFavorites()
  },

  onShow() {
    // 每次显示页面时重新加载，确保数据是最新的
    this.loadFavorites()
  },

  /**
   * 初始化主题
   */
  initTheme() {
    try {
      const app = getApp();
      if (app.globalData && app.globalData.currentTheme) {
        this.setData({
          currentTheme: app.globalData.currentTheme,
          themeClass: app.globalData.themeConfig?.class || '',
          themeConfig: app.globalData.themeConfig
        });
      }
    } catch (error) {
      console.error('初始化主题失败:', error);
    }
  },

  /**
   * 主题切换事件处理
   */
  onThemeChange(e) {
    try {
      if (!e || !e.detail) return;
      const { theme, config } = e.detail;
      if (!theme || !config) return;

      this.setData({
        currentTheme: theme,
        themeClass: config.class || '',
        themeConfig: config
      });
    } catch (error) {
      console.error('主题切换处理失败:', error);
    }
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
      const isLoggedIn = AuthService.isLoggedIn()
      const currentUser = AuthService.getCurrentUser()
      const token = AuthService.getAccessToken()
      
      console.log('🔍 收藏页面认证状态检查:', {
        isLoggedIn,
        hasUser: !!currentUser,
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'none'
      })
      
      if (!isLoggedIn) {
        console.log('❌ 用户未登录，显示登录提示')
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
      
      console.log('✅ 认证检查通过，开始调用API')
      
      // 临时添加：测试token服务器端有效性
      console.log('🧪 测试token服务器端有效性...')
      const tokenTest = await AuthService.testTokenValidity()
      console.log('🔍 Token服务器验证结果:', tokenTest)

      // 使用真实的API获取用户收藏列表
      const response = await UserAPI.getUserFavorites()
      
      if (response.success && response.data) {
        const favorites = response.data
        // 处理收藏数据
        this.processFavoritesData(favorites)
        this.applyFilters()
      } else {
        throw new Error(response.error || '获取收藏列表失败')
      }

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
