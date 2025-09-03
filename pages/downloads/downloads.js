// pages/downloads/downloads.js
const app = getApp()
const AuthService = require('../../services/AuthService')

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
    selectAll: false
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

      // 从本地存储加载下载数据
      const storedDownloads = wx.getStorageSync('userDownloads') || []
      
      // 如果没有本地数据，生成模拟数据
      let downloads = storedDownloads
      if (downloads.length === 0) {
        downloads = this.generateMockDownloads()
      }

      // 更新下载状态 - 检查文件是否实际存在
      downloads = await this.updateDownloadStatus(downloads)

      // 处理下载数据
      this.processDownloadData(downloads)
      this.applyFilters()

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
   * 生成模拟下载数据
   */
  generateMockDownloads() {
    const mockData = [
      {
        id: 'dl_1',
        title: '深度放松冥想音乐',
        subtitle: '舒缓 | 冥想类',
        cover: '/assets/images/sounds/meditation.jpg',
        fileSize: 15.6, // MB
        duration: 360,
        status: 'downloaded', // downloaded, downloading, failed
        progress: 100,
        downloadTime: Date.now() - 86400000, // 1天前
        localPath: 'tmp/music_1.mp3',
        url: 'https://example.com/music/meditation.mp3',
        fileType: 'audio'
      },
      {
        id: 'dl_2',
        title: '个性化长序列音乐',
        subtitle: '基于心率变异性生成',
        cover: '/assets/images/sounds/nature.jpg',
        fileSize: 42.3,
        duration: 1800,
        status: 'downloading',
        progress: 67,
        downloadTime: Date.now() - 3600000, // 1小时前
        localPath: '',
        url: 'https://example.com/sequence/long_123.mp3',
        fileType: 'audio'
      },
      {
        id: 'dl_3',
        title: '自然白噪音',
        subtitle: '自然 | 白噪音类',
        cover: '/assets/images/sounds/rain.jpg',
        fileSize: 18.9,
        duration: 420,
        status: 'failed',
        progress: 0,
        downloadTime: Date.now() - 172800000, // 2天前
        localPath: '',
        url: 'https://example.com/music/whitenoise.mp3',
        fileType: 'audio',
        error: '网络连接超时'
      },
      {
        id: 'dl_4',
        title: '专注力训练音频',
        subtitle: '认知 | 训练类',
        cover: '/assets/images/sounds/focus.jpg',
        fileSize: 25.1,
        duration: 600,
        status: 'downloaded',
        progress: 100,
        downloadTime: Date.now() - 259200000, // 3天前
        localPath: 'tmp/music_4.mp3',
        url: 'https://example.com/music/focus.mp3',
        fileType: 'audio'
      }
    ]
    
    return mockData
  },

  /**
   * 更新下载状态
   */
  async updateDownloadStatus(downloads) {
    // 这里应该检查本地文件是否存在，更新实际状态
    // 由于小程序的限制，这里只是模拟状态更新
    
    for (let download of downloads) {
      if (download.status === 'downloading') {
        // 模拟下载进度更新
        if (download.progress < 100) {
          download.progress = Math.min(100, download.progress + Math.random() * 10)
          if (download.progress >= 100) {
            download.status = 'downloaded'
            download.localPath = `tmp/${download.id}.mp3`
          }
        }
      }
    }
    
    return downloads
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

    // 保存到本地存储
    wx.setStorageSync('userDownloads', downloads)
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
  startDownload(item) {
    // 更新状态为下载中
    const downloads = this.data.downloads.map(download => {
      if (download.id === item.id) {
        return {
          ...download,
          status: 'downloading',
          progress: 0,
          error: '',
          downloadTime: Date.now()
        }
      }
      return download
    })

    this.processDownloadData(downloads)
    this.applyFilters()

    // 模拟下载过程
    this.simulateDownload(item.id)

    wx.showToast({
      title: '开始下载',
      icon: 'success'
    })
  },

  /**
   * 模拟下载过程
   */
  simulateDownload(downloadId) {
    const interval = setInterval(() => {
      const downloads = this.data.downloads.map(download => {
        if (download.id === downloadId && download.status === 'downloading') {
          const newProgress = Math.min(100, download.progress + Math.random() * 15 + 5)
          return {
            ...download,
            progress: newProgress,
            status: newProgress >= 100 ? 'downloaded' : 'downloading',
            localPath: newProgress >= 100 ? `tmp/${downloadId}.mp3` : ''
          }
        }
        return download
      })

      this.processDownloadData(downloads)
      this.applyFilters()

      // 检查是否下载完成
      const targetDownload = downloads.find(d => d.id === downloadId)
      if (!targetDownload || targetDownload.status !== 'downloading') {
        clearInterval(interval)
        if (targetDownload && targetDownload.status === 'downloaded') {
          wx.showToast({
            title: '下载完成',
            icon: 'success'
          })
        }
      }
    }, 1000)
  },

  /**
   * 取消下载
   */
  cancelDownload(item) {
    const downloads = this.data.downloads.map(download => {
      if (download.id === item.id) {
        return {
          ...download,
          status: 'failed',
          progress: 0,
          error: '用户取消下载'
        }
      }
      return download
    })

    this.processDownloadData(downloads)
    this.applyFilters()

    wx.showToast({
      title: '已取消下载',
      icon: 'none'
    })
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
    const selectedItems = [...this.data.selectedItems]
    const index = selectedItems.indexOf(itemId)
    
    if (index > -1) {
      selectedItems.splice(index, 1)
    } else {
      selectedItems.push(itemId)
    }
    
    this.setData({
      selectedItems: selectedItems,
      selectAll: selectedItems.length === this.data.filteredDownloads.length
    })
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
