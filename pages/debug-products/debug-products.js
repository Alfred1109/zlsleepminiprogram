// 商品数据调试页面
const productApi = require('../../utils/productApi')

Page({
  data: {
    testResults: [],
    apiData: null,
    mockData: null
  },

  onLoad() {
    console.log('商品调试页面加载')
    this.runDebugTests()
  },

  async runDebugTests() {
    this.addResult('🚀 开始商品数据调试测试...')
    
    // 测试1: 直接API调用
    this.addResult('--- 测试1: 直接API调用 ---')
    try {
      this.addResult('📡 正在调用 productApi.getProductList({})...')
      const apiResponse = await productApi.getProductList({})
      
      this.addResult(`✅ API调用成功`)
      this.addResult(`📊 完整响应结构: ${JSON.stringify(apiResponse, null, 2).substring(0, 200)}...`)
      this.addResult(`🔑 响应字段: ${Object.keys(apiResponse || {}).join(', ')}`)
      this.addResult(`📦 数据字段: ${Object.keys(apiResponse.data || {}).join(', ')}`)
      this.addResult(`🔢 商品数量: ${apiResponse.data?.products?.length || 0}`)
      
      if (apiResponse.data?.products?.length > 0) {
        const firstProduct = apiResponse.data.products[0]
        this.addResult(`🛍️ 第一个商品: ${firstProduct.name}`)
        this.addResult(`🆔 商品ID: ${firstProduct.id}`)
        this.addResult(`💰 价格: ${firstProduct.price} (原始) -> ¥${(firstProduct.price / 100).toFixed(2)}`)
        this.addResult(`📂 分类: ${firstProduct.product_category}`)
      }
      
      this.setData({ apiData: apiResponse.data })
    } catch (error) {
      this.addResult(`❌ API调用失败: ${error.message}`)
      this.addResult(`🔍 错误详情: ${JSON.stringify({
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        stack: error.stack?.substring(0, 200)
      }, null, 2)}`)
      console.error('API调用失败:', error)
    }

    // 测试2: 数据处理流程
    this.addResult('--- 测试2: 数据处理流程 ---')
    try {
      if (this.data.apiData?.products?.length > 0) {
        const rawProducts = this.data.apiData.products
        const processedProducts = rawProducts.map(product => ({
          ...product,
          displayPrice: (product.price / 100).toFixed(2),
          displayOriginalPrice: product.original_price ? (product.original_price / 100).toFixed(2) : null
        }))
        
        this.addResult(`✅ 数据处理成功`)
        this.addResult(`🔄 处理后商品数量: ${processedProducts.length}`)
        
        if (processedProducts.length > 0) {
          const processed = processedProducts[0]
          this.addResult(`🎯 处理后价格格式: ${processed.displayPrice}`)
        }
      } else {
        this.addResult(`⚠️ 没有API数据可供处理`)
      }
      
    } catch (error) {
      this.addResult(`❌ 数据处理失败: ${error.message}`)
      console.error('数据处理失败:', error)
    }

    this.addResult('🎉 调试测试完成!')
  },


  // 跳转到商品列表页面
  goToProductList() {
    wx.navigateTo({
      url: '/pages/product/list/list'
    })
  },

  // 添加测试结果
  addResult(message) {
    const timestamp = new Date().toLocaleTimeString()
    const result = `[${timestamp}] ${message}`
    
    this.setData({
      testResults: [...this.data.testResults, result]
    })
    
    console.log('调试结果:', result)
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
