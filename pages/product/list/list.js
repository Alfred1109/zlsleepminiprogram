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
    console.log('商品列表页面显示，当前商品数量:', this.data.productList.length)
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
      // 加载商品分类
      const categoriesRes = await productApi.getProductCategories()
      
      await this.loadProductList(true)
      
      if (categoriesRes.success && categoriesRes.data.categories) {
        // 处理分类数据
        const categories = categoriesRes.data.categories.map(name => ({ id: name, name: name }))
        this.setData({
          categories: [{ id: '', name: '全部' }, ...categories]
        })
      }
    } catch (error) {
      console.error('初始化页面数据失败:', error)
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
      // 构建请求参数，过滤掉空值
      const rawParams = {
        page: refresh ? 1 : this.data.page,
        pageSize: this.data.pageSize,
        category: selectedCategory,
        keyword: searchKeyword,
        sort: sortType,
        minPrice: priceRange[0],
        maxPrice: priceRange[1],
        source: this.data.sourceCode,
        referrer: this.data.referrer
      }

      // 过滤掉空字符串和null/undefined值
      const params = {}
      Object.keys(rawParams).forEach(key => {
        const value = rawParams[key]
        if (value !== '' && value !== null && value !== undefined) {
          params[key] = value
        }
      })

      console.log('发起商品列表API请求，原始参数:', rawParams)
      console.log('发起商品列表API请求，过滤后参数:', params)
      const response = await productApi.getProductList(params)
      console.log('商品列表API响应:', response)
      
      if (response.success) {
        // 处理API返回的真实商品数据
        const products = response.data.products || []
        
        // 格式化商品数据，处理价格显示
        const formattedProducts = products.map(product => ({
          ...product,
          displayPrice: (product.price / 100).toFixed(2),
          displayOriginalPrice: product.original_price ? (product.original_price / 100).toFixed(2) : null
        }))
        
        const productList = refresh ? formattedProducts : [...this.data.productList, ...formattedProducts]
        
        this.setData({
          productList,
          page: refresh ? 2 : this.data.page + 1,
          hasMore: response.data.pagination ? response.data.pagination.has_next : false,
          loading: false,
          loadingMore: false
        })
      } else {
        throw new Error(response.error || '加载商品列表失败')
      }
    } catch (error) {
      console.error('加载商品列表失败:', error)
      console.log('错误详情:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        fullError: error
      })
      
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
    console.log('重置筛选，重新加载商品数据')
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
    console.log('跳转到商品详情，商品ID:', productId)
    console.log('当前商品数据:', e.currentTarget.dataset)
    
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
    console.log('构建的跳转URL:', url)
    
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
