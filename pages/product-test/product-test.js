// 商品API测试页面
const productApi = require('../../utils/productApi')

Page({
  data: {
    testResults: [],
    testing: false,
    productData: null
  },

  onLoad() {
    console.log('商品API测试页面加载')
    this.testProductListAPI()
  },

  async testProductListAPI() {
    this.addTestResult('开始测试商品列表API...')
    
    try {
      this.setData({ testing: true })
      
      // 测试商品列表API
      const response = await productApi.getProductList({})
      console.log('商品列表API完整响应:', response)
      
      if (response.success) {
        const products = response.data.products || []
        this.addTestResult(`✅ 商品列表API调用成功`)
        this.addTestResult(`📦 获取到 ${products.length} 个商品`)
        
        if (products.length > 0) {
          const firstProduct = products[0]
          this.addTestResult(`🔍 第一个商品信息:`)
          this.addTestResult(`   - ID: ${firstProduct.id}`)
          this.addTestResult(`   - 名称: ${firstProduct.name}`)
          this.addTestResult(`   - 价格: ¥${(firstProduct.price / 100)}`)
          this.addTestResult(`   - 分类: ${firstProduct.product_category}`)
          this.addTestResult(`   - 库存: ${firstProduct.stock_quantity}`)
          this.addTestResult(`   - 状态: ${firstProduct.stock_status}`)
          
          this.setData({ productData: products })
        }
        
        // 测试分页信息
        if (response.data.pagination) {
          const pagination = response.data.pagination
          this.addTestResult(`📄 分页信息:`)
          this.addTestResult(`   - 当前页: ${pagination.page}`)
          this.addTestResult(`   - 总页数: ${pagination.pages}`)
          this.addTestResult(`   - 总商品数: ${pagination.total}`)
          this.addTestResult(`   - 每页数量: ${pagination.per_page}`)
        }
        
        // 测试分类信息
        if (response.data.categories) {
          this.addTestResult(`🏷️ 商品分类: ${response.data.categories.join(', ')}`)
        }
        
      } else {
        this.addTestResult(`❌ 商品列表API调用失败: ${response.error}`)
      }
      
    } catch (error) {
      console.error('商品列表API测试失败:', error)
      this.addTestResult(`💥 API调用异常: ${error.message || error}`)
    } finally {
      this.setData({ testing: false })
    }
  },

  // 测试商品详情API
  async testProductDetail() {
    if (!this.data.productData || this.data.productData.length === 0) {
      this.addTestResult('❌ 没有商品数据，无法测试商品详情')
      return
    }

    const firstProduct = this.data.productData[0]
    this.addTestResult(`开始测试商品详情API (ID: ${firstProduct.id})...`)
    
    try {
      const response = await productApi.getProductDetail(firstProduct.id)
      console.log('商品详情API响应:', response)
      
      if (response.success) {
        this.addTestResult(`✅ 商品详情API调用成功`)
        this.addTestResult(`📝 商品详情:`)
        this.addTestResult(`   - 名称: ${response.data.name}`)
        this.addTestResult(`   - 描述: ${response.data.description}`)
        this.addTestResult(`   - 价格: ¥${(response.data.price / 100)}`)
        this.addTestResult(`   - 重量: ${response.data.weight}g`)
        this.addTestResult(`   - 尺寸: ${response.data.dimensions}`)
        
        if (response.data.shipping_fee) {
          this.addTestResult(`   - 运费: ¥${(response.data.shipping_fee / 100)}`)
        }
      } else {
        this.addTestResult(`❌ 商品详情API调用失败: ${response.error}`)
      }
    } catch (error) {
      console.error('商品详情API测试失败:', error)
      this.addTestResult(`💥 商品详情API异常: ${error.message || error}`)
    }
  },

  // 跳转到商品列表页面
  goToProductList() {
    wx.navigateTo({
      url: '/pages/product/list/list'
    })
  },

  // 跳转到API测试页面
  goToAPITest() {
    wx.navigateTo({
      url: '/pages/api-test/api-test'
    })
  },

  // 清空测试结果
  clearResults() {
    this.setData({ testResults: [] })
  },

  // 添加测试结果
  addTestResult(message) {
    const timestamp = new Date().toLocaleTimeString()
    const result = `[${timestamp}] ${message}`
    
    this.setData({
      testResults: [...this.data.testResults, result]
    })
    
    console.log('测试结果:', result)
  },

  // 复制结果
  copyResults() {
    const results = this.data.testResults.join('\n')
    wx.setClipboardData({
      data: results,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      }
    })
  }
})
