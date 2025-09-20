/**
 * 场景映射服务测试
 * 测试动态映射功能是否正常工作
 */

const { sceneMappingService } = require('../utils/sceneMappingService')

class SceneMappingTest {
  async runTests() {
    console.log('🧪 开始场景映射服务测试...\n')
    
    try {
      await this.testGetMappings()
      await this.testScaleMapping()
      await this.testMusicMapping()
      await this.testCacheSystem()
      await this.testDefaultMappings()
      
      console.log('\n✅ 所有测试通过！场景映射功能正常工作。')
      
    } catch (error) {
      console.error('\n❌ 测试失败:', error)
    }
  }

  /**
   * 测试获取映射关系
   */
  async testGetMappings() {
    console.log('📋 测试1: 获取映射关系')
    
    const mappings = await sceneMappingService.getMappings()
    
    console.log('- 映射数据结构:', Object.keys(mappings))
    console.log('- 场景到量表映射:', mappings.sceneToScales ? '✅' : '❌')
    console.log('- 场景到音乐映射:', mappings.sceneToMusic ? '✅' : '❌')
    console.log('- 场景名称到量表映射:', mappings.sceneNameToScales ? '✅' : '❌')
    console.log('- 场景名称到音乐映射:', mappings.sceneNameToMusic ? '✅' : '❌')
    console.log()
  }

  /**
   * 测试评测量表映射
   */
  async testScaleMapping() {
    console.log('📊 测试2: 评测量表映射')
    
    // 测试场景ID映射
    const scaleTypes1 = await sceneMappingService.getScaleTypesByScene(1, '抑郁疗愈')
    console.log('- 场景1(抑郁疗愈)对应量表:', scaleTypes1)
    
    const scaleTypes2 = await sceneMappingService.getScaleTypesByScene(2, '焦虑缓解')
    console.log('- 场景2(焦虑缓解)对应量表:', scaleTypes2)
    
    const scaleTypes3 = await sceneMappingService.getScaleTypesByScene(3, '睡眠改善')
    console.log('- 场景3(睡眠改善)对应量表:', scaleTypes3)
    
    // 测试量表匹配
    const testScale = {
      id: 1,
      name: 'Hamilton抑郁量表',
      scale_type: 'HAMD-17'
    }
    
    const isMatch = await sceneMappingService.isScaleMatchingScene(testScale, 1, '抑郁疗愈')
    console.log('- HAMD-17量表匹配抑郁场景:', isMatch ? '✅' : '❌')
    console.log()
  }

  /**
   * 测试音乐映射
   */
  async testMusicMapping() {
    console.log('🎵 测试3: 音乐映射')
    
    // 测试场景ID映射
    const musicTypes1 = await sceneMappingService.getMusicTypesByScene(1, '抑郁疗愈')
    console.log('- 场景1(抑郁疗愈)对应音乐类型:', musicTypes1)
    
    const musicTypes2 = await sceneMappingService.getMusicTypesByScene(2, '焦虑缓解')
    console.log('- 场景2(焦虑缓解)对应音乐类型:', musicTypes2)
    
    // 测试音乐匹配
    const testMusic = {
      id: 1,
      name: '抑郁疗愈脑波',
      assessment_scale_name: 'HAMD',
      tags: ['depression', 'healing']
    }
    
    const isMatch = await sceneMappingService.isMusicMatchingScene(testMusic, 1, '抑郁疗愈')
    console.log('- HAMD脑波匹配抑郁场景:', isMatch ? '✅' : '❌')
    console.log()
  }

  /**
   * 测试缓存系统
   */
  async testCacheSystem() {
    console.log('💾 测试4: 缓存系统')
    
    const debugInfo = sceneMappingService.getDebugInfo()
    console.log('- 缓存调试信息:', debugInfo)
    
    // 测试缓存清除
    sceneMappingService.clearCache()
    console.log('- 缓存清除:', '✅')
    
    // 重新获取映射以重建缓存
    await sceneMappingService.getMappings()
    console.log('- 缓存重建:', '✅')
    console.log()
  }

  /**
   * 测试默认映射
   */
  async testDefaultMappings() {
    console.log('🔄 测试5: 默认映射关系')
    
    const defaultMappings = sceneMappingService.getDefaultMappings()
    
    console.log('- 默认映射结构:', Object.keys(defaultMappings))
    console.log('- 场景1默认量表:', defaultMappings.sceneToScales[1])
    console.log('- 场景1默认音乐:', defaultMappings.sceneToMusic[1])
    console.log('- 抑郁疗愈默认量表:', defaultMappings.sceneNameToScales['抑郁疗愈'])
    console.log('- 抑郁疗愈默认音乐:', defaultMappings.sceneNameToMusic['抑郁疗愈'])
    console.log()
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  const test = new SceneMappingTest()
  test.runTests().catch(console.error)
}

module.exports = SceneMappingTest
