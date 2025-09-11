// pages/profile/profile.js
const app = getApp()
const AuthService = require('../../services/AuthService')
const { UserAPI } = require('../../utils/healingApi')
const { getSubscriptionInfo, getUnifiedSubscriptionStatus } = require('../../utils/subscription')
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
    // 检查登录状态，但不覆盖临时修改
    this.checkLoginStatusWithoutOverride()
    this.loadUserStats()
    this.loadSubscriptionStatus()
    
    // 监听统计数据更新事件
    this.setupStatsListener()
  },

  onHide() {
    // 移除事件监听
    this.removeStatsListener()
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
        // 同步成功后，从数据库重新获取最新的用户信息
        console.log('🔄 微信资料同步成功，重新获取完整用户信息...')
        
        try {
          const completeUserInfo = await AuthService.refreshUserInfo()
          if (completeUserInfo) {
            this.setData({ 
              userInfo: completeUserInfo, 
              hasUserInfo: true, 
              lastSyncAt: now,
              // 清除临时状态，因为已同步到服务器
              tempAvatar: '',
              tempNickname: '',
              hasChanges: false
            })
            wx.showToast({ title: '微信资料已保存到账户', icon: 'success' })
          } else {
            // 降级处理：使用服务器返回的数据
            const updated = {
              ...user,
              nickname: res.data.nickname,
              nickName: res.data.nickname,
              avatar_url: res.data.avatar_url,
              avatarUrl: res.data.avatar_url
            }
            
            AuthService.setCurrentUser(updated)
            this.setData({ 
              userInfo: updated, 
              hasUserInfo: true, 
              lastSyncAt: now,
              tempAvatar: '',
              tempNickname: '',
              hasChanges: false
            })
            wx.showToast({ title: '已同步微信资料', icon: 'success' })
          }
        } catch (error) {
          console.warn('获取完整用户信息失败，使用返回数据:', error)
          // 降级处理
          const updated = {
            ...user,
            nickname: res.data.nickname,
            nickName: res.data.nickname,
            avatar_url: res.data.avatar_url,
            avatarUrl: res.data.avatar_url
          }
          
          AuthService.setCurrentUser(updated)
          this.setData({ 
            userInfo: updated, 
            hasUserInfo: true, 
            lastSyncAt: now,
            tempAvatar: '',
            tempNickname: '',
            hasChanges: false
          })
          wx.showToast({ title: '已同步微信资料', icon: 'success' })
        }
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
   * 检查登录状态并从数据库获取最新用户信息
   */
  async checkLoginStatusWithoutOverride() {
    const loggedIn = AuthService.isLoggedIn()

    if (loggedIn) {
      try {
        // 总是从数据库获取最新的用户信息
        console.log('🔄 从数据库获取最新用户信息...')
        const completeUserInfo = await AuthService.refreshUserInfo()
        
        if (completeUserInfo) {
          this.setData({
            isLoggedIn: true,
            hasUserInfo: true,
            userInfo: completeUserInfo,
            // 清理临时状态（如果没有正在进行的修改）
            hasChanges: this.data.hasChanges && (this.data.tempAvatar || this.data.tempNickname),
            tempAvatar: this.data.hasChanges ? this.data.tempAvatar : '',
            tempNickname: this.data.hasChanges ? this.data.tempNickname : ''
          })
          console.log('✅ 已从数据库获取完整用户信息:', {
            hasNickname: !!(completeUserInfo.nickname || completeUserInfo.nickName),
            hasAvatar: !!(completeUserInfo.avatarUrl || completeUserInfo.avatar_url)
          })
        } else {
          // 数据库获取失败，使用本地缓存
          const localUserInfo = AuthService.getCurrentUser()
          this.setData({
            isLoggedIn: true,
            hasUserInfo: !!localUserInfo,
            userInfo: localUserInfo || {
              avatarUrl: '/images/default-avatar.svg',
              nickName: '用户'
            }
          })
        }
      } catch (error) {
        console.warn('从数据库获取用户信息失败，使用本地缓存:', error)
        const localUserInfo = AuthService.getCurrentUser()
        this.setData({
          isLoggedIn: true,
          hasUserInfo: !!localUserInfo,
          userInfo: localUserInfo || {
            avatarUrl: '/images/default-avatar.svg',
            nickName: '用户'
          }
        })
      }
    } else {
      this.setData({
        isLoggedIn: false,
        hasUserInfo: false,
        userInfo: {
          avatarUrl: '/images/default-avatar.svg',
          nickName: '未登录'
        }
      })
    }
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
        console.log('📊 获取到的播放记录数据:', records);
        console.log('📊 播放记录数量:', records.length);
        
        // 打印第一条记录的结构以便调试
        if (records.length > 0) {
          console.log('📊 播放记录示例:', records[0]);
        }
        
        const stats = this.calculateStatsFromRecords(records);
        console.log('📊 计算得到的统计数据:', stats);
        
        this.setData({
          stats: {
            assessmentCount: 0,  // 将在下面单独加载
            musicCount: stats.totalRecords,
            totalListenTime: stats.totalMinutes,
            consecutiveDays: stats.activeDays
          }
        });

        console.log('📊 最终设置的统计数据:', this.data.stats);
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
   * 解析中文时长格式 "0分59秒" -> 59秒
   */
  parseDurationString(durationStr) {
    if (!durationStr || typeof durationStr === 'number') {
      return durationStr || 0;
    }
    
    if (typeof durationStr !== 'string') {
      return 0;
    }

    let totalSeconds = 0;
    
    // 匹配 "2分30秒" 格式
    const minuteMatch = durationStr.match(/(\d+)分/);
    const secondMatch = durationStr.match(/(\d+)秒/);
    
    if (minuteMatch) {
      totalSeconds += parseInt(minuteMatch[1]) * 60;
    }
    if (secondMatch) {
      totalSeconds += parseInt(secondMatch[1]);
    }
    
    console.log(`🔧 解析时长字符串 "${durationStr}" -> ${totalSeconds}秒`);
    return totalSeconds;
  },

  /**
   * 从播放记录计算统计数据
   */
  calculateStatsFromRecords(records) {
    if (!records || records.length === 0) {
      console.log('📊 没有播放记录数据');
      return {
        totalRecords: 0,
        totalMinutes: 0,
        activeDays: 0
      };
    }

    // 计算总播放次数
    const totalRecords = records.length;
    console.log('📊 播放记录总数:', totalRecords);

    // 计算总播放时长（分钟）
    let totalSeconds = 0;
    records.forEach((record, index) => {
      // 尝试多个可能的字段名
      const rawDuration = record.actual_play_duration 
        || record.play_duration 
        || record.duration 
        || record.play_time
        || 0;
      
      // 🔧 处理中文时长格式
      const duration = this.parseDurationString(rawDuration);
      
      console.log(`📊 记录${index + 1}播放时长字段检查:`, {
        actual_play_duration: record.actual_play_duration,
        play_duration: record.play_duration,
        duration: record.duration,
        play_time: record.play_time,
        原始值: rawDuration,
        解析后: duration
      });
      console.log(`📊 记录${index + 1}播放时长:`, duration, '秒');
      totalSeconds += duration;
    });
    const totalMinutes = Math.floor(totalSeconds / 60);
    console.log('📊 总播放时长:', totalSeconds, '秒 =', totalMinutes, '分钟');

    // 计算活跃天数
    const playDates = new Set();
    records.forEach((record, index) => {
      // 🔧 尝试多个可能的时间字段名，包括date字段
      const createdTime = record.created_at 
        || record.create_time 
        || record.createdAt 
        || record.createTime
        || record.date;  // 从日志看到有这个字段
      
      console.log(`📊 记录${index + 1}创建时间字段检查:`, {
        created_at: record.created_at,
        create_time: record.create_time,
        createdAt: record.createdAt,
        createTime: record.createTime,
        date: record.date,
        最终使用: createdTime
      });
      console.log(`📊 记录${index + 1}创建时间:`, createdTime);
      
      if (createdTime) {
        const date = new Date(createdTime).toDateString();
        playDates.add(date);
        console.log('📊 添加活跃日期:', date);
      }
    });
    const activeDays = playDates.size;
    console.log('📊 活跃天数:', activeDays, '天, 活跃日期:', Array.from(playDates));

    const result = {
      totalRecords,
      totalMinutes: isNaN(totalMinutes) ? 0 : totalMinutes,  // 🔧 修复NaN问题
      activeDays
    };
    console.log('📊 统计计算结果:', result);

    return result;
  },

  /**
   * 加载评测数量统计
   */
  async loadAssessmentCount() {
    const userInfo = AuthService.getCurrentUser();
    if (!userInfo) return;

    try {
      const api = require('../../utils/api');
      const result = await api.request({
        url: `/assessment/history/${userInfo.id}`,
        method: 'GET',
        showLoading: false  // 统计数据后台加载，不显示loading
      });
      
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
   * 设置统计数据更新监听器
   */
  setupStatsListener() {
    if (!this.statsUpdateHandler) {
      this.statsUpdateHandler = () => {
        console.log('收到统计数据更新通知，刷新数据...');
        this.refreshUserStats();
      };

      // 监听事件总线
      const eventEmitter = require('../../utils/eventEmitter');
      eventEmitter.on('statsUpdated', this.statsUpdateHandler);
    }
  },

  /**
   * 移除统计数据更新监听器
   */
  removeStatsListener() {
    if (this.statsUpdateHandler) {
      const eventEmitter = require('../../utils/eventEmitter');
      eventEmitter.off('statsUpdated', this.statsUpdateHandler);
      this.statsUpdateHandler = null;
    }
  },

  /**
   * 刷新用户统计数据（外部调用）
   */
  refreshUserStats() {
    console.log('刷新用户统计数据');
    this.loadUserStats();
  },

  /**
   * 加载设置
   */
  loadSettings() {
    try {
      // 加载基础设置
      const appSettings = wx.getStorageSync('appSettings') || {}
      const audioSettings = wx.getStorageSync('audioSettings') || {}
      const privacySettings = wx.getStorageSync('privacySettings') || {}
      
      // 合并默认设置
      const settings = {
        theme: 'auto',
        volume: 0.7,
        autoSleep: 30,
        vibrationEnabled: true,
        notificationEnabled: true,
        autoPlay: false,
        downloadOnlyWifi: true,
        cacheLimit: 500,
        ...appSettings
      }
      
      this.setData({ settings })
      
      // 应用主题设置
      this.applyThemeSettings(settings.theme)
      
      console.log('设置加载完成:', settings)
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
   * 应用主题设置
   */
  applyThemeSettings(theme) {
    try {
      let actualTheme = theme
      
      if (theme === 'auto') {
        // 获取系统主题
        const systemInfo = wx.getSystemInfoSync()
        actualTheme = systemInfo.theme || 'light'
      }

      // 更新导航栏颜色
      if (actualTheme === 'dark') {
        wx.setNavigationBarColor({
          frontColor: '#ffffff',
          backgroundColor: '#1a1a1a'
        })
      } else {
        wx.setNavigationBarColor({
          frontColor: '#ffffff',
          backgroundColor: '#4A90E2'
        })
      }

      console.log('主题设置应用完成:', actualTheme)
    } catch (error) {
      console.error('应用主题设置失败:', error)
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

  // showHelp 方法已移除

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
  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    console.log('选择头像:', avatarUrl)
    
    // 显示加载状态
    wx.showLoading({ title: '更新头像中...' })
    
    try {
      // 立即同步到服务器
      const user = AuthService.getCurrentUser() || {}
      const updateData = {
        user_id: user.id,
        avatar_url: avatarUrl
      }

      const res = await UserAPI.updateUserInfo(updateData)
      if (res && res.success) {
        // 同步成功后，从服务器获取最新的完整用户信息
        const completeUserInfo = await AuthService.refreshUserInfo()
        if (completeUserInfo) {
          this.setData({ 
            userInfo: completeUserInfo,
            hasUserInfo: true,
            hasChanges: false,
            tempAvatar: '',
            tempNickname: ''
          })
          wx.showToast({ title: '头像更新成功', icon: 'success' })
        } else {
          throw new Error('获取最新用户信息失败')
        }
      } else {
        throw new Error(res?.message || '更新头像失败')
      }
    } catch (error) {
      console.error('更新头像失败:', error)
      wx.showToast({ 
        title: error.message || '更新失败，请重试', 
        icon: 'none' 
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 昵称输入处理 - 使用防抖，避免频繁请求
  onNicknameChange(e) {
    const nickname = e.detail.value.trim()
    console.log('昵称输入:', nickname)
    
    // 只更新临时显示，不立即保存
    if (nickname !== (this.data.userInfo.nickname || this.data.userInfo.nickName || this.data.userInfo.username)) {
      this.setData({ 
        tempNickname: nickname,
        hasChanges: true
      })
      
      // 临时更新显示
      const updatedUserInfo = { ...this.data.userInfo }
      updatedUserInfo.nickname = nickname
      updatedUserInfo.nickName = nickname
      this.setData({ userInfo: updatedUserInfo })
      
      // 防抖处理：500ms后同步到服务器
      this.debouncedSyncNickname(nickname)
    }
  },

  // 防抖同步昵称
  debouncedSyncNickname(nickname) {
    // 清除之前的定时器
    if (this.nicknameTimer) {
      clearTimeout(this.nicknameTimer)
    }
    
    // 设置新的定时器
    this.nicknameTimer = setTimeout(async () => {
      try {
        const user = AuthService.getCurrentUser() || {}
        const updateData = {
          user_id: user.id,
          nickname: nickname
        }

        const res = await UserAPI.updateUserInfo(updateData)
        if (res && res.success) {
          // 同步成功后，从服务器获取最新信息
          const completeUserInfo = await AuthService.refreshUserInfo()
          if (completeUserInfo) {
            this.setData({ 
              userInfo: completeUserInfo,
              hasChanges: false,
              tempNickname: ''
            })
            console.log('✅ 昵称已同步到数据库')
          }
        }
      } catch (error) {
        console.error('同步昵称失败:', error)
        // 失败时保持 hasChanges 状态，用户可以手动保存
      }
    }, 500)
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
          // 使用AuthService统一保存，确保数据一致性
          const updatedUserInfo = { ...user, ...res.data }
          AuthService.setCurrentUser(updatedUserInfo)
          
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
    // 检查登录状态
    if (!this.data.isLoggedIn) {
      this.showLoginTip()
      return
    }
    
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },

  goToDownloads() {
    // 检查登录状态
    if (!this.data.isLoggedIn) {
      this.showLoginTip()
      return
    }

    wx.navigateTo({
      url: '/pages/downloads/downloads'
    });
  },

  goToFavorites() {
    // 检查登录状态
    if (!this.data.isLoggedIn) {
      this.showLoginTip()
      return
    }

    wx.navigateTo({
      url: '/pages/favorites/favorites'
    });
  },

  // showFeedback 方法已移除

  /**
   * 加载订阅状态
   */
  async loadSubscriptionStatus() {
    if (!this.data.isLoggedIn) {
      return
    }

    try {
      // 使用统一的订阅状态获取方法
      const unifiedStatus = await getUnifiedSubscriptionStatus()
      
      // 根据统一状态构建显示状态
      let status = {
        type: unifiedStatus.type,
        displayName: unifiedStatus.displayName,
        expiresAt: unifiedStatus.subscriptionEndDate || unifiedStatus.trialEndDate,
        daysLeft: 0,
        features: ['60秒音乐生成'],
        showUpgrade: !unifiedStatus.isSubscribed,
        statusColor: '#999',
        statusIcon: '👤'
      }

      // 根据订阅类型设置详细信息
      if (unifiedStatus.isSubscribed) {
        if (unifiedStatus.type === 'premium') {
          status.features = ['60秒音乐生成', 'AI音乐生成', '长序列音乐', '无限播放']
          status.statusColor = '#10b981'
          status.statusIcon = '💎'
        } else if (unifiedStatus.type === 'vip') {
          status.features = ['60秒音乐生成', 'AI音乐生成', '长序列音乐', '无限播放', '专属客服']
          status.statusColor = '#8b5cf6'
          status.statusIcon = '👑'
        }
        status.showUpgrade = false
        status.daysLeft = this.calculateDaysLeft(unifiedStatus.subscriptionEndDate)
      } else if (unifiedStatus.isInTrial) {
        status.features = ['60秒音乐生成', 'AI音乐生成', '长序列音乐']
        status.statusColor = '#f59e0b'
        status.statusIcon = '⭐'
        status.daysLeft = unifiedStatus.trialDaysLeft
      }

      console.log('📋 个人信息页面订阅状态:', {
        '统一状态': unifiedStatus,
        '显示状态': status
      })

      this.setData({
        subscriptionStatus: status,
        unifiedStatus: unifiedStatus // 保存统一状态用于其他地方引用
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
  },


  /**
   * 同步用户信息到服务器（可选，在用户明确保存时调用）
   */
  async syncUserInfoToServer() {
    if (!this.data.hasChanges) return

    const user = AuthService.getCurrentUser() || {}
    const updateData = {
      user_id: user.id
    }
    
    // 添加需要同步的字段
    if (this.data.tempAvatar) {
      updateData.avatar_url = this.data.tempAvatar
    }
    
    if (this.data.tempNickname) {
      updateData.nickname = this.data.tempNickname
    }
    
    try {
        const res = await UserAPI.updateUserInfo(updateData)
        if (res && res.success) {
          // 同步成功后，从数据库获取最新的完整用户信息
          const completeUserInfo = await AuthService.refreshUserInfo()
          if (completeUserInfo) {
            this.setData({ 
              userInfo: completeUserInfo,
              hasChanges: false,
              tempAvatar: '',
              tempNickname: ''
            })
          }
          return true
        }
    } catch (error) {
      console.error('同步用户信息到服务器失败:', error)
    }
    
    return false
  },


  /**
   * 检查用户信息是否不完整
   */
  isUserInfoIncomplete(userInfo) {
    if (!userInfo) return true
    
    const hasNickname = !!(userInfo.nickname || userInfo.nickName)
    const hasAvatar = !!(userInfo.avatarUrl || userInfo.avatar_url)
    
    // 如果既没有昵称也没有头像，或者只有默认头像，认为不完整
    const hasDefaultAvatar = userInfo.avatarUrl === '/images/default-avatar.svg' || 
                            userInfo.avatar_url === '/images/default-avatar.svg'
    
    return !hasNickname || !hasAvatar || hasDefaultAvatar
  },

  /**
   * 检查新的用户信息是否比旧的更完整
   */
  isUserInfoMoreComplete(oldInfo, newInfo) {
    if (!oldInfo || !newInfo) return false
    
    const oldHasNickname = !!(oldInfo.nickname || oldInfo.nickName)
    const oldHasAvatar = !!(oldInfo.avatarUrl || oldInfo.avatar_url) && 
                        oldInfo.avatarUrl !== '/images/default-avatar.svg' &&
                        oldInfo.avatar_url !== '/images/default-avatar.svg'
    
    const newHasNickname = !!(newInfo.nickname || newInfo.nickName)
    const newHasAvatar = !!(newInfo.avatarUrl || newInfo.avatar_url) && 
                        newInfo.avatarUrl !== '/images/default-avatar.svg' &&
                        newInfo.avatar_url !== '/images/default-avatar.svg'
    
    // 如果新信息有更多完整的字段，返回true
    return (newHasNickname && !oldHasNickname) || (newHasAvatar && !oldHasAvatar)
  }
})
