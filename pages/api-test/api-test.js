// API测试页面 - 验证后端接口连通性
const productApi = require('../../utils/productApi')

Page({
  data: {
    testResults: [],
    testing: false
  },

  onLoad() {
    console.log('API测试页面加载')
  },

  // 测试商品列表API
  async testProductList() {
    this.addTestResult('开始测试商品列表API...')
    
    try {
      const response = await productApi.getProductList()
      console.log('商品列表API响应:', response)
      
      if (response.success) {
        this.addTestResult(`✅ 商品列表API测试成功 - 获取到 ${response.data.products.length} 个商品`)
        this.addTestResult(`分页信息: 第${response.data.pagination.page}页，共${response.data.pagination.total}个商品`)
      } else {
        this.addTestResult(`❌ 商品列表API测试失败: ${response.error}`)
      }
    } catch (error) {
      console.error('商品列表API测试失败:', error)
      this.addTestResult(`❌ 商品列表API测试异常: ${error.message || error}`)
    }
  },

  // 测试商品详情API
  async testProductDetail() {
    this.addTestResult('开始测试商品详情API...')
    
    try {
      const response = await productApi.getProductDetail('PHYSICAL_001')
      console.log('商品详情API响应:', response)
      
      if (response.success) {
        this.addTestResult(`✅ 商品详情API测试成功 - 商品: ${response.data.name}`)
        this.addTestResult(`商品价格: ¥${(response.data.price / 100).toFixed(2)}`)
        this.addTestResult(`库存状态: ${response.data.stock_status}`)
      } else {
        this.addTestResult(`❌ 商品详情API测试失败: ${response.error}`)
      }
    } catch (error) {
      console.error('商品详情API测试失败:', error)
      this.addTestResult(`❌ 商品详情API测试异常: ${error.message || error}`)
    }
  },

  // 运行所有测试
  async runAllTests() {
    if (this.data.testing) return
    
    this.setData({ 
      testing: true,
      testResults: []
    })
    
    this.addTestResult('🚀 开始API连通性测试...')
    this.addTestResult(`API基础地址: ${getApp().globalData.apiBaseUrl}`)
    this.addTestResult('---')
    
    try {
      await this.testProductList()
      this.addTestResult('---')
      await this.testProductDetail()
      this.addTestResult('---')
      this.addTestResult('🎉 所有API测试完成!')
    } catch (error) {
      console.error('测试过程出错:', error)
      this.addTestResult(`💥 测试过程出错: ${error.message || error}`)
    } finally {
      this.setData({ testing: false })
    }
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

  // 复制结果到剪贴板
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
