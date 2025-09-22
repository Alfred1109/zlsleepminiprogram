// pages/scene-mapping-test/scene-mapping-test.js
// 场景映射测试页面
const { SceneMappingAPI } = require('../../utils/healingApi')
const { sceneMappingService } = require('../../utils/sceneMappingService')

Page({
  data: {
    testResults: [],
    loading: false,
    mappings: null,
    debugInfo: null,
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null
  },

  onLoad() {
    console.log('🧪 场景映射测试页面加载')
    this.initTheme()
    this.runTests()
  },

  /**
   * 初始化主题
   */
  initTheme() {
    try {
      const app = getApp();
      if (app.globalData && app.globalData.currentTheme) {
        this.setData({
          currentTheme: app.globalData.currentTheme,
          themeClass: app.globalData.themeConfig?.class || '',
          themeConfig: app.globalData.themeConfig
        });
      }
    } catch (error) {
      console.error('初始化主题失败:', error);
    }
  },

  /**
   * 主题切换事件处理
   */
  onThemeChange(e) {
    try {
      if (!e || !e.detail) return;
      const { theme, config } = e.detail;
      if (!theme || !config) return;

      this.setData({
        currentTheme: theme,
        themeClass: config.class || '',
        themeConfig: config
      });
    } catch (error) {
      console.error('主题切换处理失败:', error);
    }
  },

  /**
   * 运行所有测试
   */
  async runTests() {
    this.setData({ loading: true, testResults: [] })
    
    try {
      await this.testDirectAPICall()
      await this.testMappingService()
      await this.testScenarioMapping()
      await this.testCacheSystem()
      
      wx.showToast({
        title: '测试完成',
        icon: 'success'
      })
    } catch (error) {
      console.error('测试失败:', error)
      wx.showToast({
        title: '测试失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 测试1: 直接调用API接口
   */
  async testDirectAPICall() {
    this.addTestResult('🔗 测试1: 直接调用后端API')
    
    try {
      // 测试获取映射关系接口
      const mappingsResult = await SceneMappingAPI.getMappings()
      this.addTestResult(`- /scene/mappings 调用: ${mappingsResult.success ? '✅ 成功' : '❌ 失败'}`)
      
      if (mappingsResult.success) {
        this.addTestResult(`- 返回数据结构: ${JSON.stringify(Object.keys(mappingsResult.data || {}), null, 2)}`)
        this.setData({ mappings: mappingsResult.data })
      } else {
        this.addTestResult(`- 错误信息: ${mappingsResult.error || mappingsResult.message || '未知错误'}`)
      }

      // 测试获取场景量表类型接口
      try {
        const scaleTypesResult = await SceneMappingAPI.getScaleTypesByScene(1)
        this.addTestResult(`- /scene/1/scale-types 调用: ${scaleTypesResult.success ? '✅ 成功' : '❌ 失败'}`)
        
        if (scaleTypesResult.success) {
          this.addTestResult(`- 场景1对应量表: ${JSON.stringify(scaleTypesResult.data)}`)
        }
      } catch (error) {
        this.addTestResult(`- /scene/1/scale-types 调用: ❌ 失败 (${error.message})`)
      }

      // 测试获取场景音乐类型接口
      try {
        const musicTypesResult = await SceneMappingAPI.getMusicTypesByScene(1)
        this.addTestResult(`- /scene/1/music-types 调用: ${musicTypesResult.success ? '✅ 成功' : '❌ 失败'}`)
        
        if (musicTypesResult.success) {
          this.addTestResult(`- 场景1对应音乐: ${JSON.stringify(musicTypesResult.data)}`)
        }
      } catch (error) {
        this.addTestResult(`- /scene/1/music-types 调用: ❌ 失败 (${error.message})`)
      }

    } catch (error) {
      this.addTestResult(`- API调用异常: ❌ ${error.message}`)
    }
  },

  /**
   * 测试2: 映射服务功能
   */
  async testMappingService() {
    this.addTestResult('\n📋 测试2: 场景映射服务')
    
    try {
      // 获取映射关系
      const mappings = await sceneMappingService.getMappings()
      this.addTestResult(`- 服务获取映射: ✅ 成功`)
      this.addTestResult(`- 映射数据结构: ${JSON.stringify(Object.keys(mappings), null, 2)}`)

      // 测试获取场景对应的量表类型
      const scaleTypes1 = await sceneMappingService.getScaleTypesByScene(1, '抑郁疗愈')
      this.addTestResult(`- 场景1(抑郁疗愈)量表: ${JSON.stringify(scaleTypes1)}`)

      const scaleTypes2 = await sceneMappingService.getScaleTypesByScene(2, '焦虑缓解')
      this.addTestResult(`- 场景2(焦虑缓解)量表: ${JSON.stringify(scaleTypes2)}`)

      // 测试获取场景对应的音乐类型
      const musicTypes1 = await sceneMappingService.getMusicTypesByScene(1, '抑郁疗愈')
      this.addTestResult(`- 场景1(抑郁疗愈)音乐: ${JSON.stringify(musicTypes1)}`)

      const musicTypes2 = await sceneMappingService.getMusicTypesByScene(2, '焦虑缓解')
      this.addTestResult(`- 场景2(焦虑缓解)音乐: ${JSON.stringify(musicTypes2)}`)

    } catch (error) {
      this.addTestResult(`- 映射服务异常: ❌ ${error.message}`)
    }
  },

  /**
   * 测试3: 具体场景匹配
   */
  async testScenarioMapping() {
    this.addTestResult('\n🎯 测试3: 具体场景匹配')
    
    try {
      // 测试评测量表匹配
      const testScale = {
        id: 1,
        name: 'Hamilton抑郁量表',
        scale_type: 'HAMD-17'
      }
      
      const scaleMatch = await sceneMappingService.isScaleMatchingScene(testScale, 1, '抑郁疗愈')
      this.addTestResult(`- HAMD-17量表匹配抑郁场景: ${scaleMatch ? '✅ 匹配' : '❌ 不匹配'}`)

      // 测试音乐匹配
      const testMusic = {
        id: 1,
        name: '抑郁疗愈脑波',
        assessment_scale_name: 'HAMD',
        tags: ['depression', 'healing']
      }
      
      const musicMatch = await sceneMappingService.isMusicMatchingScene(testMusic, 1, '抑郁疗愈')
      this.addTestResult(`- HAMD脑波匹配抑郁场景: ${musicMatch ? '✅ 匹配' : '❌ 不匹配'}`)

      // 测试不匹配的情况
      const testMismatchScale = {
        id: 2,
        name: 'GAD-7焦虑量表',
        scale_type: 'GAD-7'
      }
      
      const scaleMismatch = await sceneMappingService.isScaleMatchingScene(testMismatchScale, 1, '抑郁疗愈')
      this.addTestResult(`- GAD-7量表匹配抑郁场景: ${scaleMismatch ? '⚠️ 意外匹配' : '✅ 正确不匹配'}`)

    } catch (error) {
      this.addTestResult(`- 场景匹配异常: ❌ ${error.message}`)
    }
  },

  /**
   * 测试4: 缓存系统
   */
  async testCacheSystem() {
    this.addTestResult('\n💾 测试4: 缓存系统')
    
    try {
      // 获取调试信息
      const debugInfo = sceneMappingService.getDebugInfo()
      this.addTestResult(`- 缓存状态: ${JSON.stringify(debugInfo, null, 2)}`)
      this.setData({ debugInfo })

      // 清除缓存
      sceneMappingService.clearCache()
      this.addTestResult(`- 缓存清除: ✅ 完成`)

      // 重新获取映射（重建缓存）
      await sceneMappingService.getMappings()
      this.addTestResult(`- 缓存重建: ✅ 完成`)

      // 再次获取调试信息
      const newDebugInfo = sceneMappingService.getDebugInfo()
      this.addTestResult(`- 新缓存状态: ${JSON.stringify(newDebugInfo, null, 2)}`)

    } catch (error) {
      this.addTestResult(`- 缓存系统异常: ❌ ${error.message}`)
    }
  },

  /**
   * 添加测试结果
   */
  addTestResult(message) {
    console.log(message)
    this.setData({
      testResults: [...this.data.testResults, message]
    })
  },

  /**
   * 手动重新测试
   */
  onRetestTap() {
    this.setData({ testResults: [] })
    this.runTests()
  },

  /**
   * 清除缓存
   */
  onClearCacheTap() {
    sceneMappingService.clearCache()
    wx.showToast({
      title: '缓存已清除',
      icon: 'success'
    })
  },

  /**
   * 复制调试信息
   */
  onCopyDebugTap() {
    if (this.data.debugInfo) {
      wx.setClipboardData({
        data: JSON.stringify(this.data.debugInfo, null, 2),
        success: () => {
          wx.showToast({
            title: '调试信息已复制',
            icon: 'success'
          })
        }
      })
    }
  }
})
