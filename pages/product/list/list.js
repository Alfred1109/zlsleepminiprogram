const productApi = require('../../../utils/productApi')

Page({
  data: {
    productList: [],
    categories: [],
    selectedCategory: '',
    loading: false,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    searchKeyword: '',
    
    // 二维码追踪参数
    sourceCode: '',
    referrer: '',
    
    // 筛选和排序
    sortType: 'default', // default, price_asc, price_desc, sales
    priceRange: [0, 10000],
    showFilter: false
  },

  onLoad(options) {
    console.log('商品列表页面加载参数:', options)
    
    // 解析二维码追踪参数
    if (options.source) {
      this.setData({ sourceCode: options.source })
    }
    if (options.referrer) {
      this.setData({ referrer: options.referrer })
    }
    
    // 处理分类筛选参数
    if (options.category) {
      this.setData({ selectedCategory: options.category })
      
      // 如果是设备类商品，更新页面标题
      if (options.category === 'device') {
        wx.setNavigationBarTitle({
          title: '疗愈设备'
        })
      }
    }
    
    // 初始化页面数据
    this.initPageData()
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadProductList(true)
  },

  onReachBottom() {
    // 触底加载更多
    if (!this.data.loadingMore && this.data.hasMore) {
      this.loadMoreProducts()
    }
  },

  onPullDownRefresh() {
    // 下拉刷新
    this.loadProductList(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 初始化页面数据
  async initPageData() {
    try {
      // 并行加载分类和商品列表
      let categoriesRes
      try {
        categoriesRes = await productApi.getProductCategories()
      } catch (apiError) {
        console.warn('商品分类API暂不可用，使用默认分类:', apiError)
        // 使用默认分类作为后备方案
        categoriesRes = {
          success: true,
          data: [
            { id: 'device', name: '疗愈设备' },
            { id: 'accessory', name: '配件耗材' },
            { id: 'gift', name: '礼品套装' }
          ]
        }
      }
      
      await this.loadProductList(true)
      
      if (categoriesRes.success) {
        this.setData({
          categories: [{ id: '', name: '全部' }, ...categoriesRes.data]
        })
      }
    } catch (error) {
      console.error('初始化页面数据失败:', error)
      // 设置最基本的分类
      this.setData({
        categories: [
          { id: '', name: '全部' },
          { id: 'device', name: '疗愈设备' }
        ]
      })
    }
  },

  // 加载商品列表
  async loadProductList(refresh = false) {
    const { selectedCategory, searchKeyword, sortType, priceRange } = this.data
    
    if (refresh) {
      this.setData({ 
        loading: true, 
        page: 1,
        hasMore: true 
      })
    } else {
      this.setData({ loadingMore: true })
    }

    try {
      const params = {
        page: refresh ? 1 : this.data.page,
        pageSize: this.data.pageSize,
        category: selectedCategory,
        keyword: searchKeyword,
        sort: sortType,
        minPrice: priceRange[0],
        maxPrice: priceRange[1],
        // 添加追踪参数
        source: this.data.sourceCode,
        referrer: this.data.referrer
      }

      let response
      try {
        response = await productApi.getProductList(params)
      } catch (apiError) {
        console.warn('商品列表API暂不可用，使用模拟数据:', apiError)
        // 使用模拟数据作为后备方案
        response = {
          success: true,
          data: {
            list: this.getMockProductList(selectedCategory)
          }
        }
      }
      
      if (response.success) {
        const newProducts = response.data.list || []
        const productList = refresh ? newProducts : [...this.data.productList, ...newProducts]
        
        this.setData({
          productList,
          page: refresh ? 2 : this.data.page + 1,
          hasMore: newProducts.length >= this.data.pageSize,
          loading: false,
          loadingMore: false
        })
      } else {
        throw new Error(response.error || '加载商品列表失败')
      }
    } catch (error) {
      console.error('加载商品列表失败:', error)
      this.setData({
        loading: false,
        loadingMore: false
      })
      wx.showToast({
        title: error.message || '加载失败，请重试',
        icon: 'error'
      })
    }
  },

  // 加载更多商品
  loadMoreProducts() {
    this.loadProductList(false)
  },

  // 搜索商品
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  onSearchConfirm() {
    this.loadProductList(true)
  },

  onSearchClear() {
    this.setData({ searchKeyword: '' })
    this.loadProductList(true)
  },

  // 分类筛选
  onCategoryChange(e) {
    const categoryId = e.currentTarget.dataset.id
    this.setData({ selectedCategory: categoryId })
    this.loadProductList(true)
  },

  // 排序筛选
  onSortChange(e) {
    const sortType = e.currentTarget.dataset.type
    this.setData({ sortType })
    this.loadProductList(true)
  },

  // 显示/隐藏筛选面板
  toggleFilter() {
    this.setData({ showFilter: !this.data.showFilter })
  },

  // 价格区间筛选
  onPriceRangeChange(e) {
    this.setData({ priceRange: e.detail.value })
  },

  // 应用筛选
  applyFilter() {
    this.setData({ showFilter: false })
    this.loadProductList(true)
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      selectedCategory: '',
      sortType: 'default',
      priceRange: [0, 10000],
      searchKeyword: ''
    })
    this.loadProductList(true)
  },

  // 跳转到商品详情
  goToProductDetail(e) {
    const productId = e.currentTarget.dataset.id
    const trackingParams = {
      source: this.data.sourceCode,
      referrer: this.data.referrer,
      list_position: e.currentTarget.dataset.index
    }
    
    const queryString = Object.keys(trackingParams)
      .filter(key => trackingParams[key])
      .map(key => `${key}=${encodeURIComponent(trackingParams[key])}`)
      .join('&')
    
    const url = `/pages/product/detail/detail?id=${productId}${queryString ? '&' + queryString : ''}`
    
    wx.navigateTo({ url })
  },

  // 添加到购物车（快速操作）
  async addToCart(e) {
    const productId = e.currentTarget.dataset.id
    const product = this.data.productList.find(p => p.id === productId)
    
    if (!product) return
    
    // 这里可以实现快速添加到购物车的逻辑
    // 或者直接跳转到商品详情页
    this.goToProductDetail(e)
  },

  // 获取模拟商品数据（后备方案）
  getMockProductList(category) {
    const mockProducts = [
      {
        id: 'mock_device_001',
        name: 'AI疗愈脑波设备 Pro',
        description: '专业级脑波反馈设备，提供个性化疗愈体验',
        price: 2999,
        originalPrice: 3999,
        images: ['/images/default-image.png'],
        tags: ['热销', '专业级'],
        salesCount: 1280,
        stock: 50
      },
      {
        id: 'mock_device_002', 
        name: 'AI疗愈脑波设备 Lite',
        description: '入门级脑波设备，轻松开启疗愈之旅',
        price: 1299,
        originalPrice: 1599,
        images: ['/images/default-image.png'],
        tags: ['入门级', '性价比'],
        salesCount: 890,
        stock: 120
      }
    ]

    // 根据分类筛选
    if (category === 'device') {
      return mockProducts
    } else if (category === '') {
      return mockProducts
    } else {
      return []
    }
  },

  // 分享商品列表
  onShareAppMessage() {
    const { sourceCode, referrer } = this.data
    const params = []
    
    if (sourceCode) params.push(`source=${sourceCode}`)
    if (referrer) params.push(`referrer=${referrer}`)
    
    return {
      title: 'AI疗愈 - 精选实物商品',
      path: `/pages/product/list/list${params.length ? '?' + params.join('&') : ''}`,
      imageUrl: '/images/logo.png'
    }
  }
})
