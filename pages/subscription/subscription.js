// pages/subscription/subscription.js
// 订阅管理页面
const app = getApp()
const { SubscriptionAPI, CountPackageAPI } = require('../../utils/healingApi')
const { getSubscriptionInfo, startFreeTrial, notifySubscriptionChange } = require('../../utils/subscription')

Page({
  data: {
    subscriptionInfo: null,
    subscriptionPlans: [],
    countPackages: [],
    userCounts: null,
    selectedPlan: null,
    selectedPackage: null,
    currentTab: 'subscription', // 'subscription' 或 'package'
    loading: false,
    purchasing: false,
    showTrialOption: false,
    isInTrial: false,
    trialDaysLeft: 0,
    showCouponModal: false,
    couponCode: ''
  },

  onLoad(options) {
    console.log('订阅页面加载', options)
    
    // 如果有指定的套餐，默认选中
    if (options.plan) {
      this.setData({ selectedPlan: options.plan })
    }
    
    // 如果指定了显示次数套餐
    if (options.tab === 'package') {
      this.setData({ currentTab: 'package' })
    }
    
    this.loadSubscriptionInfo()
    this.loadSubscriptionPlans()
    this.loadCountPackages()
    this.loadUserCounts()
  },

  onShow() {
    // 页面显示时刷新订阅状态
    this.refreshSubscriptionInfo()
    this.loadUserCounts()
  },

  /**
   * 加载订阅信息
   */
  async loadSubscriptionInfo() {
    try {
      const subscriptionInfo = await getSubscriptionInfo()
      
      // 判断当前是否正在试用中
      const isInTrial = this.isInTrial(subscriptionInfo)
      
      // 获取试用剩余天数（优先使用后端计算的）
      const trialDaysLeft = subscriptionInfo.trial_days_left !== undefined ? 
                            subscriptionInfo.trial_days_left : 
                            this.getTrialDaysLeft(subscriptionInfo)
      
      // 只有满足以下条件才显示试用按钮：
      // 1. 试用可用（从未用过试用期）
      // 2. 没有付费订阅
      // 3. 不在试用期内
      const showTrialOption = subscriptionInfo.trial_available && 
                              !subscriptionInfo.is_subscribed &&
                              !isInTrial
      
      console.log('🔍 订阅状态详细检查:', {
        '后端返回原始数据': subscriptionInfo,
        '计算结果': {
          trial_available: subscriptionInfo.trial_available,
          is_subscribed: subscriptionInfo.is_subscribed,
          status: subscriptionInfo.status,
          trial_end_date: subscriptionInfo.trial_end_date,
          subscription_end_date: subscriptionInfo.subscription_end_date,
          type: subscriptionInfo.type,
          isInTrial: isInTrial,
          trialDaysLeft: trialDaysLeft,
          showTrialOption: showTrialOption
        }
      })
      
      // 🔍 数据一致性检查
      console.warn('⚠️ 数据一致性提醒：')
      console.warn('如果 trial_available=true 且 trial_end_date=null，说明可以试用')
      console.warn('如果点击试用按钮仍然报错，说明后端接口数据不一致')
      
      this.setData({ 
        subscriptionInfo,
        showTrialOption,
        isInTrial: isInTrial,
        trialDaysLeft: trialDaysLeft
      })
    } catch (error) {
      console.error('加载订阅信息失败:', error)
    }
  },
  
  /**
   * 判断是否正在试用中
   */
  isInTrial(subscriptionInfo) {
    if (!subscriptionInfo.trial_end_date) return false
    
    // 检查试用期是否还有效
    const now = new Date()
    const trialEndDate = new Date(subscriptionInfo.trial_end_date)
    
    return subscriptionInfo.status === 'active' && trialEndDate > now
  },
  
  /**
   * 计算试用剩余天数
   */
  getTrialDaysLeft(subscriptionInfo) {
    if (!subscriptionInfo.trial_end_date) return 0
    
    const now = new Date()
    const trialEndDate = new Date(subscriptionInfo.trial_end_date)
    const diffTime = trialEndDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(0, diffDays)
  },

  /**
   * 刷新订阅信息
   */
  async refreshSubscriptionInfo() {
    try {
      const subscriptionInfo = await getSubscriptionInfo(true) // 强制刷新
      
      // 判断当前是否正在试用中
      const isInTrial = this.isInTrial(subscriptionInfo)
      
      // 获取试用剩余天数（优先使用后端计算的）
      const trialDaysLeft = subscriptionInfo.trial_days_left !== undefined ? 
                            subscriptionInfo.trial_days_left : 
                            this.getTrialDaysLeft(subscriptionInfo)
      
      // 只有满足以下条件才显示试用按钮：
      // 1. 试用可用（从未用过试用期）
      // 2. 没有付费订阅
      // 3. 不在试用期内
      const showTrialOption = subscriptionInfo.trial_available && 
                              !subscriptionInfo.is_subscribed &&
                              !isInTrial
      
      console.log('🔄 刷新订阅状态详细检查:', {
        '后端返回原始数据': subscriptionInfo,
        '计算结果': {
          trial_available: subscriptionInfo.trial_available,
          is_subscribed: subscriptionInfo.is_subscribed,
          status: subscriptionInfo.status,
          trial_end_date: subscriptionInfo.trial_end_date,
          subscription_end_date: subscriptionInfo.subscription_end_date,
          type: subscriptionInfo.type,
          isInTrial: isInTrial,
          trialDaysLeft: trialDaysLeft,
          showTrialOption: showTrialOption
        }
      })
      
      this.setData({ 
        subscriptionInfo,
        showTrialOption,
        isInTrial: isInTrial,
        trialDaysLeft: trialDaysLeft
      })
    } catch (error) {
      console.error('刷新订阅信息失败:', error)
    }
  },

  /**
   * 加载订阅套餐
   */
  async loadSubscriptionPlans() {
    this.setData({ loading: true })

    try {
      const result = await SubscriptionAPI.getPlans()
      
      if (result.success) {
        console.log('📅 订阅套餐加载成功:', result.data?.length || 0, '个套餐')
        
        // 直接使用后端返回的订阅套餐数据
        const plans = result.data || []
        this.setData({ subscriptionPlans: plans })
        
        // 如果没有选中套餐，默认选择第一个
        if (!this.data.selectedPlan && plans.length > 0) {
          this.setData({ selectedPlan: plans[0].id })
        }
      } else {
        throw new Error(result.error || '获取套餐信息失败')
      }

    } catch (error) {
      console.error('加载订阅套餐失败:', error)
      wx.showToast({
        title: '加载套餐失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 加载次数套餐
   */
  async loadCountPackages() {
    try {
      console.log('🎁 开始加载次数套餐...')
      const result = await CountPackageAPI.getPlans()
      
      if (result.success) {
        console.log('🎁 次数套餐加载成功:', result.data?.length || 0, '个套餐')
        
        // 直接使用后端返回的次数套餐数据
        const countPackages = result.data || []
        this.setData({ 
          countPackages: countPackages
        })
      } else {
        console.error('❌ 次数套餐加载失败:', result.error)
        this.setData({ countPackages: [] })
      }
    } catch (error) {
      console.error('❌ 次数套餐加载异常:', error)
      this.setData({ countPackages: [] })
    }
  },

  /**
   * 加载用户次数信息
   */
  async loadUserCounts() {
    try {
      console.log('🔢 开始加载用户次数...')
      const result = await CountPackageAPI.getUserCounts()
      
      if (result.success) {
        console.log('✅ 用户次数加载成功:', result.data)
        this.setData({ 
          userCounts: result.data || null
        })
      } else {
        console.log('ℹ️ 用户次数加载失败（可能未登录）:', result.error)
        this.setData({ userCounts: null })
      }
    } catch (error) {
      console.warn('⚠️ 用户次数加载异常:', error)
      this.setData({ userCounts: null })
    }
  },

  /**
   * 切换Tab
   */
  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ 
      currentTab: tab,
      selectedPlan: null,
      selectedPackage: null
    })
  },

  /**
   * 选择套餐
   */
  onSelectPlan(e) {
    const { planId } = e.currentTarget.dataset
    this.setData({ 
      selectedPlan: planId,
      selectedPackage: null
    })
  },

  /**
   * 选择次数套餐
   */
  onSelectPackage(e) {
    const packageId = e.currentTarget.dataset.packageId
    this.setData({ 
      selectedPackage: packageId,
      selectedPlan: null
    })
  },

  /**
   * 开始免费试用
   */
  async onStartTrial() {
    if (this.data.purchasing) return

    this.setData({ purchasing: true })

    try {
      const success = await startFreeTrial()
      
      if (success) {
        // 试用成功，刷新订阅信息
        await this.refreshSubscriptionInfo()
        
        // 通知其他页面订阅状态变更
        notifySubscriptionChange()
        
        // 显示成功页面或返回上一页
        setTimeout(() => {
          wx.showModal({
            title: '试用开始',
            content: '恭喜！您已成功开始7天免费试用。现在可以体验所有高级功能了！',
            confirmText: '立即体验',
            showCancel: false,
            success: () => {
              wx.navigateBack()
            }
          })
        }, 500)
      }
      
    } catch (error) {
      console.error('开始试用失败:', error)
    } finally {
      this.setData({ purchasing: false })
    }
  },

  /**
   * 购买订阅或次数套餐
   */
  async onPurchaseSubscription() {
    if (this.data.purchasing) return

    if (this.data.currentTab === 'subscription') {
      // 购买订阅套餐
      if (!this.data.selectedPlan) {
        wx.showToast({
          title: '请选择套餐',
          icon: 'error'
        })
        return
      }

      const selectedPlan = this.data.subscriptionPlans.find(plan => plan.id === this.data.selectedPlan)
      if (!selectedPlan) {
        wx.showToast({
          title: '套餐信息错误',
          icon: 'error'
        })
        return
      }

      wx.showModal({
        title: '确认订阅',
        content: `确定要订阅 ${selectedPlan.name}（¥${selectedPlan.price}）吗？`,
        success: (res) => {
          if (res.confirm) {
            this.processPurchase(selectedPlan, 'subscription')
          }
        }
      })
    } else if (this.data.currentTab === 'package') {
      // 购买次数套餐
      if (!this.data.selectedPackage) {
        wx.showToast({
          title: '请选择次数套餐',
          icon: 'error'
        })
        return
      }

      const selectedPackage = this.data.countPackages.find(pkg => pkg.id === this.data.selectedPackage)
      if (!selectedPackage) {
        wx.showToast({
          title: '套餐信息错误',
          icon: 'error'
        })
        return
      }

      wx.showModal({
        title: '确认购买',
        content: `确定要购买 ${selectedPackage.name}（¥${selectedPackage.price}）吗？`,
        success: (res) => {
          if (res.confirm) {
            this.processPurchase(selectedPackage, 'package')
          }
        }
      })
    }
  },

  /**
   * 处理购买流程
   */
  async processPurchase(plan, type = 'subscription') {
    this.setData({ purchasing: true })

    try {
      wx.showLoading({ title: '创建订单...' })
      
      // 1. 创建订单
      console.log('🛍️ 开始创建订单:', { type, planId: plan.id })
      
      let orderResult
      if (type === 'subscription') {
        orderResult = await SubscriptionAPI.createOrder({
          plan_id: plan.id
        })
      } else if (type === 'package') {
        orderResult = await CountPackageAPI.createOrder({
          plan_id: plan.id
        })
      }
      
      console.log('🛍️ 订单创建结果:', { 
        success: orderResult.success, 
        hasData: !!orderResult.data,
        error: orderResult.error 
      })
      
      if (!orderResult.success) {
        console.error('❌ 订单创建失败:', orderResult.error)
        throw new Error(orderResult.error || '创建订单失败')
      }
      
      const orderData = orderResult.data
      wx.hideLoading()
      
      // 2. 调用微信支付
      if (orderData.payment_params) {
        console.log('调用微信支付:', orderData.payment_params)
        
        wx.showLoading({ title: '正在支付...' })
        
        try {
          await this.callWechatPay(orderData.payment_params)
          
          // 3. 支付成功，查询订单状态
          wx.hideLoading()
          wx.showLoading({ title: '确认支付状态...' })
          
          const paymentSuccess = await this.verifyPaymentStatus(orderData.order_no)
          wx.hideLoading()
          
          if (paymentSuccess) {
            // 支付成功
            await this.refreshSubscriptionInfo()
            notifySubscriptionChange()
            
            wx.showModal({
              title: '订阅成功',
              content: `恭喜！您已成功订阅 ${plan.name}。现在可以无限制使用所有功能了！`,
              confirmText: '立即体验',
              showCancel: false,
              success: () => {
                wx.navigateBack()
              }
            })
          } else {
            throw new Error('支付状态确认失败')
          }
          
        } catch (payError) {
          wx.hideLoading()
          console.error('微信支付失败:', payError)
          
          // 支付失败，但不一定是真的失败，可能是用户取消
          if (payError.errMsg && payError.errMsg.includes('cancel')) {
            wx.showToast({
              title: '支付已取消',
              icon: 'none'
            })
          } else {
            wx.showModal({
              title: '支付失败',
              content: '支付过程中出现问题，请稍后重试',
              showCancel: false
            })
          }
        }
      } else {
        // 如果没有支付参数，可能是免费套餐或者开发模式
        console.log('无需支付或开发模式')
        
        // 模拟支付延迟
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // 调用后台订阅接口
        const result = await SubscriptionAPI.subscribe({
          type: plan.type,
          duration: plan.duration
        })
        
        wx.hideLoading()
        
        if (result.success) {
          // 订阅成功
          await this.refreshSubscriptionInfo()
          notifySubscriptionChange()
          
          wx.showModal({
            title: '订阅成功',
            content: `恭喜！您已成功订阅 ${plan.name}。现在可以无限制使用所有功能了！`,
            confirmText: '立即体验',
            showCancel: false,
            success: () => {
              wx.navigateBack()
            }
          })
        } else {
          throw new Error(result.error || '订阅失败')
        }
      }
      
    } catch (error) {
      wx.hideLoading()
      console.error('购买失败:', error)
      
      // 根据不同错误类型提供不同的用户提示
      let errorTitle = '购买失败'
      let errorContent = error.message || '购买过程中出现错误，请稍后重试'
      
      if (error.message && error.message.includes('404')) {
        errorTitle = '服务维护中'
        errorContent = '订阅服务正在维护升级，请稍后重试。如问题持续存在，请联系客服。'
      } else if (error.message && error.message.includes('网络')) {
        errorTitle = '网络异常'
        errorContent = '网络连接异常，请检查网络设置后重试。'
      } else if (error.statusCode === 401) {
        errorTitle = '登录过期'
        errorContent = '登录状态已过期，请重新登录后再试。'
      }
      
      wx.showModal({
        title: errorTitle,
        content: errorContent,
        showCancel: false
      })
    } finally {
      this.setData({ purchasing: false })
    }
  },

  /**
   * 调用微信支付
   */
  async callWechatPay(paymentParams) {
    return new Promise((resolve, reject) => {
      wx.requestPayment({
        timeStamp: paymentParams.timeStamp,
        nonceStr: paymentParams.nonceStr,
        package: paymentParams.package,
        signType: paymentParams.signType,
        paySign: paymentParams.paySign,
        success: (res) => {
          console.log('微信支付成功:', res)
          resolve(res)
        },
        fail: (err) => {
          console.error('微信支付失败:', err)
          reject(err)
        }
      })
    })
  },

  /**
   * 验证支付状态
   */
  async verifyPaymentStatus(orderNo, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await SubscriptionAPI.queryOrder(orderNo)
        
        if (result.success) {
          const orderStatus = result.data.status
          
          if (orderStatus === 'paid') {
            return true
          } else if (orderStatus === 'expired' || orderStatus === 'cancelled') {
            return false
          }
          // 如果状态是pending，继续重试
        }
        
        // 等待1秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error('查询支付状态失败:', error)
        if (i === maxRetries - 1) {
          throw error
        }
      }
    }
    
    return false
  },

  /**
   * 模拟微信支付
   */
  async mockWechatPay(plan) {
    return new Promise((resolve, reject) => {
      // 这里应该是真实的微信支付调用
      wx.requestPayment({
        timeStamp: String(Date.now()),
        nonceStr: 'mock_nonce_str',
        package: 'mock_package',
        signType: 'MD5',
        paySign: 'mock_pay_sign',
        success: resolve,
        fail: reject
      })
    })
  },

  /**
   * 查看用户协议
   */
  onViewAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '这里是用户协议和隐私政策的内容...\n\n1. 订阅服务条款\n2. 隐私保护政策\n3. 退款说明\n4. 服务使用规范',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  /**
   * 联系客服
   */
  onContactService() {
    wx.showModal({
      title: '联系客服',
      content: '如有任何问题，请通过以下方式联系我们：\n\n微信：healing-service\n邮箱：service@healing.com\n电话：400-123-4567',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  /**
   * 跳转到登录页面
   */
  onGoToLogin() {
    wx.navigateTo({
      url: '/pages/login/login',
      fail: () => {
        // 如果登录页面不存在，可以尝试其他页面或显示提示
        wx.showModal({
          title: '提示',
          content: '请通过首页或个人中心进行登录',
          showCancel: false,
          confirmText: '知道了'
        })
      }
    })
  },

  /**
   * 获取套餐特色标签
   */
  getPlanBadge(plan) {
    if (plan.discount) {
      return '优惠'
    }
    if (plan.type === 'vip') {
      return 'VIP'
    }
    if (plan.type === 'premium') {
      return '推荐'
    }
    return ''
  },

  /**
   * 格式化价格显示
   */
  formatPrice(price) {
    if (price === 0) return '免费'
    return `¥${price}`
  },

  /**
   * 格式化套餐周期
   */
  formatDuration(duration) {
    if (duration === 7) return '7天'
    if (duration === 30) return '月套餐'
    if (duration === 365) return '年套餐'
    return `${duration}天`
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: 'AI疗愈 - 专业的个性化音乐治疗',
      path: '/pages/subscription/subscription',
      imageUrl: '/images/share-subscription.png'
    }
  },

  /**
   * 显示优惠券输入框
   */
  onShowCouponModal() {
    this.setData({ 
      showCouponModal: true,
      couponCode: ''
    })
  },

  /**
   * 隐藏优惠券输入框
   */
  onHideCouponModal() {
    this.setData({ 
      showCouponModal: false,
      couponCode: ''
    })
  },

  /**
   * 优惠券输入
   */
  onCouponInput(e) {
    this.setData({ couponCode: e.detail.value })
  },

  /**
   * 兑换优惠券
   */
  async onRedeemCoupon() {
    const { couponCode } = this.data
    
    if (!couponCode || !couponCode.trim()) {
      wx.showToast({
        title: '请输入优惠券码',
        icon: 'error'
      })
      return
    }

    try {
      wx.showLoading({ title: '兑换中...' })
      
      const result = await CountPackageAPI.redeemCoupon(couponCode.trim())
      
      wx.hideLoading()
      
      if (result.success) {
        // 兑换成功
        this.setData({ 
          showCouponModal: false,
          couponCode: ''
        })
        
        // 刷新用户次数信息
        await this.loadUserCounts()
        
        wx.showModal({
          title: '兑换成功',
          content: `恭喜！您已成功兑换优惠券。\n${result.data.message || '次数已添加到您的账户'}`,
          showCancel: false,
          confirmText: '知道了'
        })
      } else {
        throw new Error(result.error || '兑换失败')
      }
    } catch (error) {
      wx.hideLoading()
      console.error('优惠券兑换失败:', error)
      
      wx.showModal({
        title: '兑换失败',
        content: error.message || '优惠券兑换失败，请检查券码是否正确',
        showCancel: false
      })
    }
  }
})
