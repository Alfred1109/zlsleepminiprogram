// pages/downloads/downloads.js
const app = getApp()
const AuthService = require('../../services/AuthService')
const { downloadManager } = require('../../utils/downloadManager')
const { UserAPI } = require('../../utils/healingApi')

Page({
  data: {
    loading: true,
    refreshing: false,
    isEmpty: false,
    downloads: [],
    filteredDownloads: [],
    
    // 搜索和筛选
    searchKeyword: '',
    filterStatus: 'all', // all, downloaded, downloading, failed
    showFilter: false,
    
    // 统计信息
    stats: {
      total: 0,
      downloaded: 0,
      downloading: 0,
      failed: 0,
      totalSize: 0 // 总大小(MB)
    },
    
    // 筛选选项
    statusOptions: [
      { value: 'all', label: '全部', icon: '📁' },
      { value: 'downloaded', label: '已下载', icon: '✅' },
      { value: 'downloading', label: '下载中', icon: '⏬' },
      { value: 'failed', label: '失败', icon: '❌' }
    ],
    
    // 批量操作
    isSelectMode: false,
    selectedItems: [],
    selectedItemsMap: {},
    selectAll: false,
    statusLabelMap: { all: '全部', downloaded: '已下载', downloading: '下载中', failed: '失败' }
  },

  onLoad() {
    this.loadDownloads()
  },

  onShow() {
    // 每次显示页面时重新加载，确保下载状态是最新的
    this.loadDownloads()
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadDownloads().finally(() => {
      wx.stopPullDownRefresh()
      this.setData({ refreshing: false })
    })
  },

  /**
   * 加载下载列表
   */
  async loadDownloads() {
    try {
      this.setData({ loading: true, isEmpty: false })

      // 检查登录状态
      if (!AuthService.isLoggedIn()) {
        wx.showModal({
          title: '需要登录',
          content: '请先登录后查看下载',
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

      // 使用真实的API获取用户下载列表
      const response = await UserAPI.getUserDownloads()
      
      if (response.success && response.data) {
        const downloads = response.data
        // 处理下载数据
        this.processDownloadData(downloads)
        this.applyFilters()
      } else {
        throw new Error(response.error || '获取下载列表失败')
      }

    } catch (error) {
      console.error('加载下载失败:', error)
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
   * 处理下载数据并生成统计信息
   */
  processDownloadData(downloads) {
    const stats = {
      total: downloads.length,
      downloaded: downloads.filter(item => item.status === 'downloaded').length,
      downloading: downloads.filter(item => item.status === 'downloading').length,
      failed: downloads.filter(item => item.status === 'failed').length,
      totalSize: downloads.reduce((total, item) => total + (item.fileSize || 0), 0)
    }

    this.setData({
      downloads: downloads,
      stats: stats,
      loading: false,
      isEmpty: downloads.length === 0
    })
  },

  /**
   * 应用搜索和筛选
   */
  applyFilters() {
    let filtered = [...this.data.downloads]

    // 应用状态筛选
    if (this.data.filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === this.data.filterStatus)
    }

    // 应用搜索关键词
    if (this.data.searchKeyword.trim()) {
      const keyword = this.data.searchKeyword.trim().toLowerCase()
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(keyword) ||
        item.subtitle.toLowerCase().includes(keyword)
      )
    }

    // 按下载时间排序（最新的在前）
    filtered.sort((a, b) => b.downloadTime - a.downloadTime)

    this.setData({
      filteredDownloads: filtered
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
   * 选择筛选状态
   */
  selectFilterStatus(e) {
    const status = e.currentTarget.dataset.status
    this.setData({
      filterStatus: status,
      showFilter: false
    })
    this.applyFilters()
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(sizeMB) {
    if (!sizeMB || sizeMB === 0) return '未知'
    
    if (sizeMB < 1) {
      return `${(sizeMB * 1024).toFixed(0)}KB`
    } else if (sizeMB < 1024) {
      return `${sizeMB.toFixed(1)}MB`
    } else {
      return `${(sizeMB / 1024).toFixed(1)}GB`
    }
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
   * 格式化下载时间
   */
  formatDownloadTime(timestamp) {
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
   * 点击下载项目
   */
  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    
    if (item.status === 'downloaded') {
      // 播放本地文件
      this.playLocalFile(item)
    } else if (item.status === 'downloading') {
      // 显示下载进度详情
      this.showDownloadProgress(item)
    } else if (item.status === 'failed') {
      // 重新下载
      this.retryDownload(item)
    }
  },

  /**
   * 播放本地文件
   */
  playLocalFile(item) {
    wx.navigateTo({
      url: `/pages/music/player/player?localPath=${encodeURIComponent(item.localPath)}&title=${encodeURIComponent(item.title)}`
    })
  },

  /**
   * 显示下载进度
   */
  showDownloadProgress(item) {
    wx.showModal({
      title: '下载进度',
      content: `${item.title}\n进度: ${item.progress}%\n大小: ${this.formatFileSize(item.fileSize)}`,
      showCancel: true,
      cancelText: '取消下载',
      confirmText: '后台下载',
      success: (res) => {
        if (res.cancel) {
          this.cancelDownload(item)
        }
      }
    })
  },

  /**
   * 重新下载
   */
  retryDownload(item) {
    wx.showModal({
      title: '重新下载',
      content: `下载失败: ${item.error || '未知错误'}\n是否重新下载"${item.title}"？`,
      confirmText: '重新下载',
      success: (res) => {
        if (res.confirm) {
          this.startDownload(item)
        }
      }
    })
  },

  /**
   * 开始下载
   */
  async startDownload(item) {
    try {
      // 使用真实的下载管理器
      await downloadManager.startDownload(item, {
        onProgress: (progress) => {
          // 更新进度
          this.updateDownloadProgress(item.id, progress)
        }
      })

      wx.showToast({
        title: '开始下载',
        icon: 'success'
      })

      // 重新加载下载列表
      this.loadDownloads()
    } catch (error) {
      console.error('开始下载失败:', error)
      wx.showToast({
        title: '下载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 更新下载进度（替代高频定时器）
   */
  updateDownloadProgress(downloadId, progress) {
    // 使用节流，避免过于频繁的setData调用
    if (!this._progressUpdateThrottle) {
      this._progressUpdateThrottle = {}
    }
    
    // 限制每个下载任务最多每2秒更新一次进度
    const now = Date.now()
    const lastUpdate = this._progressUpdateThrottle[downloadId] || 0
    if (now - lastUpdate < 2000 && progress < 100) {
      return // 跳过过于频繁的更新
    }
    
    this._progressUpdateThrottle[downloadId] = now

    const downloads = this.data.downloads.map(download => {
      if (download.id === downloadId) {
        return {
          ...download,
          progress: progress,
          status: progress >= 100 ? 'downloaded' : 'downloading'
        }
      }
      return download
    })

    this.processDownloadData(downloads)
    this.applyFilters()
  },

  /**
   * 取消下载
   */
  cancelDownload(item) {
    try {
      // 使用真实的下载管理器取消下载
      downloadManager.cancelDownload(item.id)
      
      // 重新加载下载列表
      this.loadDownloads()

      wx.showToast({
        title: '已取消下载',
        icon: 'none'
      })
    } catch (error) {
      console.error('取消下载失败:', error)
      wx.showToast({
        title: '取消失败',
        icon: 'none'
      })
    }
  },

  /**
   * 删除下载项目
   */
  onDeleteItem(e) {
    const item = e.currentTarget.dataset.item
    
    wx.showModal({
      title: '删除下载',
      content: `确定要删除"${item.title}"吗？${item.status === 'downloaded' ? '本地文件也会被删除。' : ''}`,
      confirmText: '删除',
      confirmColor: '#FF5722',
      success: (res) => {
        if (res.confirm) {
          this.deleteDownloadItem(item.id)
        }
      }
    })
  },

  /**
   * 删除下载项目
   */
  deleteDownloadItem(itemId) {
    try {
      const downloads = this.data.downloads.filter(item => item.id !== itemId)
      
      // 更新本地存储
      wx.setStorageSync('userDownloads', downloads)
      
      // 更新页面数据
      this.processDownloadData(downloads)
      this.applyFilters()
      
      wx.showToast({
        title: '已删除',
        icon: 'success'
      })
      
    } catch (error) {
      console.error('删除下载失败:', error)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    }
  },

  /**
   * 切换选择模式
   */
  toggleSelectMode() {
    this.setData({
      isSelectMode: !this.data.isSelectMode,
      selectedItems: [],
      selectAll: false
    })
  },

  /**
   * 选择/取消选择项目
   */
  onSelectItem(e) {
    const itemId = e.currentTarget.dataset.id
    const map = { ...(this.data.selectedItemsMap || {}) }
    if (map[itemId]) {
      delete map[itemId]
    } else {
      map[itemId] = true
    }
    const selectedItems = Object.keys(map)
    this.setData({ selectedItems, selectedItemsMap: map, selectAll: selectedItems.length === this.data.filteredDownloads.length })
  },

  /**
   * 全选/取消全选
   */
  onSelectAll() {
    if (this.data.selectAll) {
      this.setData({
        selectedItems: [],
        selectAll: false
      })
    } else {
      this.setData({
        selectedItems: this.data.filteredDownloads.map(item => item.id),
        selectAll: true
      })
    }
  },

  /**
   * 批量删除
   */
  onBatchDelete() {
    if (this.data.selectedItems.length === 0) {
      wx.showToast({
        title: '请选择要删除的项目',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '批量删除',
      content: `确定要删除选中的 ${this.data.selectedItems.length} 个下载项目吗？`,
      confirmText: '删除',
      confirmColor: '#FF5722',
      success: (res) => {
        if (res.confirm) {
          this.batchDeleteItems()
        }
      }
    })
  },

  /**
   * 执行批量删除
   */
  batchDeleteItems() {
    try {
      const downloads = this.data.downloads.filter(item => 
        !this.data.selectedItems.includes(item.id)
      )
      
      // 更新本地存储
      wx.setStorageSync('userDownloads', downloads)
      
      // 更新页面数据
      this.processDownloadData(downloads)
      this.applyFilters()
      
      // 退出选择模式
      this.setData({
        isSelectMode: false,
        selectedItems: [],
        selectAll: false
      })
      
      wx.showToast({
        title: '批量删除完成',
        icon: 'success'
      })
      
    } catch (error) {
      console.error('批量删除失败:', error)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    }
  },

  /**
   * 清理失败的下载
   */
  onClearFailed() {
    const failedCount = this.data.downloads.filter(item => item.status === 'failed').length
    
    if (failedCount === 0) {
      wx.showToast({
        title: '没有失败的下载',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '清理失败下载',
      content: `确定要清理 ${failedCount} 个失败的下载项目吗？`,
      confirmText: '清理',
      success: (res) => {
        if (res.confirm) {
          const downloads = this.data.downloads.filter(item => item.status !== 'failed')
          this.processDownloadData(downloads)
          this.applyFilters()
          
          wx.showToast({
            title: '清理完成',
            icon: 'success'
          })
        }
      }
    })
  }
})
