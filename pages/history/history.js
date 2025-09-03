// pages/history/history.js
const app = getApp()
const AuthService = require('../../services/AuthService')
const api = require('../../utils/api')

Page({
  data: {
    history: [],
    filteredHistory: [], // 筛选后的历史记录
    loading: true,
    error: null,
    userInfo: null,
    isEmpty: false,
    refresherTriggered: false,
    
    // 搜索相关
    searchKeyword: '',
    
    // 筛选相关
    showFilter: false,
    filterCategory: '',
    filterDate: '',
    filterDateText: '',
    categoryOptions: [],
    
    // 统计相关
    showStats: false,
    stats: {
      totalCount: 0,
      totalDuration: '',
      topCategory: '',
      avgDuration: ''
    }
  },

  onLoad: function () {
    this.checkLoginAndLoadHistory()
  },

  onShow: function() {
    // 每次显示页面时重新加载历史记录
    if (this.data.userInfo) {
      this.loadPlayHistory()
    }
  },

  /**
   * 检查登录状态并加载历史记录
   */
  checkLoginAndLoadHistory: function() {
    try {
      const userInfo = AuthService.getCurrentUser()
      const loggedIn = !!userInfo

      if (!loggedIn) {
        wx.showModal({
          title: '请先登录',
          content: '需要登录才能查看播放历史',
          confirmText: '去登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({
                url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/history/history')
              })
            } else {
              wx.navigateBack()
            }
          }
        })
        return
      }

      this.setData({
        userInfo: userInfo
      })

      this.loadPlayHistory()
    } catch (error) {
      console.error('检查登录状态失败:', error)
      this.setData({
        loading: false,
        error: '检查登录状态失败'
      })
    }
  },

  /**
   * 加载播放历史记录
   */
  loadPlayHistory: function() {
    this.setData({ 
      loading: true, 
      error: null,
      refresherTriggered: false
    })

    api.request({
      url: '/play-records/recent',
      method: 'GET',
      data: {
        limit: 100,  // 增加到100条记录
        days: 90     // 增加到90天
      },
      showLoading: false
    }).then((result) => {
      if (result.success) {
        const historyData = result.data || []
        
        this.setData({
          history: historyData,
          isEmpty: historyData.length === 0,
          loading: false
        })
        
        // 处理数据并更新相关状态
        this.processHistoryData(historyData)
        this.applyFilters()
      } else {
        throw new Error(result.error || '获取播放历史失败')
      }
    }).catch((error) => {
      console.error('加载播放历史失败:', error)
      this.setData({
        loading: false,
        error: error.message || '加载播放历史失败',
        isEmpty: true,
        refresherTriggered: false
      })
      
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    })
  },

  /**
   * 处理历史数据（提取分类选项、计算统计信息等）
   */
  processHistoryData: function(historyData) {
    // 提取分类选项
    const categorySet = new Set()
    let totalPlayTime = 0
    const categoryCount = {}

    historyData.forEach(item => {
      if (item.category) {
        categorySet.add(item.category)
        categoryCount[item.category] = (categoryCount[item.category] || 0) + 1
      }
      
      // 解析播放时长（假设格式为 "2分30秒" 或 "30秒"）
      if (item.duration) {
        const duration = this.parseDuration(item.duration)
        totalPlayTime += duration
      }
    })

    // 找出最常听的分类
    let topCategory = '暂无'
    let maxCount = 0
    Object.keys(categoryCount).forEach(category => {
      if (categoryCount[category] > maxCount) {
        maxCount = categoryCount[category]
        topCategory = category
      }
    })

    // 计算统计信息
    const stats = {
      totalCount: historyData.length,
      totalDuration: this.formatDuration(totalPlayTime),
      topCategory: topCategory,
      avgDuration: historyData.length > 0 ? this.formatDuration(Math.floor(totalPlayTime / historyData.length)) : '0秒'
    }

    this.setData({
      categoryOptions: Array.from(categorySet),
      stats: stats
    })
  },

  /**
   * 解析时长字符串为秒数
   */
  parseDuration: function(durationStr) {
    if (!durationStr || typeof durationStr !== 'string') return 0
    
    let totalSeconds = 0
    
    // 匹配 "2分30秒" 格式
    const minuteMatch = durationStr.match(/(\d+)分/)
    const secondMatch = durationStr.match(/(\d+)秒/)
    
    if (minuteMatch) {
      totalSeconds += parseInt(minuteMatch[1]) * 60
    }
    if (secondMatch) {
      totalSeconds += parseInt(secondMatch[1])
    }
    
    return totalSeconds
  },

  /**
   * 格式化时长为可读字符串
   */
  formatDuration: function(seconds) {
    if (seconds < 60) {
      return `${seconds}秒`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
    }
  },

  /**
   * 重新播放音乐
   */
  playAgain: function (e) {
    const record = e.currentTarget.dataset.record
    if (!record) return

    console.log('重新播放:', record)

    // 根据content_type决定跳转页面
    switch (record.content_type) {
      case 'healing_resource':
      case 'preset_music':
        // 跳转到播放页面
        wx.navigateTo({
          url: `/pages/play/play?id=${record.content_id}&title=${encodeURIComponent(record.soundName)}`
        })
        break
      
      case 'generated_music':
        // 跳转到音乐播放器页面
        wx.navigateTo({
          url: `/pages/music/player/player?id=${record.content_id}`
        })
        break
      
      default:
        // 默认跳转到首页，让用户重新选择
        wx.switchTab({
          url: '/pages/index/index'
        })
        wx.showToast({
          title: '将为您重新推荐',
          icon: 'none'
        })
    }
  },

  /**
   * 删除播放记录
   */
  deleteRecord: function (e) {
    const record = e.currentTarget.dataset.record
    if (!record) return

    wx.showModal({
      title: '删除记录',
      content: `确定要删除"${record.soundName}"的播放记录吗？`,
      confirmText: '删除',
      confirmColor: '#FF5722',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.performDeleteRecord(record.id)
        }
      }
    })
  },

  /**
   * 执行删除记录
   */
  performDeleteRecord: function(recordId) {
    wx.showLoading({ title: '删除中...' })

    api.request({
      url: `/play-records/${recordId}`,
      method: 'DELETE'
    }).then((result) => {
      wx.hideLoading()
      
      if (result.success) {
        // 从列表中移除删除的记录
        const newHistory = this.data.history.filter(item => item.id !== recordId)
        this.setData({ 
          history: newHistory,
          isEmpty: newHistory.length === 0
        })
        
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
      } else {
        throw new Error(result.error || '删除失败')
      }
    }).catch((error) => {
      wx.hideLoading()
      console.error('删除播放记录失败:', error)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    })
  },

  /**
   * 刷新历史记录
   */
  onRefresh: function() {
    this.loadPlayHistory()
  },

  /**
   * 清空所有历史记录
   */
  onClearAll: function() {
    if (this.data.history.length === 0) {
      wx.showToast({
        title: '暂无记录',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '清空历史',
      content: '确定要清空所有播放历史记录吗？此操作不可恢复。',
      confirmText: '清空',
      confirmColor: '#FF5722',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.performClearAll()
        }
      }
    })
  },

  /**
   * 执行清空所有记录
   */
  performClearAll: function() {
    wx.showLoading({ title: '清空中...' })

    // 批量删除所有记录
    const deletePromises = this.data.history.map(record => {
      return api.request({
        url: `/play-records/${record.id}`,
        method: 'DELETE',
        showLoading: false
      })
    })

    Promise.allSettled(deletePromises).then(() => {
      wx.hideLoading()
      this.setData({
        history: [],
        isEmpty: true
      })
      
      wx.showToast({
        title: '清空成功',
        icon: 'success'
      })
    }).catch((error) => {
      wx.hideLoading()
      console.error('清空历史记录失败:', error)
      wx.showToast({
        title: '清空失败',
        icon: 'none'
      })
    })
  },

  /**
   * 跳转到首页
   */
  goToHome: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 过滤器缓存
  _lastFilterParams: null,
  _lastFilterResult: null,

  /**
   * 应用筛选条件（优化版：一次遍历完成所有过滤，带缓存）
   */
  applyFilters: function() {
    const currentParams = {
      keyword: this.data.searchKeyword,
      category: this.data.filterCategory,
      date: this.data.filterDate,
      historyLength: this.data.history.length
    }

    // 检查缓存
    if (this._lastFilterParams && 
        this._lastFilterResult &&
        JSON.stringify(currentParams) === JSON.stringify(this._lastFilterParams)) {
      this.setData({ filteredHistory: this._lastFilterResult })
      return
    }

    // 预处理日期筛选条件
    let dateFilter = null
    if (this.data.filterDate) {
      const now = new Date()
      switch (this.data.filterDate) {
        case 'today':
          dateFilter = (itemDate) => this.isSameDay(itemDate, now)
          break
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          dateFilter = (itemDate) => itemDate >= weekAgo
          break
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          dateFilter = (itemDate) => itemDate >= monthAgo
          break
      }
    }

    const keyword = this.data.searchKeyword ? this.data.searchKeyword.toLowerCase() : null

    // 一次性遍历完成所有筛选
    const filtered = this.data.history.filter(item => {
      // 搜索关键词筛选
      if (keyword) {
        const matchKeyword = (item.soundName && item.soundName.toLowerCase().includes(keyword)) ||
                           (item.category && item.category.toLowerCase().includes(keyword))
        if (!matchKeyword) return false
      }

      // 分类筛选
      if (this.data.filterCategory && item.category !== this.data.filterCategory) {
        return false
      }

      // 日期筛选
      if (dateFilter) {
        if (!item.date) return false
        const itemDate = new Date(item.date)
        if (!dateFilter(itemDate)) return false
      }

      return true
    })

    // 更新缓存
    this._lastFilterParams = currentParams
    this._lastFilterResult = filtered

    this.setData({
      filteredHistory: filtered
    })
  },

  /**
   * 判断是否是同一天
   */
  isSameDay: function(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  },

  /**
   * 搜索输入处理
   */
  onSearchInput: function(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
    this.applyFilters()
  },

  /**
   * 清除搜索
   */
  clearSearch: function() {
    this.setData({
      searchKeyword: ''
    })
    this.applyFilters()
  },

  /**
   * 切换统计显示
   */
  toggleStats: function() {
    this.setData({
      showStats: !this.data.showStats
    })
  },

  /**
   * 切换筛选器显示
   */
  toggleFilter: function() {
    this.setData({
      showFilter: !this.data.showFilter
    })
  },

  /**
   * 选择筛选分类
   */
  selectFilterCategory: function(e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      filterCategory: category
    })
  },

  /**
   * 选择筛选日期
   */
  selectFilterDate: function(e) {
    const date = e.currentTarget.dataset.date
    let dateText = ''
    
    switch (date) {
      case 'today':
        dateText = '今天'
        break
      case 'week':
        dateText = '本周'
        break
      case 'month':
        dateText = '本月'
        break
      default:
        dateText = ''
    }
    
    this.setData({
      filterDate: date,
      filterDateText: dateText
    })
  },

  /**
   * 重置筛选条件
   */
  resetFilter: function() {
    this.setData({
      filterCategory: '',
      filterDate: '',
      filterDateText: ''
    })
  },

  /**
   * 应用筛选（关闭筛选面板并应用筛选）
   */
  applyFilter: function() {
    this.applyFilters()
    this.setData({
      showFilter: false
    })
  },

  /**
   * 清除所有筛选条件
   */
  clearAllFilters: function() {
    this.setData({
      searchKeyword: '',
      filterCategory: '',
      filterDate: '',
      filterDateText: '',
      showFilter: false
    })
    this.applyFilters()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function() {
    console.log('下拉刷新播放历史')
    this.setData({ refresherTriggered: true })
    this.loadPlayHistory()
  }
})
