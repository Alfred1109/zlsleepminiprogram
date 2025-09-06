// pages/subscription/subscription.js
// 订阅管理页面
const app = getApp()
const { SubscriptionAPI, CountPackageAPI } = require('../../utils/healingApi')
const { getSubscriptionInfo, startFreeTrial, notifySubscriptionChange } = require('../../utils/subscription')
const { getPaymentConfig, getPaymentTimeout, getOrderQueryConfig } = require('../../utils/config')
const { PaymentConfig, PaymentUtils } = require('../../utils/paymentConfig')

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
    console.log('📱 订阅页面加载', options)
    
    // 检查支付环境
    const paymentEnv = PaymentConfig.checkPaymentEnvironment()
    if (!paymentEnv.isReady) {
      console.warn('⚠️ 支付环境检查失败，某些功能可能不可用')
      if (!paymentEnv.configValid) {
        const validation = PaymentConfig.validateConfig()
        console.error('❌ 支付配置验证失败:', validation.errors)
      }
    }
    
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
        
        // 直接使用后端返回的订阅套餐数据，并格式化价格
        console.log('🔍 开始处理订阅套餐数据...')
        
        const plans = (result.data || []).map((plan, index) => {
          try {
            console.log(`📋 处理套餐 ${index}:`, plan.name)
            
            // 处理features数据，确保每个feature都是字符串
            let processedFeatures = ['无限制使用所有功能'] // 默认值
            
            if (plan.features && Array.isArray(plan.features)) {
              processedFeatures = plan.features.map((feature, fIndex) => {
                // 如果feature是对象，尝试提取有意义的字符串
                if (typeof feature === 'object' && feature !== null) {
                  console.log(`🔧 Feature ${fIndex} 是对象，尝试转换:`, feature)
                  // 常见的对象结构处理
                  if (feature.name) return feature.name
                  if (feature.text) return feature.text
                  if (feature.description) return feature.description
                  if (feature.title) return feature.title
                  // 如果是对象但没有明确的文本字段，返回JSON字符串
                  return JSON.stringify(feature)
                }
                // 如果是字符串，直接返回
                return String(feature)
              })
            } else if (plan.features && typeof plan.features === 'string') {
              processedFeatures = [plan.features]
            } else if (plan.features && typeof plan.features === 'object' && !Array.isArray(plan.features)) {
              // 处理对象类型的features（如套餐0的结构）
              console.log('🔧 Features是对象格式，开始解析')
              processedFeatures = []
              
              Object.keys(plan.features).forEach(featureKey => {
                const featureObj = plan.features[featureKey]
                
                // 尝试从功能对象中提取描述文本
                if (featureObj && typeof featureObj === 'object') {
                  if (featureObj.name) {
                    processedFeatures.push(featureObj.name)
                  } else if (featureObj.description) {
                    processedFeatures.push(featureObj.description)
                  } else {
                    // 根据功能类型生成友好的描述
                    switch(featureKey) {
                      case 'ai_music':
                        processedFeatures.push('AI音乐生成功能')
                        break
                      case 'custom_1':
                        processedFeatures.push(featureObj.description || '专属定制服务')
                        break
                      case 'long_sequence':
                        processedFeatures.push('长序列音乐生成')
                        break
                      case 'music_download':
                        processedFeatures.push('音乐下载功能')
                        break
                      case 'music_generate':
                        processedFeatures.push('音乐生成服务')
                        break
                      case 'priority_support':
                        processedFeatures.push('优先客服支持')
                        break
                      case 'voice_interaction':
                        processedFeatures.push('语音交互功能')
                        break
                      default:
                        processedFeatures.push(`${featureKey}功能`)
                    }
                  }
                }
              })
              
              if (processedFeatures.length === 0) {
                processedFeatures = ['无限制使用所有功能']
              }
            }
            
            const processedPlan = {
              ...plan,
              formattedPrice: this.formatPrice(plan.price),
              features: processedFeatures
            }
            
            return processedPlan
          } catch (error) {
            console.error(`💥 处理套餐 ${index} 时出错:`, error, plan)
            return {
              id: plan.id || `error_${index}`,
              name: plan.name || '套餐名称错误',
              formattedPrice: '价格错误',
              features: ['数据处理错误']
            }
          }
        })
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
        
        // 直接使用后端返回的次数套餐数据，并格式化价格
        console.log('🔍 开始处理次数套餐数据...')
        
        const countPackages = (result.data || []).map((pkg, index) => {
          try {
            console.log(`🎁 处理次数套餐 ${index}:`, pkg.name)
            
            // 处理features数据，确保每个feature都是字符串（和订阅套餐相同逻辑）
            let processedFeatures = ['灵活按次使用'] // 次数套餐的默认值
            
            if (pkg.features && Array.isArray(pkg.features)) {
              processedFeatures = pkg.features.map((feature, fIndex) => {
                // 如果feature是对象，尝试提取有意义的字符串
                if (typeof feature === 'object' && feature !== null) {
                  console.log(`🔧 次数套餐 Feature ${fIndex} 是对象，尝试转换:`, feature)
                  // 常见的对象结构处理
                  if (feature.name) return feature.name
                  if (feature.text) return feature.text
                  if (feature.description) return feature.description
                  if (feature.title) return feature.title
                  // 如果是对象但没有明确的文本字段，返回JSON字符串
                  return JSON.stringify(feature)
                }
                // 如果是字符串，直接返回
                return String(feature)
              })
            } else if (pkg.features && typeof pkg.features === 'string') {
              processedFeatures = [pkg.features]
            }
            
            const processedPackage = {
              ...pkg,
              formattedPrice: this.formatPrice(pkg.price),
              features: processedFeatures
            }
            
            return processedPackage
          } catch (error) {
            console.error(`💥 处理次数套餐 ${index} 时出错:`, error, pkg)
            return {
              id: pkg.id || `error_${index}`,
              name: pkg.name || '套餐名称错误',
              formattedPrice: '价格错误',
              features: ['数据处理错误']
            }
          }
        })
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
      
      // 检查用户登录状态
      const AuthService = require('../../services/AuthService')
      const isLoggedIn = AuthService.isLoggedIn()
      const currentUser = AuthService.getCurrentUser()
      
      console.log('👤 用户登录状态:', isLoggedIn)
      console.log('👤 当前用户信息:', currentUser)
      
      if (!isLoggedIn) {
        console.log('⚠️ 用户未登录，跳过加载次数信息')
        this.setData({ userCounts: null })
        return
      }
      
      const result = await CountPackageAPI.getUserCounts()
      
      console.log('🔍 完整API响应:', result)
      console.log('🔍 响应状态:', result.success)
      console.log('🔍 响应数据类型:', typeof result.data)
      console.log('🔍 响应数据长度:', Array.isArray(result.data) ? result.data.length : 'not array')
      console.log('🔍 响应数据键:', result.data ? Object.keys(result.data) : 'no data')
      
      if (result.success) {
        console.log('✅ 用户次数加载成功')
        console.log('📊 原始用户次数数据:', result.data)
        
        // 处理用户次数数据，确保type字段是字符串
        let processedUserCounts = null
        
        console.log('🔧 开始处理数据...')
        console.log('🔧 数据是否存在:', !!result.data)
        console.log('🔧 数据是否为数组:', Array.isArray(result.data))
        console.log('🔧 数据是否为空对象:', result.data && Object.keys(result.data).length === 0)
        
        if (result.data && Array.isArray(result.data)) {
          console.log('📋 处理数组格式数据，长度:', result.data.length)
          processedUserCounts = result.data.map((countItem, index) => {
            
            // 确保type和type_name都是字符串
            let processedType = String(countItem.type || '未知类型')
            let processedTypeName = countItem.type_name
            
            // 如果type是对象，尝试提取有意义的字符串
            if (typeof countItem.type === 'object' && countItem.type !== null) {
              if (countItem.type.name) processedType = countItem.type.name
              else if (countItem.type.text) processedType = countItem.type.text
              else if (countItem.type.description) processedType = countItem.type.description
              else processedType = JSON.stringify(countItem.type)
            }
            
            // 如果type_name是对象，同样处理
            if (typeof countItem.type_name === 'object' && countItem.type_name !== null) {
              if (countItem.type_name.name) processedTypeName = countItem.type_name.name
              else if (countItem.type_name.text) processedTypeName = countItem.type_name.text
              else if (countItem.type_name.description) processedTypeName = countItem.type_name.description
              else processedTypeName = JSON.stringify(countItem.type_name)
            }
            
            const processed = {
              ...countItem,
              type: processedType,
              type_name: processedTypeName || processedType
            }
            
            return processed
          })
        } else if (result.data) {
          console.log('📋 处理对象格式数据')
          
          // 检查是否为空对象
          if (Object.keys(result.data).length === 0) {
            console.log('⚠️ 数据为空对象，可能原因：')
            console.log('   1. 用户还没有购买任何次数套餐')
            console.log('   2. 用户登录状态异常')
            console.log('   3. 后端数据库中没有该用户的次数记录')
            processedUserCounts = null
          } else {
            // 如果不是数组，可能是对象格式，尝试转换
            console.log('📋 尝试将对象转换为数组格式')
            processedUserCounts = result.data
          }
        } else {
          console.log('⚠️ 没有任何数据返回')
          processedUserCounts = null
        }
        
        console.log('🔍 处理后的用户次数数据:', processedUserCounts)
        
        this.setData({ 
          userCounts: processedUserCounts
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
        content: `确定要订阅 ${selectedPlan.name}（${selectedPlan.formattedPrice || this.formatPrice(selectedPlan.price)}）吗？`,
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
        content: `确定要购买 ${selectedPackage.name}（${selectedPackage.formattedPrice || this.formatPrice(selectedPackage.price)}）吗？`,
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
      
      // 使用AuthService统一获取用户信息，确保数据一致性
      const AuthService = require('../../services/AuthService')
      let userId = null
      
      try {
        // 首先检查登录状态
        if (!AuthService.isLoggedIn()) {
          throw new Error('用户未登录')
        }
        
        const userInfo = AuthService.getCurrentUser()
        if (!userInfo) {
          throw new Error('无法获取用户信息')
        }
        
        // 支持多种用户ID字段格式，确保兼容性
        userId = userInfo.id || userInfo.user_id || userInfo.userId
        if (!userId) {
          throw new Error('用户信息中缺少用户ID')
        }
        
        console.log('👤 获取到用户ID:', userId, '用户信息来源:', userInfo.username || 'unknown')
        
      } catch (e) {
        console.error('❌ 获取用户信息失败:', e.message)
        wx.hideLoading()
        wx.showModal({
          title: '用户信息异常',
          content: '无法获取用户信息，请重新登录后再试',
          showCancel: false,
          success: () => {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        })
        return
      }
      
      // 验证套餐信息完整性
      if (!plan || !plan.id) {
        throw new Error('套餐信息无效')
      }
      
      // 确保参数类型正确 - 很多后端期望字符串类型的ID
      const planId = String(plan.id)
      const userIdStr = String(userId)
      
      // 验证支付配置
      const paymentValidation = PaymentConfig.validateConfig()
      if (!paymentValidation.isValid) {
        console.error('❌ 支付配置验证失败:', paymentValidation.errors)
        throw new Error('支付配置错误: ' + paymentValidation.errors.join(', '))
      }
      
      // 使用 PaymentConfig 创建标准化的订单参数
      const orderData = PaymentConfig.createOrderParams(planId, userIdStr)
      
      // 详细的参数检查和日志
      console.log('📝 发送到服务器的订单数据详情:')
      console.log('  - plan_id:', orderData.plan_id, '(类型:', typeof orderData.plan_id, ')')
      console.log('  - user_id:', orderData.user_id, '(类型:', typeof orderData.user_id, ')')
      console.log('  - payment_config:')
      console.log('    - api_key:', orderData.payment_config.api_key ? '***已隐藏***' : '未设置')
      console.log('    - app_id:', orderData.payment_config.app_id, '(类型:', typeof orderData.payment_config.app_id, ')')
      console.log('    - timeout:', orderData.payment_config.timeout, '(类型:', typeof orderData.payment_config.timeout, ')')
      
      console.log('📋 套餐完整信息:', {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        type: typeof plan.id
      })
      
      // 记录支付事件
      PaymentConfig.logPaymentEvent('ORDER_CREATE_START', {
        plan_id: plan.id,
        plan_name: plan.name,
        plan_price: plan.price,
        type: type
      })
      
      let orderResult
      if (type === 'subscription') {
        console.log('📅 调用订阅套餐创建订单API')
        orderResult = await SubscriptionAPI.createOrder(orderData)
      } else if (type === 'package') {
        console.log('🎁 调用次数套餐创建订单API')
        orderResult = await CountPackageAPI.createOrder(orderData)
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
      
      const paymentData = orderResult.data
      wx.hideLoading()

      // 2. 调用微信支付
      if (paymentData.payment_params) {
        // 使用 PaymentConfig 格式化和验证支付参数
        const formattedParams = PaymentConfig.formatPaymentParams(paymentData)
        
        if (!formattedParams) {
          throw new Error('支付参数格式错误')
        }
        
        console.log('📱 调用微信支付，订单号:', paymentData.order_no)
        PaymentConfig.logPaymentEvent('WECHAT_PAY_START', {
          order_no: paymentData.order_no,
          plan_name: plan.name
        })
        
        wx.showLoading({ title: '正在支付...' })
        
        try {
          await this.callWechatPay(formattedParams)
          
          // 3. 支付成功，查询订单状态
          PaymentConfig.logPaymentEvent('WECHAT_PAY_SUCCESS', {
            order_no: paymentData.order_no
          })
          
          wx.hideLoading()
          wx.showLoading({ title: '确认支付状态...' })
          
          const paymentSuccess = await this.verifyPaymentStatus(paymentData.order_no)
          wx.hideLoading()
          
          if (paymentSuccess) {
            // 支付成功
            PaymentConfig.logPaymentEvent('PAYMENT_CONFIRMED', {
              order_no: paymentData.order_no,
              plan_name: plan.name
            })
            
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
          
          // 使用 PaymentConfig 处理支付错误
          const errorInfo = PaymentConfig.handlePaymentError(payError, '订阅支付')
          
          PaymentConfig.logPaymentEvent('PAYMENT_FAILED', {
            order_no: paymentData.order_no,
            error_type: errorInfo.type,
            error_message: errorInfo.message
          })
          
          if (errorInfo.showToUser) {
            if (errorInfo.type === 'USER_CANCEL') {
              wx.showToast({
                title: errorInfo.message,
                icon: 'none'
              })
            } else {
              wx.showModal({
                title: '支付失败',
                content: errorInfo.message,
                showCancel: false
              })
            }
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

      // 屏蔽后端/本地透传的 total_fee/totol_fee 文案（与小程序支付无关）
      try {
        const lowerMsg = (error.message || '').toLowerCase()
        if (lowerMsg.includes('total_fee') || lowerMsg.includes('totol_fee')) {
          console.warn('🚧 捕获到包含 total_fee/totol_fee 的错误信息，改为友好提示显示。原始信息:', error.message)
          errorTitle = '支付服务暂不可用'
          errorContent = '支付参数异常，请稍后重试或联系客服。'
        }
      } catch (_) {}
      
      console.error('💥 购买失败详细信息:', {
        errorMessage: error.message,
        statusCode: error.statusCode,
        errorCode: error.code,
        fullError: error
      })
      
      if (error.statusCode === 500) {
        errorTitle = '服务器错误'
        errorContent = '服务器处理订单时遇到问题。这可能是由于参数格式或支付配置问题导致的，请稍后重试。如问题持续存在，请联系客服。'
        
        // 记录详细的500错误信息以便调试
        PaymentConfig.logPaymentEvent('ORDER_CREATE_500_ERROR', {
          plan_id: plan?.id,
          error_message: error.message,
          error_details: error,
          timestamp: Date.now()
        })
      } else if (error.message && error.message.includes('404')) {
        errorTitle = '服务维护中'
        errorContent = '订阅服务正在维护升级，请稍后重试。如问题持续存在，请联系客服。'
      } else if (error.message && error.message.includes('网络')) {
        errorTitle = '网络异常'
        errorContent = '网络连接异常，请检查网络设置后重试。'
      } else if (error.statusCode === 401) {
        errorTitle = '登录过期'
        errorContent = '登录状态已过期，请重新登录后再试。'
      } else if (error.statusCode === 400) {
        errorTitle = '订单信息错误'
        errorContent = '订单信息有误，请重新选择套餐后再试。'
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
      console.log('🚀 准备调用微信支付，最终参数:')
      console.log('  - timeStamp:', paymentParams.timeStamp, typeof paymentParams.timeStamp)
      console.log('  - nonceStr:', paymentParams.nonceStr, typeof paymentParams.nonceStr)
      console.log('  - package:', paymentParams.package, typeof paymentParams.package)
      console.log('  - signType:', paymentParams.signType, typeof paymentParams.signType) 
      console.log('  - paySign:', paymentParams.paySign, typeof paymentParams.paySign)
      
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
          if (err && err.errMsg) {
            console.error('微信支付失败 errMsg:', err.errMsg)
          }
          reject(err)
        }
      })
    })
  },

  /**
   * 验证支付状态
   */
  async verifyPaymentStatus(orderNo, maxRetries = null) {
    // 使用配置中的重试设置
    const orderQueryConfig = getOrderQueryConfig()
    const retryCount = maxRetries || orderQueryConfig.retryCount
    const retryInterval = orderQueryConfig.retryInterval
    
    console.log(`🔍 开始验证支付状态，订单号: ${orderNo}，重试次数: ${retryCount}，重试间隔: ${retryInterval}ms`)
    
    for (let i = 0; i < retryCount; i++) {
      try {
        const result = await SubscriptionAPI.queryOrder(orderNo)
        
        if (result.success) {
          const orderStatus = result.data.status
          
          console.log(`📊 第${i+1}次查询，订单状态: ${orderStatus}`)
          
          if (orderStatus === 'paid') {
            console.log('✅ 支付状态验证成功')
            return true
          } else if (orderStatus === 'expired' || orderStatus === 'cancelled') {
            console.log('❌ 订单已过期或取消')
            return false
          }
          // 如果状态是pending，继续重试
        }
        
        // 等待配置的间隔时间后重试
        if (i < retryCount - 1) {
          console.log(`⏳ 等待 ${retryInterval}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, retryInterval))
        }
        
      } catch (error) {
        console.error(`❌ 第${i+1}次查询支付状态失败:`, error)
        if (i === retryCount - 1) {
          throw error
        }
      }
    }
    
    console.log('❌ 支付状态验证失败，已达到最大重试次数')
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
    // 使用 PaymentUtils 统一的价格格式化函数
    return PaymentUtils.formatPrice(price)
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
