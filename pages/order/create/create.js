const productApi = require('../../../utils/productApi')
const AuthService = require('../../../services/AuthService')

Page({
  data: {
    // 订单数据
    orderData: null,
    productInfo: null,
    
    // 地址信息
    selectedAddress: null,
    addressList: [],
    showAddressSelector: false,
    
    // 配送方式
    deliveryMethods: [],
    selectedDeliveryMethod: 'express', // express: 快递, pickup: 自提
    deliveryFee: 0,
    
    // 订单计算
    productTotal: 0, // 商品总价
    deliveryTotal: 0, // 配送费
    discountTotal: 0, // 优惠金额
    finalTotal: 0, // 最终总价
    
    // 优惠券
    availableCoupons: [],
    selectedCoupon: null,
    showCouponSelector: false,
    
    // 支付方式
    paymentMethods: [
      { id: 'wechat', name: '微信支付', icon: '/images/wechat-pay.svg' },
      { id: 'balance', name: '余额支付', icon: '/images/balance-pay.svg' }
    ],
    selectedPaymentMethod: 'wechat',
    
    // 备注
    orderNote: '',
    
    // 提交状态
    isSubmitting: false,
    
    // 加载状态
    loading: true
  },

  async onLoad(options) {
    console.log('订单创建页面参数:', options)
    
    // 首先检查用户登录状态
    try {
      const isLoggedIn = await this.checkUserLogin()
      if (!isLoggedIn) {
        return // 如果未登录，checkUserLogin 会处理跳转
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        complete: () => {
          wx.navigateTo({
            url: '/pages/login/login'
          })
        }
      })
      return
    }
    
    if (options.data) {
      try {
        const orderData = JSON.parse(decodeURIComponent(options.data))
        this.setData({ orderData })
        this.initOrderPage()
      } catch (error) {
        console.error('解析订单数据失败:', error)
        wx.showToast({
          title: '订单数据错误',
          icon: 'error',
          complete: () => wx.navigateBack()
        })
      }
    } else {
      wx.showToast({
        title: '缺少订单信息',
        icon: 'error',
        complete: () => wx.navigateBack()
      })
    }
  },

  // 检查用户登录状态
  async checkUserLogin() {
    try {
      console.log('检查订单页面用户登录状态...')
      
      const currentUser = AuthService.getCurrentUser()
      const hasToken = AuthService.getAccessToken()
      
      console.log('登录状态检查:', {
        hasUser: !!currentUser,
        hasToken: !!hasToken,
        userInfo: currentUser
      })
      
      if (!currentUser || !hasToken) {
        console.log('用户未登录，跳转到登录页面')
        wx.showModal({
          title: '需要登录',
          content: '购买商品需要先登录账户',
          confirmText: '去登录',
          cancelText: '返回',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({
                url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/order/create/create')
              })
            } else {
              wx.navigateBack()
            }
          }
        })
        return false
      }
      
      // 验证token有效性
      try {
        await AuthService.ensureValidToken()
        console.log('✅ Token验证通过')
        return true
      } catch (error) {
        console.error('❌ Token验证失败:', error)
        wx.showModal({
          title: '登录已过期',
          content: '请重新登录',
          confirmText: '去登录',
          cancelText: '返回',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({
                url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/order/create/create')
              })
            } else {
              wx.navigateBack()
            }
          }
        })
        return false
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
      return false
    }
  },

  // 初始化订单页面
  async initOrderPage() {
    this.setData({ loading: true })
    
    try {
      await Promise.all([
        this.loadProductInfo(),
        this.loadAddressList(),
        this.loadDeliveryMethods(),
        this.loadAvailableCoupons()
      ])
      
      // 计算初始价格
      this.calculateTotal()
      
    } catch (error) {
      console.error('初始化订单页面失败:', error)
      
      // 根据具体错误提供不同的提示
      let errorMessage = '加载失败，请重试'
      
      if (error.message && error.message.includes('商品')) {
        errorMessage = '商品信息加载失败'
      } else if (error.message && error.message.includes('网络')) {
        errorMessage = '网络连接异常，请检查网络'
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000
      })
      
      // 如果是关键错误，可以考虑返回上一页
      if (error.message && error.message.includes('商品不存在')) {
        setTimeout(() => {
          wx.navigateBack()
        }, 2000)
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载商品信息
  async loadProductInfo() {
    const { orderData } = this.data
    
    try {
      const response = await productApi.getProductDetail(orderData.productId)
      
      if (response.success) {
        // 计算商品价格
        const unitPrice = orderData.skuId 
          ? (response.data.skus.find(sku => sku.id === orderData.skuId)?.price || response.data.price)
          : response.data.price
        
        const productInfo = {
          ...response.data,
          selectedSpecs: orderData.specs,
          quantity: orderData.quantity,
          skuId: orderData.skuId,
          displayPrice: (unitPrice / 100).toFixed(2),
          displayOriginalPrice: response.data.original_price ? (response.data.original_price / 100).toFixed(2) : null
        }
        
        const productTotal = unitPrice * orderData.quantity
        
        this.setData({
          productInfo,
          productTotal
        })
      }
    } catch (error) {
      console.error('加载商品信息失败:', error)
      throw error
    }
  },

  // 加载地址列表
  async loadAddressList() {
    try {
      const response = await productApi.getAddressList()
      
      if (response.success) {
        const addressList = response.data || []
        const defaultAddress = addressList.find(addr => addr.isDefault) || addressList[0]
        
        this.setData({
          addressList,
          selectedAddress: defaultAddress || null
        })
        
        // 如果有默认地址，计算配送费
        if (defaultAddress) {
          this.calculateDeliveryFee()
        }
      }
    } catch (error) {
      console.error('加载地址列表失败:', error)
      // 地址加载失败不阻塞订单创建
    }
  },

  // 加载配送方式
  async loadDeliveryMethods() {
    // 默认配送方式（确保数据结构完整）
    const defaultDeliveryMethods = [
      { 
        id: 'express', 
        key: 'express',
        name: '快递配送', 
        fee: 0, 
        description: '48小时内发货',
        requires_address: true
      },
      { 
        id: 'pickup', 
        key: 'pickup',
        name: '门店自提', 
        fee: 0, 
        description: '预约到店自提',
        requires_address: false
      }
    ]
    
    try {
      const response = await productApi.getDeliveryMethods()
      
      if (response.success && response.data && response.data.length > 0) {
        console.log('✅ 成功获取配送方式:', response.data)
        
        // 确保API返回的数据也有id字段
        const processedMethods = response.data.map(method => ({
          ...method,
          id: method.id || method.key || method.name // 确保有id字段
        }))
        
        this.setData({
          deliveryMethods: processedMethods
        })
      } else {
        console.log('⚠️ API返回空数据，使用默认配送方式')
        this.setData({
          deliveryMethods: defaultDeliveryMethods
        })
      }
    } catch (error) {
      console.log('⚠️ 配送方式API调用失败，使用默认配送方式:', error.message)
      // 静默处理，使用默认配送方式，不显示错误提示给用户
      this.setData({
        deliveryMethods: defaultDeliveryMethods
      })
    }
    
    // 确保有默认选中的配送方式
    this.ensureValidDeliverySelection()
  },

  // 确保有效的配送方式选择
  ensureValidDeliverySelection() {
    const { deliveryMethods, selectedDeliveryMethod } = this.data
    
    // 如果没有配送方式，直接返回
    if (!deliveryMethods || deliveryMethods.length === 0) {
      console.warn('没有可用的配送方式')
      return
    }
    
    // 检查当前选中的配送方式是否有效
    const isCurrentSelectionValid = deliveryMethods.some(method => method.id === selectedDeliveryMethod)
    
    if (!isCurrentSelectionValid) {
      // 如果当前选择无效，默认选择第一个配送方式
      const defaultMethod = deliveryMethods[0]
      console.log('配送方式选择无效，默认选择:', defaultMethod.name)
      this.setData({
        selectedDeliveryMethod: defaultMethod.id
      })
    }
  },

  // 加载可用优惠券
  async loadAvailableCoupons() {
    try {
      // 计算当前订单金额
      const orderAmount = this.calculateOrderAmount()
      
      console.log('开始加载可用优惠券，订单金额:', orderAmount)
      
      const response = await productApi.getAvailableCoupons(orderAmount)
      
      if (response.success && response.data) {
        console.log('✅ 成功获取优惠券:', response.data.length, '张')
        
        // 处理优惠券数据，转换为订单页面需要的格式
        const processedCoupons = response.data.map(coupon => ({
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          description: coupon.description,
          discount: coupon.calculated_discount || coupon.discount_value,
          minAmount: coupon.min_amount || 0,
          type: coupon.discount_type, // 'fixed' 或 'percent'
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
          maxDiscount: coupon.max_discount,
          // 显示用的折扣信息
          displayDiscount: this.formatCouponDiscount(coupon)
        }))
        
        this.setData({
          availableCoupons: processedCoupons
        })
        
        console.log('处理后的优惠券数据:', processedCoupons)
      } else {
        console.log('⚠️ 暂无可用优惠券')
        this.setData({
          availableCoupons: []
        })
      }
    } catch (error) {
      console.error('加载优惠券失败:', error)
      // 静默处理，不显示错误给用户
      this.setData({
        availableCoupons: []
      })
    }
  },
  
  // 计算当前订单金额（不含配送费）
  calculateOrderAmount() {
    const { productTotal } = this.data
    return productTotal / 100 // 转换为元（后端存储是分）
  },
  
  // 格式化优惠券折扣显示
  formatCouponDiscount(coupon) {
    if (coupon.discount_type === 'fixed') {
      // 固定金额：显示"¥10"
      return `¥${coupon.discount_value}`
    } else if (coupon.discount_type === 'percent') {
      // 百分比：显示"8折"
      const percent = Math.round(coupon.discount_value * 10)
      return `${percent}折`
    }
    return '优惠券'
  },

  // 地址相关
  showAddressSelector() {
    this.setData({ showAddressSelector: true })
  },

  hideAddressSelector() {
    this.setData({ showAddressSelector: false })
  },

  selectAddress(e) {
    const addressId = e.currentTarget.dataset.id
    const selectedAddress = this.data.addressList.find(addr => addr.id === addressId)
    
    this.setData({
      selectedAddress,
      showAddressSelector: false
    })
    
    // 重新计算配送费
    this.calculateDeliveryFee()
  },

  // 新增地址
  addNewAddress() {
    wx.navigateTo({
      url: '/pages/address/edit/edit?mode=create&redirect=' + encodeURIComponent('/pages/order/create/create')
    })
  },

  // 编辑地址
  editAddress() {
    if (!this.data.selectedAddress) return
    
    wx.navigateTo({
      url: `/pages/address/edit/edit?mode=edit&id=${this.data.selectedAddress.id}&redirect=` + encodeURIComponent('/pages/order/create/create')
    })
  },

  // 配送方式选择
  selectDeliveryMethod(e) {
    const methodId = e.currentTarget.dataset.id
    
    // 验证methodId有效性，避免设置undefined
    if (!methodId) {
      console.warn('配送方式ID无效:', methodId)
      return
    }
    
    // 确保所选的配送方式在可用列表中
    const isValidMethod = this.data.deliveryMethods.some(method => method.id === methodId)
    if (!isValidMethod) {
      console.warn('无效的配送方式ID:', methodId)
      return
    }
    
    this.setData({ selectedDeliveryMethod: methodId })
    this.calculateDeliveryFee()
  },

  // 计算配送费
  async calculateDeliveryFee() {
    const { selectedAddress, selectedDeliveryMethod, productInfo } = this.data
    
    if (!selectedAddress || selectedDeliveryMethod === 'pickup') {
      this.setData({ deliveryFee: 0 })
      this.calculateTotal()
      return
    }
    
    try {
      const response = await productApi.calculateDeliveryFee(selectedAddress.id, [{
        productId: productInfo.id,
        quantity: productInfo.quantity,
        skuId: productInfo.skuId
      }])
      
      if (response.success) {
        this.setData({ deliveryFee: response.data.fee || 0 })
      }
    } catch (error) {
      console.error('计算配送费失败:', error)
      this.setData({ deliveryFee: 0 })
    }
    
    this.calculateTotal()
  },

  // 优惠券相关
  showCouponSelector() {
    this.setData({ showCouponSelector: true })
  },

  hideCouponSelector() {
    this.setData({ showCouponSelector: false })
  },

  selectCoupon(e) {
    const couponId = e.currentTarget.dataset.id
    
    // 如果couponId为空，表示不使用优惠券
    let selectedCoupon = null
    if (couponId && couponId !== '') {
      selectedCoupon = this.data.availableCoupons.find(coupon => coupon.id === couponId)
      // 确保找到了优惠券，避免设置undefined
      if (!selectedCoupon) {
        console.warn('未找到对应的优惠券:', couponId)
        selectedCoupon = null
      }
    }
    
    this.setData({
      selectedCoupon,
      showCouponSelector: false
    })
    
    this.calculateTotal()
  },

  removeCoupon() {
    this.setData({ selectedCoupon: null })
    this.calculateTotal()
  },

  // 支付方式选择
  selectPaymentMethod(e) {
    const methodId = e.currentTarget.dataset.id
    
    // 验证methodId有效性，避免设置undefined
    if (!methodId) {
      console.warn('支付方式ID无效:', methodId)
      return
    }
    
    // 确保所选的支付方式在可用列表中
    const isValidMethod = this.data.paymentMethods.some(method => method.id === methodId)
    if (!isValidMethod) {
      console.warn('无效的支付方式ID:', methodId)
      return
    }
    
    this.setData({ selectedPaymentMethod: methodId })
  },

  // 备注输入
  onNoteInput(e) {
    this.setData({ orderNote: e.detail.value })
  },

  // 计算优惠券折扣金额
  calculateCouponDiscount() {
    const { selectedCoupon, productTotal } = this.data
    
    if (!selectedCoupon || !productTotal) {
      return 0
    }
    
    const orderAmount = productTotal / 100 // 转换为元
    let discountAmount = 0
    
    // 检查最低消费金额
    if (selectedCoupon.minAmount && orderAmount < selectedCoupon.minAmount) {
      return 0
    }
    
    if (selectedCoupon.discountType === 'fixed') {
      // 固定金额折扣
      discountAmount = Math.min(selectedCoupon.discountValue, orderAmount)
    } else if (selectedCoupon.discountType === 'percent') {
      // 百分比折扣
      discountAmount = orderAmount * (1 - selectedCoupon.discountValue)
      if (selectedCoupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, selectedCoupon.maxDiscount)
      }
    }
    
    return Math.max(0, Math.round(discountAmount * 100)) // 转换回分并四舍五入
  },

  // 计算总价
  calculateTotal() {
    const { productTotal, deliveryFee } = this.data
    const discountTotal = this.calculateCouponDiscount()
    const finalTotal = Math.max(0, productTotal + deliveryFee - discountTotal)
    
    this.setData({
      deliveryTotal: deliveryFee,
      discountTotal,
      finalTotal,
      // 格式化显示价格（已经是分为单位，直接除以100转为元）
      displayProductTotal: (productTotal / 100).toFixed(2),
      displayDeliveryTotal: deliveryFee > 0 ? (deliveryFee / 100).toFixed(2) : '0.00',
      displayDiscountTotal: discountTotal > 0 ? (discountTotal / 100).toFixed(2) : '0.00',
      displayFinalTotal: (finalTotal / 100).toFixed(2)
    })
  },

  // 提交订单
  async submitOrder() {
    if (this.data.isSubmitting) return
    
    const { 
      orderData, 
      productInfo, 
      selectedAddress, 
      selectedDeliveryMethod, 
      selectedPaymentMethod,
      selectedCoupon,
      orderNote,
      finalTotal 
    } = this.data
    
    // 验证必要信息
    if (selectedDeliveryMethod === 'express' && !selectedAddress) {
      wx.showToast({
        title: '请选择收货地址',
        icon: 'error'
      })
      return
    }
    
    this.setData({ isSubmitting: true })
    
    try {
      // 构建订单提交数据
      const submitData = {
        plan_id: orderData.productId,  // 后端期望的参数名
        quantity: orderData.quantity,
        
        // 地址和配送
        shipping_type: selectedDeliveryMethod,  // 后端期望的参数名
        
        // 支付方式
        paymentMethod: selectedPaymentMethod,
        
        // 价格信息（转换为分）
        productTotal: this.data.productTotal,
        deliveryTotal: this.data.deliveryTotal,
        discountTotal: this.data.discountTotal,
        finalTotal: finalTotal
      }
      
      // 可选字段，只在有值时添加
      if (orderData.skuId) {
        submitData.skuId = orderData.skuId
      }
      
      if (orderData.specs && Object.keys(orderData.specs).length > 0) {
        submitData.specs = orderData.specs
      }
      
      if (selectedAddress && selectedDeliveryMethod === 'express') {
        submitData.address_id = selectedAddress.id  // 后端期望的参数名
      }
      
      if (selectedCoupon) {
        submitData.coupon_id = selectedCoupon.id  // 后端期望的参数名
      }
      
      if (orderNote && orderNote.trim()) {
        submitData.user_remark = orderNote.trim()  // 后端期望的参数名
      }
      
      // 追踪参数（可选）
      if (orderData.qrCode) {
        submitData.qr_code = orderData.qrCode  // 后端期望的参数名
      }
      if (orderData.source) {
        submitData.source = orderData.source
      }
      if (orderData.referrer) {
        submitData.referrer = orderData.referrer
      }
      if (orderData.listPosition !== undefined) {
        submitData.listPosition = orderData.listPosition
      }
      
      console.log('提交订单数据:', submitData)
      
      const response = await productApi.createOrder(submitData)
      
      if (response.success) {
        const orderInfo = response.data
        
        // 如果选择微信支付，发起支付
        if (selectedPaymentMethod === 'wechat') {
          await this.initiateWeChatPay(orderInfo.orderId)
        } else {
          // 其他支付方式或者订单创建成功
          wx.showToast({
            title: '订单创建成功',
            icon: 'success',
            success: () => {
              // 跳转到订单详情或支付页面
              setTimeout(() => {
                wx.redirectTo({
                  url: `/pages/order/detail/detail?id=${orderInfo.orderId}`
                })
              }, 1500)
            }
          })
        }
      } else {
        throw new Error(response.error || '订单创建失败')
      }
      
    } catch (error) {
      console.error('提交订单失败:', error)
      
      // 根据错误类型提供更友好的提示
      let errorMessage = '提交失败，请重试'
      
      if (error.details && error.details.statusCode === 400) {
        if (error.details.data && error.details.data.message) {
          errorMessage = error.details.data.message
        } else {
          errorMessage = '订单信息有误，请检查后重试'
        }
      } else if (error.details && error.details.statusCode === 401) {
        errorMessage = '请先登录'
        // 可以考虑跳转到登录页面
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/login/login'
          })
        }, 2000)
      } else if (error.details && error.details.statusCode === 404) {
        errorMessage = '商品不存在或已下架'
      } else if (error.details && error.details.statusCode >= 500) {
        errorMessage = '服务器繁忙，请稍后重试'
      } else if (error.error) {
        errorMessage = error.error
      } else if (error.message) {
        errorMessage = error.message
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      })
    } finally {
      this.setData({ isSubmitting: false })
    }
  },

  // 发起微信支付
  async initiateWeChatPay(orderId) {
    try {
      const paymentResponse = await productApi.getPaymentParams(orderId)
      
      if (paymentResponse.success) {
        const paymentParams = paymentResponse.data
        
        // 调用微信支付
        wx.requestPayment({
          ...paymentParams,
          success: (res) => {
            wx.showToast({
              title: '支付成功',
              icon: 'success',
              success: () => {
                setTimeout(() => {
                  wx.redirectTo({
                    url: `/pages/order/detail/detail?id=${orderId}`
                  })
                }, 1500)
              }
            })
          },
          fail: (err) => {
            console.error('微信支付失败:', err)
            if (err.errMsg.includes('cancel')) {
              wx.showToast({
                title: '支付已取消',
                icon: 'none'
              })
            } else {
              wx.showToast({
                title: '支付失败',
                icon: 'error'
              })
            }
            
            // 支付失败，跳转到订单详情页面
            setTimeout(() => {
              wx.redirectTo({
                url: `/pages/order/detail/detail?id=${orderId}`
              })
            }, 1500)
          }
        })
      } else {
        throw new Error(paymentResponse.error || '获取支付参数失败')
      }
    } catch (error) {
      console.error('发起支付失败:', error)
      wx.showToast({
        title: error.message || '支付失败',
        icon: 'error'
      })
    }
  }
})
