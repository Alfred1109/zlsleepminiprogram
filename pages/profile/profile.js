// pages/profile/profile.js
const app = getApp()
const AuthService = require('../../services/AuthService')
const { UserAPI } = require('../../utils/healingApi')
const { getSubscriptionInfo } = require('../../utils/subscription')
// const unifiedLoginManager = require('../../utils/unifiedLoginManager') // 已迁移到 AuthService

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    isLoggedIn: false,

    // 统计数据
    stats: {
      assessmentCount: 0,
      musicCount: 0,
      totalListenTime: 0,
      consecutiveDays: 0
    },

    // 设置选项
    settings: {
      theme: 'light',
      volume: 0.7,
      autoSleep: 30,
      vibrationEnabled: true,
      notificationEnabled: true
    },

    // 新增：用户资料编辑相关
    hasChanges: false,
    saving: false,
    tempAvatar: '',
    tempNickname: '',

    syncing: false,
    lastSyncAt: 0,

    // 订阅状态
    subscriptionStatus: {
      type: 'free',
      displayName: '免费用户',
      expiresAt: null,
      daysLeft: 0,
      features: [],
      showUpgrade: false,
      statusColor: '#999',
      statusIcon: '👤'
    }
  },

  onLoad: function () {
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }

    this.checkLoginStatus()
    this.loadUserStats()
    this.loadSettings()
  },

  onShow() {
    this.checkLoginStatus()
    this.loadUserStats()
    this.loadSubscriptionStatus()
  },

  /**
   * 同步微信昵称与头像
   */
  async onSyncWechatProfile() {
    // 节流：5秒内只允许一次
    const now = Date.now()
    if (now - (this.data.lastSyncAt || 0) < 5000 || this.data.syncing) {
      wx.showToast({ title: '操作太频繁，请稍候', icon: 'none' })
      return
    }

    this.setData({ syncing: true })

    try {
      if (!AuthService.getCurrentUser()) {
        this.showLoginTip()
        return
      }

      // 确保有有效token（必要时自动刷新/登录）
      try {
        await AuthService.ensureValidToken()
      } catch (e) {
        try {
          // 触发一次微信登录获取可用token（已经不请求用户信息）
          const result = await AuthService.wechatLogin()
          if (!result || !result.success) throw new Error('登录失败')
        } catch (e2) {
          wx.showToast({ title: '请先完成微信登录', icon: 'none' })
          return
        }
      }

      // 获取微信用户信息
      const profile = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: resolve,
          fail: reject
        })
      })

      const user = AuthService.getCurrentUser() || {}
      const res = await UserAPI.updateUserInfo({
        user_id: user.id,
        nickname: profile.userInfo.nickName,
        avatar_url: profile.userInfo.avatarUrl
      })

      if (res && res.success) {
        const updated = {
          ...user,
          nickname: res.data.nickname,
          avatar_url: res.data.avatar_url
        }
        // 同时保存到两个key以保证兼容性
        wx.setStorageSync('userInfo', updated)    // 兼容旧代码
        wx.setStorageSync('user_info', updated)   // tokenManager期望的key
        this.setData({ userInfo: updated, hasUserInfo: true, lastSyncAt: now })
        wx.showToast({ title: '已同步微信资料', icon: 'success' })
      } else {
        wx.showToast({ title: res?.message || '同步失败', icon: 'none' })
      }
    } catch (e) {
      const msg = (e && e.errMsg) || ''
      if (msg.includes('too frequently')) {
        wx.showToast({ title: '操作太频繁，请稍候再试', icon: 'none' })
      } else {
        wx.showToast({ title: '同步失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ syncing: false })
    }
  },

  /**
   * 格式化日期
   */
  formatDate(dateString) {
    if (!dateString) return '未知'

    try {
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')

      return `${year}-${month}-${day} ${hours}:${minutes}`
    } catch (error) {
      console.error('日期格式化失败:', error)
      return dateString
    }
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const loggedIn = AuthService.isLoggedIn()
    const userInfo = AuthService.getCurrentUser()

    this.setData({
      isLoggedIn: loggedIn,
      userInfo: userInfo || {
        avatarUrl: '/images/default-avatar.svg',
        nickName: '未登录'
      },
      hasUserInfo: !!userInfo
    })
  },

  /**
   * 获取用户信息
   */
  getUserProfile(e) {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    })
  },

  /**
   * 登录
   */
  onLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  /**
   * 退出登录
   */
  async onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await AuthService.logout()
          } catch (error) {
            console.error('退出登录失败:', error)
          }
        }
      }
    })
  },

  /**
   * 加载用户统计数据
   */
  async loadUserStats() {
    try {
      if (!AuthService.isLoggedIn()) {
        this.setData({
          stats: {
            assessmentCount: 0,
            musicCount: 0,
            totalListenTime: 0,
            consecutiveDays: 0
          }
        });
        return
      }

      // 加载播放统计
      const api = require('../../utils/api');
      const result = await api.request({
        url: '/play-records/stats',
        method: 'GET',
        data: {
          days: 30  // 最近30天的统计
        },
        showLoading: false
      });

      if (result.success) {
        const data = result.data;
        this.setData({
          stats: {
            assessmentCount: 0,  // 将在下面单独加载
            musicCount: data.total_records || 0,
            totalListenTime: Math.floor((data.total_duration || 0) / 60), // 转换为分钟
            consecutiveDays: data.active_days || 0
          }
        });

        console.log('用户统计数据加载成功:', this.data.stats);
      } else {
        console.warn('加载统计数据失败:', result.error);
        this.setFallbackStats();
      }

      // 单独加载评测统计
      this.loadAssessmentCount();

    } catch (error) {
      console.error('加载用户统计失败:', error);
      this.setFallbackStats();
    }
  },

  /**
   * 加载评测数量统计
   */
  async loadAssessmentCount() {
    const userInfo = AuthService.getCurrentUser();
    if (!userInfo) return;

    try {
      const { AssessmentAPI } = require('../../utils/healingApi');
      const result = await AssessmentAPI.getHistory(userInfo.id);
      if (result.success) {
        const assessmentCount = (result.data || []).length;
        this.setData({
          [`stats.assessmentCount`]: assessmentCount
        });
      }
    } catch (error) {
      console.error('加载评测数量失败:', error);
    }
  },

  /**
   * 设置默认统计数据
   */
  setFallbackStats() {
    this.setData({
      stats: {
        assessmentCount: 0,
        musicCount: 0,
        totalListenTime: 0,
        consecutiveDays: 0
      }
    });
  },

  /**
   * 加载设置
   */
  loadSettings() {
    try {
      const settings = wx.getStorageSync('appSettings') || this.data.settings
      this.setData({ settings })
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  },

  /**
   * 保存设置
   */
  saveSettings() {
    try {
      wx.setStorageSync('appSettings', this.data.settings)
      wx.showToast({
        title: '设置已保存',
        icon: 'success'
      })
    } catch (error) {
      console.error('保存设置失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      })
    }
  },

  /**
   * 查看评测历史
   */
  onViewAssessmentHistory() {
    if (!AuthService.isLoggedIn()) {
      this.showLoginTip()
      return
    }

    wx.navigateTo({
      url: '/pages/history/history?type=assessment'
    })
  },

  /**
   * 查看音乐库
   */
  onViewMusicLibrary() {
    if (!AuthService.isLoggedIn()) {
      this.showLoginTip()
      return
    }

    wx.switchTab({
      url: '/pages/music/library/library'
    })
  },

  /**
   * 设备管理
   */
  onDeviceManage() {
    if (!AuthService.isLoggedIn()) {
      this.showLoginTip()
      return
    }

    wx.navigateTo({
      url: '/pages/device/bind/bind'
    })
  },

  /**
   * 显示登录提示
   */
  showLoginTip() {
    wx.showModal({
      title: '需要登录',
      content: '请先登录后再使用此功能',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          this.onLogin()
        }
      }
    })
  },

  showHelp: function () {
    wx.showModal({
      title: '使用帮助',
      content: 'AI疗愈系统帮助您通过心理评测和个性化音乐生成来改善心理健康。完成评测后，系统会为您生成专属的疗愈音乐。',
      showCancel: false
    })
  },

  showAbout: function () {
    wx.showModal({
      title: '关于我们',
      content: '滋兰健管-馨脑智康是专业的心理健康与疗愈平台，致力于通过AI技术为用户提供个性化的心理健康服务。',
      showCancel: false
    })
  },

  showSettings: function () {
    wx.navigateTo({
      url: '/pages/settings/settings'
    })
  },

  // 头像选择处理
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    console.log('选择头像:', avatarUrl)
    
    this.setData({ 
      tempAvatar: avatarUrl,
      hasChanges: true
    })
    
    // 立即更新显示
    const updatedUserInfo = { ...this.data.userInfo }
    updatedUserInfo.avatarUrl = avatarUrl
    updatedUserInfo.avatar_url = avatarUrl
    this.setData({ userInfo: updatedUserInfo })
    
    wx.showToast({
      title: '头像已选择，请保存',
      icon: 'success'
    })
  },

  // 昵称输入处理
  onNicknameChange(e) {
    const nickname = e.detail.value.trim()
    console.log('昵称更改:', nickname)
    
    if (nickname && nickname !== (this.data.userInfo.nickname || this.data.userInfo.nickName || this.data.userInfo.username)) {
      this.setData({ 
        tempNickname: nickname,
        hasChanges: true
      })
      
      // 立即更新显示
      const updatedUserInfo = { ...this.data.userInfo }
      updatedUserInfo.nickname = nickname
      updatedUserInfo.nickName = nickname
      this.setData({ userInfo: updatedUserInfo })
    }
  },

  // 保存资料
  async onSaveProfile() {
    if (!this.data.hasChanges) {
      wx.showToast({ title: '没有更改', icon: 'none' })
      return
    }

    try {
      this.setData({ saving: true })
      
      const user = AuthService.getCurrentUser() || {}
      const updateData = {
        user_id: user.id
      }
      
      // 添加头像信息
      if (this.data.tempAvatar) {
        updateData.avatar_url = this.data.tempAvatar
      }
      
      // 添加昵称信息
      if (this.data.tempNickname) {
        updateData.nickname = this.data.tempNickname
      }
      
      console.log('保存用户资料:', updateData)
      
      const res = await UserAPI.updateUserInfo(updateData)
      
      if (res && res.success) {
        // 更新本地存储（同时保存到两个key以保证兼容性）
        const updatedUserInfo = { ...user, ...res.data }
        wx.setStorageSync('userInfo', updatedUserInfo)    // 兼容旧代码
        wx.setStorageSync('user_info', updatedUserInfo)   // tokenManager期望的key
        
        this.setData({ 
          userInfo: updatedUserInfo,
          hasChanges: false,
          tempAvatar: '',
          tempNickname: ''
        })
        
        wx.showToast({ title: '资料保存成功', icon: 'success' })
      } else {
        throw new Error(res?.message || '保存失败')
      }
    } catch (e) {
      console.error('保存资料失败:', e)
      wx.showToast({ 
        title: e.message || '保存失败，请重试', 
        icon: 'none' 
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 跳转到设备绑定页面
  goToDeviceBinding() {
    wx.navigateTo({
      url: '/pages/device/device'
    })
  },

  showHistory() {
    wx.showToast({
      title: '功能开发中，敬请期待',
      icon: 'none'
    });
  },

  goToDownloads() {
    wx.showToast({
      title: '功能开发中，敬请期待',
      icon: 'none'
    });
  },

  goToFavorites() {
    wx.showToast({
      title: '功能开发中，敬请期待',
      icon: 'none'
    });
  },

  showFeedback() {
    wx.showToast({
      title: '功能开发中，敬请期待',
      icon: 'none'
    });
  },

  /**
   * 加载订阅状态
   */
  async loadSubscriptionStatus() {
    if (!this.data.isLoggedIn) {
      return
    }

    try {
      const subscriptionInfo = await getSubscriptionInfo()
      
      let status = {
        type: 'free',
        displayName: '免费用户',
        expiresAt: null,
        daysLeft: 0,
        features: ['60秒音乐生成'],
        showUpgrade: true,
        statusColor: '#999',
        statusIcon: '👤'
      }

      if (subscriptionInfo) {
        if (subscriptionInfo.subscription_type === 'trial') {
          status = {
            type: 'trial',
            displayName: '试用会员',
            expiresAt: subscriptionInfo.trial_expires_at,
            daysLeft: this.calculateDaysLeft(subscriptionInfo.trial_expires_at),
            features: ['60秒音乐生成', 'AI音乐生成', '长序列音乐'],
            showUpgrade: true,
            statusColor: '#f59e0b',
            statusIcon: '⭐'
          }
        } else if (subscriptionInfo.subscription_type === 'premium') {
          status = {
            type: 'premium',
            displayName: '高级会员',
            expiresAt: subscriptionInfo.premium_expires_at,
            daysLeft: this.calculateDaysLeft(subscriptionInfo.premium_expires_at),
            features: ['60秒音乐生成', 'AI音乐生成', '长序列音乐', '无限播放'],
            showUpgrade: false,
            statusColor: '#10b981',
            statusIcon: '💎'
          }
        } else if (subscriptionInfo.subscription_type === 'vip') {
          status = {
            type: 'vip',
            displayName: 'VIP会员',
            expiresAt: subscriptionInfo.vip_expires_at,
            daysLeft: this.calculateDaysLeft(subscriptionInfo.vip_expires_at),
            features: ['60秒音乐生成', 'AI音乐生成', '长序列音乐', '无限播放', '专属客服'],
            showUpgrade: false,
            statusColor: '#8b5cf6',
            statusIcon: '👑'
          }
        }
      }

      this.setData({
        subscriptionStatus: status
      })

    } catch (error) {
      console.error('加载订阅状态失败:', error)
    }
  },

  /**
   * 计算剩余天数
   */
  calculateDaysLeft(expiresAt) {
    if (!expiresAt) return 0
    
    const expiryDate = new Date(expiresAt)
    const now = new Date()
    const diffTime = expiryDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(0, diffDays)
  },

  /**
   * 点击升级订阅
   */
  onUpgradeSubscription() {
    wx.navigateTo({
      url: '/pages/subscription/subscription'
    })
  }
})
