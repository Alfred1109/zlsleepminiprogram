const productApi = require('../../../utils/productApi')

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

  onLoad(options) {
    console.log('订单创建页面参数:', options)
    
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
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
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
        const productInfo = {
          ...response.data,
          selectedSpecs: orderData.specs,
          quantity: orderData.quantity,
          skuId: orderData.skuId
        }
        
        // 计算商品价格
        const unitPrice = orderData.skuId 
          ? (response.data.skus.find(sku => sku.id === orderData.skuId)?.price || response.data.price)
          : response.data.price
        
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
          selectedAddress: defaultAddress
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
    try {
      const response = await productApi.getDeliveryMethods()
      
      if (response.success) {
        this.setData({
          deliveryMethods: response.data || [
            { id: 'express', name: '快递配送', fee: 0, description: '48小时内发货' },
            { id: 'pickup', name: '门店自提', fee: 0, description: '预约到店自提' }
          ]
        })
      }
    } catch (error) {
      console.error('加载配送方式失败:', error)
      // 使用默认配送方式
      this.setData({
        deliveryMethods: [
          { id: 'express', name: '快递配送', fee: 0, description: '48小时内发货' },
          { id: 'pickup', name: '门店自提', fee: 0, description: '预约到店自提' }
        ]
      })
    }
  },

  // 加载可用优惠券
  async loadAvailableCoupons() {
    try {
      // 这里应该调用获取可用优惠券的API
      // 暂时使用模拟数据
      this.setData({
        availableCoupons: [
          { id: '1', name: '新用户专享', discount: 10, minAmount: 100, type: 'amount' },
          { id: '2', name: '满减优惠', discount: 0.9, minAmount: 200, type: 'percent' }
        ]
      })
    } catch (error) {
      console.error('加载优惠券失败:', error)
    }
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
    const selectedCoupon = this.data.availableCoupons.find(coupon => coupon.id === couponId)
    
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
    this.setData({ selectedPaymentMethod: methodId })
  },

  // 备注输入
  onNoteInput(e) {
    this.setData({ orderNote: e.detail.value })
  },

  // 计算总价
  calculateTotal() {
    const { productTotal, deliveryFee, selectedCoupon } = this.data
    
    let discountTotal = 0
    let finalTotal = productTotal + deliveryFee
    
    // 计算优惠券折扣
    if (selectedCoupon) {
      if (productTotal >= selectedCoupon.minAmount) {
        if (selectedCoupon.type === 'amount') {
          discountTotal = selectedCoupon.discount
        } else if (selectedCoupon.type === 'percent') {
          discountTotal = productTotal * (1 - selectedCoupon.discount)
        }
      }
    }
    
    finalTotal = Math.max(0, finalTotal - discountTotal)
    
    this.setData({
      deliveryTotal: deliveryFee,
      discountTotal,
      finalTotal
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
        productId: orderData.productId,
        skuId: orderData.skuId,
        quantity: orderData.quantity,
        specs: orderData.specs,
        
        // 地址和配送
        addressId: selectedAddress ? selectedAddress.id : null,
        deliveryMethod: selectedDeliveryMethod,
        
        // 优惠和支付
        couponId: selectedCoupon ? selectedCoupon.id : null,
        paymentMethod: selectedPaymentMethod,
        
        // 备注
        note: orderNote,
        
        // 追踪参数
        source: orderData.source,
        referrer: orderData.referrer,
        listPosition: orderData.listPosition,
        
        // 价格信息
        productTotal: this.data.productTotal,
        deliveryTotal: this.data.deliveryTotal,
        discountTotal: this.data.discountTotal,
        finalTotal: finalTotal
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
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error'
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
