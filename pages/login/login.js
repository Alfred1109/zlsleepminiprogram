// pages/login/login.js
// 登录页面
const app = getApp()
const AuthService = require('../../services/AuthService')

Page({
  data: {
    username: '',
    password: '',
    loading: false,
    showPassword: false,
    agreeToUserAgreement: false, // 是否同意用户协议
    agreeToPrivacyPolicy: false, // 是否同意隐私政策
    isDevEnv: false, // 是否为开发环境
    loginMethods: [
      { id: 'wechat', name: '微信登录', icon: '/images/wechat-login.svg' },
      { id: 'account', name: '账号登录', icon: '/images/account-login.svg' }
    ],
    currentMethod: 'wechat'
  },

  onLoad(options) {
    console.log('登录页面加载', options)
    if (options && options.redirect) {
      this.redirectUrl = decodeURIComponent(options.redirect)
    }
    
    // 检测是否为开发环境并自动填入测试账号
    this.detectDevEnvironment()
  },

  /**
   * 检测开发环境并自动填入测试账号
   */
  detectDevEnvironment() {
    try {
      const deviceInfo = wx.getDeviceInfo()
      const isDevTools = deviceInfo.platform === 'devtools'
      
      if (isDevTools) {
        console.log('检测到开发工具环境，自动填入测试账号')
        this.setData({
          isDevEnv: true,
          username: 'test',
          password: '123456',
          agreeToUserAgreement: true,
          agreeToPrivacyPolicy: true
        })
      } else {
        console.log('检测到真机环境')
        this.setData({
          isDevEnv: false
        })
      }
    } catch (error) {
      console.warn('环境检测失败:', error)
      this.setData({
        isDevEnv: false
      })
    }
  },



  onSwitchMethod(e) {
    const { method } = e.currentTarget.dataset
    this.setData({ currentMethod: method })
  },

  async onWechatLogin() {
    // 检查是否同意用户协议和隐私政策
    if (!this.data.agreeToUserAgreement || !this.data.agreeToPrivacyPolicy) {
      let missingAgreements = [];
      if (!this.data.agreeToUserAgreement) missingAgreements.push('《用户协议》');
      if (!this.data.agreeToPrivacyPolicy) missingAgreements.push('《隐私政策》');
      
      wx.showModal({
        title: '请先同意协议',
        content: `请勾选同意${missingAgreements.join('和')}后再进行登录`,
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    try {
      this.setData({ loading: true });
      const result = await AuthService.wechatLogin();

      if (result && result.success) {
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => { this.redirectAfterLogin(); }, 800);
      } else {
        throw new Error(result?.error || '微信登录失败');
      }
    } catch (err) {
      wx.showToast({ title: err.message || '微信登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onAccountLogin() {
    // 检查是否同意用户协议和隐私政策
    if (!this.data.agreeToUserAgreement || !this.data.agreeToPrivacyPolicy) {
      let missingAgreements = [];
      if (!this.data.agreeToUserAgreement) missingAgreements.push('《用户协议》');
      if (!this.data.agreeToPrivacyPolicy) missingAgreements.push('《隐私政策》');
      
      wx.showModal({
        title: '请先同意协议',
        content: `请勾选同意${missingAgreements.join('和')}后再进行登录`,
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    try {
      const { username, password } = this.data
      if (!username || !password) { 
        wx.showToast({ title: '请输入账号与密码', icon: 'none' }); 
        return 
      }
      this.setData({ loading: true })

      // 使用真正的账号密码登录
      const result = await AuthService.accountLogin(username, password);
      
      if (result && result.success) {
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => { this.redirectAfterLogin(); }, 800);
      } else {
        throw new Error(result?.error || '账号登录失败');
      }
    } catch (err) {
      wx.showToast({ title: err.message || '账号登录失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },



  redirectAfterLogin() {
    const redirectUrl = this.redirectUrl || '/pages/index/index';
    const tabBarPages = [
      '/pages/index/index',
      '/pages/assessment/scales/scales',
      '/pages/music/library/library',
      '/pages/profile/profile'
    ];

    if (tabBarPages.includes(redirectUrl)) {
      wx.switchTab({ url: redirectUrl });
    } else {
      wx.reLaunch({ url: redirectUrl });
    }
  },

  onUsernameInput(e) { this.setData({ username: e.detail.value }) },
  onPasswordInput(e) { this.setData({ password: e.detail.value }) },
  onTogglePassword() { this.setData({ showPassword: !this.data.showPassword }) },

  /**
   * 切换用户协议同意状态
   */
  onToggleUserAgreement() {
    this.setData({
      agreeToUserAgreement: !this.data.agreeToUserAgreement
    });
  },

  /**
   * 切换隐私政策同意状态
   */
  onTogglePrivacyPolicy() {
    this.setData({
      agreeToPrivacyPolicy: !this.data.agreeToPrivacyPolicy
    });
  },

  /**
   * 查看用户协议
   */
  onViewUserAgreement: function(e) {
    if (e && e.stopPropagation) {
      e.stopPropagation(); // 阻止事件冒泡
    }
    wx.showModal({
      title: '用户协议',
      content: '欢迎使用medsleep疗愈应用！\n\n通过使用我们的服务，您同意遵守以下条款：\n\n1. 服务使用：本应用旨在为用户提供音乐疗愈和心理健康服务。\n\n2. 内容版权：应用内的音乐和内容受版权保护。\n\n3. 用户责任：请合理使用服务，不得进行违法或有害活动。\n\n4. 隐私保护：我们严格保护您的个人信息和使用数据。\n\n5. 服务变更：我们保留修改或终止服务的权利。\n\n完整版协议请访问我们的官方网站查看。',
      showCancel: true,
      cancelText: '关闭',
      confirmText: '已阅读'
    });
  },

  /**
   * 查看隐私政策
   */
  onViewPrivacyPolicy: function(e) {
    if (e && e.stopPropagation) {
      e.stopPropagation(); // 阻止事件冒泡
    }
    wx.showModal({
      title: '隐私政策',
      content: '我们深知隐私对您的重要性，并承诺保护您的个人信息。\n\n我们收集的信息：\n• 基本账户信息（昵称、头像）\n• 使用数据（播放记录、评测结果）\n• 设备信息（用于服务优化）\n\n信息使用目的：\n• 提供个性化服务体验\n• 改善产品功能和性能\n• 保障账户和服务安全\n\n信息保护措施：\n• 采用行业标准加密技术\n• 严格限制访问权限\n• 不向第三方出售个人信息\n\n您的权利：\n• 查看、修改个人信息\n• 删除账户和相关数据\n• 控制信息收集范围\n\n完整版隐私政策请访问我们的官方网站。',
      showCancel: true,
      cancelText: '关闭',
      confirmText: '已阅读'
    });
  },

  /**
   * 忘记密码
   */
  onForgotPassword: function() {
    wx.showModal({
      title: '忘记密码',
      content: '请联系客服重置密码，或使用微信登录方式。',
      showCancel: true,
      cancelText: '取消',
      confirmText: '联系客服'
    });
  },

  /**
   * 注册账号
   */
  onRegister: function() {
    wx.showModal({
      title: '注册账号',
      content: '目前暂不支持自主注册，请使用微信登录或联系客服创建账号。',
      showCancel: true,
      cancelText: '取消',
      confirmText: '微信登录'
    });
  }
})
