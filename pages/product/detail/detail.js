const productApi = require('../../../utils/productApi')

Page({
  data: {
    productId: '',
    productDetail: null,
    loading: true,
    
    // 商品展示
    currentImageIndex: 0,
    showImagePreview: false,
    
    // 规格选择
    selectedSpecs: {},
    selectedSku: null,
    showSpecModal: false,
    
    // 数量选择
    quantity: 1,
    
    // 购买相关
    isAddingToCart: false,
    isBuying: false,
    
    // 追踪参数
    sourceCode: '',
    referrer: '',
    listPosition: '',
    
    // 其他
    showDescription: false,
    favorited: false
  },

  onLoad(options) {
    console.log('商品详情页面加载参数:', options)
    
    const { id, source, referrer, list_position } = options
    
    if (!id) {
      wx.showToast({
        title: '商品不存在',
        icon: 'error',
        duration: 2000,
        complete: () => {
          wx.navigateBack()
        }
      })
      return
    }
    
    this.setData({
      productId: id,
      sourceCode: source || '',
      referrer: referrer || '',
      listPosition: list_position || ''
    })
    
    this.loadProductDetail()
  },

  onShow() {
    // 检查收藏状态
    this.checkFavoriteStatus()
  },

  // 加载商品详情
  async loadProductDetail() {
    this.setData({ loading: true })
    
    try {
      const response = await productApi.getProductDetail(this.data.productId)
      
      if (response.success) {
        const productDetail = response.data
        
        // 初始化规格选择
        const selectedSpecs = {}
        if (productDetail.specs && productDetail.specs.length > 0) {
          productDetail.specs.forEach(spec => {
            if (spec.options && spec.options.length > 0) {
              selectedSpecs[spec.name] = spec.options[0].value
            }
          })
        }
        
        // 查找对应的SKU
        const selectedSku = this.findMatchingSku(productDetail.skus, selectedSpecs)
        
        this.setData({
          productDetail,
          selectedSpecs,
          selectedSku,
          loading: false
        })
        
        // 上报查看商品详情事件
        this.reportViewProduct()
      } else {
        throw new Error(response.error || '加载商品详情失败')
      }
    } catch (error) {
      console.error('加载商品详情失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'error'
      })
    }
  },

  // 查找匹配的SKU
  findMatchingSku(skus, selectedSpecs) {
    if (!skus || skus.length === 0) return null
    
    return skus.find(sku => {
      return Object.keys(selectedSpecs).every(specName => {
        return sku.specs && sku.specs[specName] === selectedSpecs[specName]
      })
    })
  },

  // 图片相关
  onImageTap(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ currentImageIndex: index })
  },

  previewImages() {
    const { productDetail, currentImageIndex } = this.data
    if (!productDetail || !productDetail.images) return
    
    wx.previewImage({
      urls: productDetail.images,
      current: productDetail.images[currentImageIndex]
    })
  },

  // 规格选择
  showSpecSelector() {
    this.setData({ showSpecModal: true })
  },

  hideSpecSelector() {
    this.setData({ showSpecModal: false })
  },

  onSpecSelect(e) {
    const { spec, option } = e.currentTarget.dataset
    const selectedSpecs = { ...this.data.selectedSpecs }
    selectedSpecs[spec] = option
    
    // 查找匹配的SKU
    const selectedSku = this.findMatchingSku(this.data.productDetail.skus, selectedSpecs)
    
    this.setData({
      selectedSpecs,
      selectedSku
    })
  },

  // 数量选择
  decreaseQuantity() {
    const quantity = Math.max(1, this.data.quantity - 1)
    this.setData({ quantity })
  },

  increaseQuantity() {
    const { selectedSku, productDetail } = this.data
    const maxStock = selectedSku ? selectedSku.stock : productDetail.stock
    const quantity = Math.min(maxStock, this.data.quantity + 1)
    this.setData({ quantity })
  },

  onQuantityInput(e) {
    const value = parseInt(e.detail.value) || 1
    const { selectedSku, productDetail } = this.data
    const maxStock = selectedSku ? selectedSku.stock : productDetail.stock
    const quantity = Math.max(1, Math.min(maxStock, value))
    this.setData({ quantity })
  },

  // 添加到购物车
  async addToCart() {
    if (this.data.isAddingToCart) return
    
    const { productDetail, selectedSku, selectedSpecs, quantity } = this.data
    
    // 检查库存
    const stock = selectedSku ? selectedSku.stock : productDetail.stock
    if (stock < quantity) {
      wx.showToast({
        title: '库存不足',
        icon: 'error'
      })
      return
    }
    
    this.setData({ isAddingToCart: true })
    
    try {
      // 这里应该调用添加到购物车的API
      // 暂时使用模拟逻辑
      
      await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟网络请求
      
      wx.showToast({
        title: '已添加到购物车',
        icon: 'success'
      })
      
      this.hideSpecSelector()
      
      // 上报添加到购物车事件
      this.reportAddToCart()
      
    } catch (error) {
      console.error('添加到购物车失败:', error)
      wx.showToast({
        title: error.message || '添加失败',
        icon: 'error'
      })
    } finally {
      this.setData({ isAddingToCart: false })
    }
  },

  // 立即购买
  async buyNow() {
    if (this.data.isBuying) return
    
    const { productDetail, selectedSku, selectedSpecs, quantity } = this.data
    
    // 检查库存
    const stock = selectedSku ? selectedSku.stock : productDetail.stock
    if (stock < quantity) {
      wx.showToast({
        title: '库存不足',
        icon: 'error'
      })
      return
    }
    
    this.setData({ isBuying: true })
    
    try {
      // 构建订单数据
      const orderData = {
        productId: this.data.productId,
        skuId: selectedSku ? selectedSku.id : null,
        specs: selectedSpecs,
        quantity: quantity,
        // 追踪参数
        source: this.data.sourceCode,
        referrer: this.data.referrer,
        listPosition: this.data.listPosition
      }
      
      // 跳转到订单创建页面
      wx.navigateTo({
        url: `/pages/order/create/create?data=${encodeURIComponent(JSON.stringify(orderData))}`
      })
      
      this.hideSpecSelector()
      
      // 上报立即购买事件
      this.reportBuyNow()
      
    } catch (error) {
      console.error('立即购买失败:', error)
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'error'
      })
    } finally {
      this.setData({ isBuying: false })
    }
  },

  // 收藏相关
  async checkFavoriteStatus() {
    // 这里应该检查商品是否已收藏
    // 暂时使用本地存储模拟
    try {
      const favorites = wx.getStorageSync('product_favorites') || []
      const favorited = favorites.includes(this.data.productId)
      this.setData({ favorited })
    } catch (error) {
      console.error('检查收藏状态失败:', error)
    }
  },

  async toggleFavorite() {
    try {
      const favorites = wx.getStorageSync('product_favorites') || []
      const { productId, favorited } = this.data
      
      if (favorited) {
        // 取消收藏
        const index = favorites.indexOf(productId)
        if (index > -1) {
          favorites.splice(index, 1)
        }
        wx.showToast({ title: '已取消收藏', icon: 'success' })
      } else {
        // 添加收藏
        favorites.push(productId)
        wx.showToast({ title: '已添加收藏', icon: 'success' })
      }
      
      wx.setStorageSync('product_favorites', favorites)
      this.setData({ favorited: !favorited })
      
    } catch (error) {
      console.error('收藏操作失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
    }
  },

  // 显示/隐藏商品详情
  toggleDescription() {
    this.setData({ showDescription: !this.data.showDescription })
  },

  // 联系客服
  contactService() {
    wx.makePhoneCall({
      phoneNumber: '400-000-0000'
    }).catch(() => {
      wx.showToast({
        title: '拨号失败',
        icon: 'error'
      })
    })
  },

  // 数据上报
  reportViewProduct() {
    // 上报查看商品详情事件
    console.log('上报查看商品详情:', {
      productId: this.data.productId,
      source: this.data.sourceCode,
      referrer: this.data.referrer,
      listPosition: this.data.listPosition
    })
  },

  reportAddToCart() {
    // 上报添加到购物车事件
    console.log('上报添加到购物车:', {
      productId: this.data.productId,
      quantity: this.data.quantity,
      specs: this.data.selectedSpecs
    })
  },

  reportBuyNow() {
    // 上报立即购买事件
    console.log('上报立即购买:', {
      productId: this.data.productId,
      quantity: this.data.quantity,
      specs: this.data.selectedSpecs
    })
  },

  // 分享
  onShareAppMessage() {
    const { productDetail, sourceCode, referrer } = this.data
    const params = []
    
    if (sourceCode) params.push(`source=${sourceCode}`)
    if (referrer) params.push(`referrer=${referrer}`)
    
    return {
      title: productDetail ? productDetail.name : '精选商品',
      path: `/pages/product/detail/detail?id=${this.data.productId}${params.length ? '&' + params.join('&') : ''}`,
      imageUrl: productDetail && productDetail.images && productDetail.images.length > 0 
        ? productDetail.images[0] 
        : '/images/logo.png'
    }
  }
})
