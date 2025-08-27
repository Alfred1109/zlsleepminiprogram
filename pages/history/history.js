// pages/history/history.js
const app = getApp()
const AuthService = require('../../services/AuthService')
const api = require('../../utils/api')

Page({
  data: {
    history: [],
    loading: true,
    error: null,
    userInfo: null,
    isEmpty: false
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
      error: null 
    })

    api.request({
      url: '/play-records/recent',
      method: 'GET',
      data: {
        limit: 50,  // 最近50条记录
        days: 30    // 最近30天
      },
      showLoading: false
    }).then((result) => {
      if (result.success) {
        this.setData({
          history: result.data || [],
          isEmpty: (result.data || []).length === 0,
          loading: false
        })
      } else {
        throw new Error(result.error || '获取播放历史失败')
      }
    }).catch((error) => {
      console.error('加载播放历史失败:', error)
      this.setData({
        loading: false,
        error: error.message || '加载播放历史失败',
        isEmpty: true
      })
      
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    })
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
  }
})
