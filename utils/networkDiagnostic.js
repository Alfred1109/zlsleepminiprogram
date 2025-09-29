/**
 * 网络诊断工具
 * 用于测试API连接和诊断网络问题
 */

const { getApiBaseUrl } = require('./config')

class NetworkDiagnostic {
  constructor() {
    this.baseUrl = getApiBaseUrl()
  }

  /**
   * 测试基础连接
   */
  async testBasicConnection() {
    console.log('开始测试基础连接...')
    
    try {
      const startTime = Date.now()
      
      const result = await new Promise((resolve, reject) => {
        wx.request({
          url: `${this.baseUrl}/health`,
          method: 'GET',
          timeout: 10000,
          success: (res) => {
            const endTime = Date.now()
            resolve({
              success: true,
              statusCode: res.statusCode,
              responseTime: endTime - startTime,
              data: res.data
            })
          },
          fail: (err) => {
            const endTime = Date.now()
            resolve({
              success: false,
              error: err,
              responseTime: endTime - startTime
            })
          }
        })
      })
      
      console.log('基础连接测试结果:', result)
      return result
      
    } catch (error) {
      console.error('基础连接测试失败:', error)
      return {
        success: false,
        error: error
      }
    }
  }

  /**
   * 测试评测量表API
   */
  async testAssessmentScales() {
    console.log('开始测试评测量表API...')
    
    try {
      const startTime = Date.now()
      
      const result = await new Promise((resolve, reject) => {
        wx.request({
          url: `${this.baseUrl}/assessment/scales`,
          method: 'GET',
          timeout: 10000,
          success: (res) => {
            const endTime = Date.now()
            resolve({
              success: true,
              statusCode: res.statusCode,
              responseTime: endTime - startTime,
              dataLength: res.data ? JSON.stringify(res.data).length : 0
            })
          },
          fail: (err) => {
            const endTime = Date.now()
            resolve({
              success: false,
              error: err,
              responseTime: endTime - startTime
            })
          }
        })
      })
      
      console.log('评测量表API测试结果:', result)
      return result
      
    } catch (error) {
      console.error('评测量表API测试失败:', error)
      return {
        success: false,
        error: error
      }
    }
  }

  /**
   * 测试长序列状态API
   */
  async testLongSequenceStatus(sessionId = 1) {
    console.log('开始测试长序列状态API...')
    
    try {
      const startTime = Date.now()
      
      // 长序列状态API需要认证，检查用户登录状态
      const AuthService = require('../services/AuthService')
      const isLoggedIn = AuthService.isLoggedIn()
      
      if (!isLoggedIn) {
        console.log('网络诊断：用户未登录，跳过长序列API测试')
        return {
          success: true,
          statusCode: 200,
          responseTime: 0,
          skipped: true,
          reason: '需要用户登录，跳过测试'
        }
      }
      
      // 用户已登录，获取认证头
      let headers = { 'Content-Type': 'application/json' }
      try {
        const authHeaders = await AuthService.addAuthHeader(headers)
        headers = authHeaders
      } catch (error) {
        console.log('网络诊断：获取认证头失败，跳过长序列API测试')
        return {
          success: true,
          statusCode: 200,
          responseTime: 0,
          skipped: true,
          reason: '认证头获取失败，跳过测试'
        }
      }
      
      const result = await new Promise((resolve, reject) => {
        wx.request({
          url: `${this.baseUrl}/api/music/status/${sessionId}`,
          method: 'GET',
          header: headers,
          timeout: 10000,
          success: (res) => {
            const endTime = Date.now()
            resolve({
              success: res.statusCode === 200,
              statusCode: res.statusCode,
              responseTime: endTime - startTime,
              data: res.data
            })
          },
          fail: (err) => {
            const endTime = Date.now()
            resolve({
              success: false,
              error: err,
              responseTime: endTime - startTime
            })
          }
        })
      })
      
      console.log('长序列状态API测试结果:', result)
      return result
      
    } catch (error) {
      console.error('长序列状态API测试失败:', error)
      return {
        success: false,
        error: error
      }
    }
  }

  /**
   * 运行完整诊断
   */
  async runFullDiagnostic() {
    console.log('开始运行完整网络诊断...')
    
    const results = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      tests: {}
    }
    
    // 测试基础连接
    results.tests.basicConnection = await this.testBasicConnection()
    
    // 测试评测量表API
    results.tests.assessmentScales = await this.testAssessmentScales()
    
    // 测试长序列状态API
    results.tests.longSequenceStatus = await this.testLongSequenceStatus()
    
    // 生成诊断报告
    const report = this.generateReport(results)
    console.log('网络诊断报告:', report)
    
    return {
      results,
      report
    }
  }

  /**
   * 生成诊断报告
   */
  generateReport(results) {
    const report = {
      overall: 'unknown',
      issues: [],
      recommendations: []
    }
    
    let successCount = 0
    let totalTests = 0
    
    Object.keys(results.tests).forEach(testName => {
      const test = results.tests[testName]
      totalTests++
      
      if (test.success) {
        successCount++
        
        // 检查响应时间
        if (test.responseTime > 5000) {
          report.issues.push(`${testName}: 响应时间过长 (${test.responseTime}ms)`)
          report.recommendations.push('检查网络连接质量或服务器性能')
        }
      } else {
        report.issues.push(`${testName}: 请求失败 - ${test.error?.errMsg || '未知错误'}`)
        
        if (test.error?.errMsg?.includes('timeout')) {
          report.recommendations.push('增加请求超时时间或检查服务器响应速度')
        } else if (test.error?.errMsg?.includes('fail')) {
          report.recommendations.push('检查网络连接或服务器状态')
        }
      }
    })
    
    // 确定整体状态
    if (successCount === totalTests) {
      report.overall = 'good'
    } else if (successCount > 0) {
      report.overall = 'partial'
    } else {
      report.overall = 'poor'
    }
    
    return report
  }
}

// 创建全局实例
const networkDiagnostic = new NetworkDiagnostic()

module.exports = networkDiagnostic
