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
    savingProgress: 0,
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

      // 使用播放历史接口计算统计数据
      const api = require('../../utils/api');
      const result = await api.request({
        url: '/play-records/recent',
        method: 'GET',
        data: {
          limit: 1000,  // 获取更多记录用于统计
          days: 30      // 最近30天
        },
        showLoading: false
      });

      if (result.success && result.data) {
        const records = result.data || [];
        const stats = this.calculateStatsFromRecords(records);
        
        this.setData({
          stats: {
            assessmentCount: 0,  // 将在下面单独加载
            musicCount: stats.totalRecords,
            totalListenTime: stats.totalMinutes,
            consecutiveDays: stats.activeDays
          }
        });

        console.log('用户统计数据加载成功:', this.data.stats);
      } else {
        console.warn('加载播放记录失败:', result.error);
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
   * 从播放记录计算统计数据
   */
  calculateStatsFromRecords(records) {
    if (!records || records.length === 0) {
      return {
        totalRecords: 0,
        totalMinutes: 0,
        activeDays: 0
      };
    }

    // 计算总播放次数
    const totalRecords = records.length;

    // 计算总播放时长（分钟）
    const totalSeconds = records.reduce((total, record) => {
      return total + (record.actual_play_duration || record.play_duration || 0);
    }, 0);
    const totalMinutes = Math.floor(totalSeconds / 60);

    // 计算活跃天数
    const playDates = new Set();
    records.forEach(record => {
      if (record.created_at) {
        const date = new Date(record.created_at).toDateString();
        playDates.add(date);
      }
    });
    const activeDays = playDates.size;

    return {
      totalRecords,
      totalMinutes,
      activeDays
    };
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

  /**
   * 显示用户协议
   */
  showUserAgreement: function () {
    wx.showModal({
      title: '用户协议',
      content: '欢迎使用medsleep疗愈应用！\n\n通过使用我们的服务，您同意遵守以下条款：\n\n1. 服务使用：本应用旨在为用户提供音乐疗愈和心理健康服务。\n\n2. 内容版权：应用内的音乐和内容受版权保护。\n\n3. 用户责任：请合理使用服务，不得进行违法或有害活动。\n\n4. 隐私保护：我们严格保护您的个人信息和使用数据。\n\n5. 服务变更：我们保留修改或终止服务的权利。\n\n完整版协议请访问我们的官方网站查看。',
      showCancel: true,
      cancelText: '关闭',
      confirmText: '已阅读'
    });
  },

  /**
   * 显示隐私政策
   */
  showPrivacyPolicy: function () {
    wx.showModal({
      title: '隐私政策',
      content: '我们深知隐私对您的重要性，并承诺保护您的个人信息。\n\n我们收集的信息：\n• 基本账户信息（昵称、头像）\n• 使用数据（播放记录、评测结果）\n• 设备信息（用于服务优化）\n\n信息使用目的：\n• 提供个性化服务体验\n• 改善产品功能和性能\n• 保障账户和服务安全\n\n信息保护措施：\n• 采用行业标准加密技术\n• 严格限制访问权限\n• 不向第三方出售个人信息\n\n您的权利：\n• 查看、修改个人信息\n• 删除账户和相关数据\n• 控制信息收集范围\n\n完整版隐私政策请访问我们的官方网站。',
      showCancel: true,
      cancelText: '关闭',
      confirmText: '已阅读'
    });
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
      this.setData({ saving: true, savingProgress: 0 })
      
      // 模拟进度条动画
      this.simulateProgress()
      
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
        // 完成进度条到100%
        if (this.progressInterval) {
          clearInterval(this.progressInterval)
        }
        this.setData({ savingProgress: 100 })
        
        // 稍微延迟显示完成效果
        setTimeout(() => {
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
        }, 300)
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
      // 清理进度条interval
      if (this.progressInterval) {
        clearInterval(this.progressInterval)
        this.progressInterval = null
      }
      // 延迟一点时间让用户看到完成效果
      setTimeout(() => {
        this.setData({ saving: false, savingProgress: 0 })
      }, 500)
    }
  },

  /**
   * 模拟保存进度条动画
   */
  simulateProgress() {
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 25 + 10 // 随机增加10-35%
      if (progress >= 90) {
        progress = 90 // 最多到90%，剩下10%等实际完成
        clearInterval(interval)
      }
      this.setData({ savingProgress: Math.min(progress, 90) })
    }, 200) // 每200ms更新一次
    
    // 保存这个interval的引用，以便在保存完成时清理
    this.progressInterval = interval
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
