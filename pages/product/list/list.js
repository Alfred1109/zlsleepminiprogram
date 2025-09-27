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
    
    // 筛选功能
    priceRange: [0, 10000],
    showFilter: false,
    
    // 搜索功能增强
    searchHistory: [],
    showSearchSuggestions: false,
    searchSuggestions: [],
    hotSearchKeywords: ['疗愈香薰', '睡眠眼罩', '冥想', '助眠', '放松']
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
    
    // 加载搜索历史
    this.loadSearchHistory()
    
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

  // 搜索建议功能
  async getSearchSuggestions(keyword) {
    if (!keyword || keyword.length < 2) {
      this.setData({ searchSuggestions: [], showSearchSuggestions: false })
      return
    }
    
    try {
      // 可以调用API获取搜索建议，这里先用本地模拟
      const suggestions = this.data.hotSearchKeywords
        .filter(item => item.includes(keyword))
        .slice(0, 5)
      
      this.setData({ 
        searchSuggestions: suggestions,
        showSearchSuggestions: suggestions.length > 0
      })
    } catch (error) {
      console.error('获取搜索建议失败:', error)
    }
  },

  // 添加搜索历史
  addSearchHistory(keyword) {
    if (!keyword || keyword.trim() === '') return
    
    let { searchHistory } = this.data
    
    // 移除重复项
    searchHistory = searchHistory.filter(item => item !== keyword)
    
    // 添加到开头
    searchHistory.unshift(keyword)
    
    // 限制历史记录数量
    if (searchHistory.length > 10) {
      searchHistory = searchHistory.slice(0, 10)
    }
    
    this.setData({ searchHistory })
    
    // 存储到本地
    try {
      wx.setStorageSync('product_search_history', searchHistory)
    } catch (error) {
      console.error('保存搜索历史失败:', error)
    }
  },

  // 加载搜索历史
  loadSearchHistory() {
    try {
      const searchHistory = wx.getStorageSync('product_search_history') || []
      this.setData({ searchHistory })
    } catch (error) {
      console.error('加载搜索历史失败:', error)
    }
  },

  // 清除搜索历史
  clearSearchHistory() {
    this.setData({ searchHistory: [] })
    try {
      wx.removeStorageSync('product_search_history')
      wx.showToast({ title: '已清除搜索历史', icon: 'success' })
    } catch (error) {
      console.error('清除搜索历史失败:', error)
    }
  },

  // 加载商品列表
  async loadProductList(refresh = false) {
    const { selectedCategory, searchKeyword, priceRange } = this.data
    
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
      console.log('🔍 加载商品列表:', { selectedCategory, searchKeyword, priceRange })
      
      // 构建请求参数
      const rawParams = {
        page: refresh ? 1 : this.data.page,
        pageSize: this.data.pageSize,
        keyword: searchKeyword && searchKeyword.trim() ? searchKeyword.trim() : '',
        category: selectedCategory,
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

      console.log('📤 发起商品列表API请求:', {
        原始参数: rawParams,
        过滤后参数: params,
        是否包含搜索: !!params.keyword
      })
      
      const response = await productApi.getProductList(params)
      console.log('📥 商品列表API响应:', response.success ? '成功' : '失败')
      
      if (response.success && response.data.products) {
        const products = response.data.products
        console.log('🔍 API结果验证:')
        console.log('- 返回商品数量:', products.length)
        
        if (searchKeyword && searchKeyword.trim()) {
          // 搜索结果验证
          const keyword = searchKeyword.trim()
          console.log('- 搜索关键词:', keyword)
          console.log('- 传递给API的keyword参数:', params.keyword)
          
          if (products.length > 0) {
            console.log('- 前3个商品名称:', products.slice(0, 3).map(p => p.name))
            
            // 验证搜索结果是否与关键词匹配
            const matchedProducts = products.filter(product => 
              product.name.includes(keyword) || 
              (product.description && product.description.includes(keyword)) ||
              (product.tags && product.tags.some(tag => tag.includes(keyword)))
            )
            console.log('- 名称/描述/标签包含关键词的商品数量:', matchedProducts.length)
            
            if (matchedProducts.length === 0 && products.length > 0) {
              console.error('❌ 后端搜索功能未正确实现！')
              console.log('- 搜索关键词:', keyword)
              console.log('- 返回的商品:', products.map(p => p.name))
              console.log('- 问题：搜索结果与关键词完全不匹配')
              console.log('🔧 需要后端开发：实现 /api/physical-products/list 的 keyword 搜索功能')
            } else if (matchedProducts.length < products.length) {
              console.warn('⚠️ 后端搜索功能部分失效！')
              console.log('- 搜索关键词:', keyword)
              console.log('- 不匹配的商品:', products.filter(p => !matchedProducts.includes(p)).map(p => p.name))
              console.log('🔧 需要后端开发：完善 keyword 搜索的匹配逻辑')
            } else {
              console.log('✅ 后端搜索功能正常')
            }
          } else {
            console.log('- 搜索无结果')
          }
        } else {
          // 普通列表
          console.log('- 列表类型: 普通商品列表')
          console.log('- 分类筛选:', selectedCategory || '无')
          if (products.length > 0) {
            console.log('- 前3个商品名称:', products.slice(0, 3).map(p => p.name))
          }
        }
      }
      
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

  // 搜索商品 - 增强版
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    
    // 实时搜索建议
    if (keyword.length >= 2) {
      this.getSearchSuggestions(keyword)
    } else {
      this.setData({ showSearchSuggestions: false })
    }
  },

  onSearchConfirm() {
    const { searchKeyword } = this.data
    console.log('🔍 搜索确认:', searchKeyword)
    
    if (searchKeyword.trim()) {
      // 添加到搜索历史
      this.addSearchHistory(searchKeyword.trim())
      // 隐藏搜索建议
      this.setData({ showSearchSuggestions: false })
      // 清除分类筛选，避免与搜索冲突
      this.setData({ selectedCategory: '' })
      console.log('✅ 搜索关键词已保存到历史:', searchKeyword.trim())
      console.log('🔄 已清除分类筛选，避免与搜索冲突')
    }
    
    // 强制刷新商品列表
    console.log('🔄 执行搜索，重新加载商品列表...')
    this.loadProductList(true)
  },

  onSearchClear() {
    this.setData({ 
      searchKeyword: '',
      showSearchSuggestions: false
    })
    this.loadProductList(true)
  },

  // 点击搜索建议
  onSearchSuggestionTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    console.log('🔍 点击搜索建议:', keyword)
    this.setData({ 
      searchKeyword: keyword,
      showSearchSuggestions: false,
      selectedCategory: ''  // 清除分类筛选
    })
    this.addSearchHistory(keyword)
    console.log('🔄 开始搜索，清除分类筛选')
    this.loadProductList(true)
  },

  // 点击搜索历史
  onSearchHistoryTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    console.log('🔍 点击搜索历史:', keyword)
    this.setData({ 
      searchKeyword: keyword,
      selectedCategory: ''  // 清除分类筛选
    })
    console.log('🔄 开始搜索，清除分类筛选')
    this.loadProductList(true)
  },

  // 点击热门搜索
  onHotSearchTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    console.log('🔍 点击热门搜索:', keyword)
    this.setData({ 
      searchKeyword: keyword,
      selectedCategory: ''  // 清除分类筛选
    })
    this.addSearchHistory(keyword)
    console.log('🔄 开始搜索，清除分类筛选')
    this.loadProductList(true)
  },

  // 分类筛选
  onCategoryChange(e) {
    const categoryId = e.currentTarget.dataset.id
    console.log('🏷️ 分类筛选:', categoryId)
    this.setData({ 
      selectedCategory: categoryId,
      searchKeyword: ''  // 清除搜索关键词，避免与分类筛选冲突
    })
    console.log('🔄 已清除搜索关键词，避免与分类筛选冲突')
    console.log('🔄 执行分类筛选，重新加载商品列表...')
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
