// pages/scene/list/list.js
const { get } = require('../../../utils/api')

Page({
  data: {
    scenes: [],
    loading: false,
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null,
  },

  onLoad: function(options) {
    console.log('🎯 场景列表页面加载')
    console.log('🎯 初始化数据状态:', this.data)
    
    // 先设置一个测试场景，确保页面可以显示
    this.setData({
      scenes: [{
        id: 999,
        name: '测试场景',
        icon: '🧪',
        description: '测试页面是否正常显示',
        sceneName: '测试场景'
      }],
      loading: false
    })
    
    console.log('🧪 设置测试场景后的数据:', this.data.scenes)
    
    // 延迟1秒后从API获取真实数据
    setTimeout(() => {
      this.initScenes()
    }, 1000)
  },

  onShow: function() {
    console.log('🎯 场景列表页面显示')
    // 每次显示时刷新数据，确保显示最新的场景
    this.initScenes()
  },

  /**
   * 初始化场景数据 - 从后端API获取
   */
  async initScenes() {
    console.log('🔄 开始初始化场景数据...')
    
    try {
      this.setData({ loading: true })
      console.log('📡 正在从后端获取场景数据...')
      
      // 从后端获取场景数据
      const result = await get('/api/scene/list')
      console.log('📡 后端返回结果:', result)
      
      if (result && result.success && result.data) {
        const backendScenes = result.data
        console.log('📡 后端场景数据:', backendScenes)
        
        // 处理场景数据
        const scenes = backendScenes
          .filter(scene => scene.is_active) // 只显示激活的场景
          .map(scene => {
            // 根据场景code设置显示名称
            let sceneName = scene.name
            switch(scene.code) {
              case 'sleep': sceneName = '助眠疗愈'; break
              case 'focus': sceneName = '专注疗愈'; break  
              case 'emotion': sceneName = '情绪疗愈'; break
              case 'meditation': sceneName = '冥想疗愈'; break
              case 'relax': sceneName = '放松疗愈'; break
              default: sceneName = scene.name
            }
            
            return {
              id: scene.id,
              name: scene.name,
              icon: scene.icon || '🎯',
              description: scene.description || '疗愈场景',
              code: scene.code,
              sceneName: sceneName,
              scaleType: scene.scale_type,
              sortOrder: scene.sort_order || 0,
              // 显示映射统计信息
              scaleMappingsCount: scene.scale_mappings_count || 0,
              musicMappingsCount: scene.music_mappings_count || 0
            }
          })
          .sort((a, b) => a.sortOrder - b.sortOrder) // 按后端的排序顺序排列
        
        console.log('✅ [场景列表] 从后端获取场景数据成功:', scenes)
        
        this.setData({
          scenes: scenes,
          loading: false
        })
      } else {
        console.warn('⚠️ 后端场景数据格式异常:', result)
        throw new Error('后端场景数据格式异常')
      }
    } catch (error) {
      console.error('❌ [场景列表] 从后端获取场景数据失败:', error)
      
      // 只有在API完全失败时才显示降级数据
      const fallbackScenes = [
        { 
          id: 1, 
          name: '睡眠场景', 
          icon: '😴',
          description: '改善睡眠质量，获得深度休息',
          scaleType: 'PSQI',
          sceneName: '睡眠疗愈'
        },
        { 
          id: 2, 
          name: '专注场景', 
          icon: '🎯',
          description: '提升注意力，增强工作效率',
          scaleType: null,
          sceneName: '专注疗愈'
        },
        { 
          id: 3, 
          name: '抑郁场景', 
          icon: '🌈',
          description: '缓解抑郁情绪，重拾生活希望',
          scaleType: 'HAMD-17',
          sceneName: '抑郁疗愈'
        },
        { 
          id: 4, 
          name: '焦虑场景', 
          icon: '🕊️',
          description: '缓解焦虑紧张，获得内心平静',
          scaleType: 'GAD-7',
          sceneName: '焦虑疗愈'
        }
      ]
      
      console.log('🔄 使用降级数据:', fallbackScenes)
      
      this.setData({
        scenes: fallbackScenes,
        loading: false
      })
      
      wx.showToast({
        title: '加载失败，显示默认场景',
        icon: 'none',
        duration: 2000
      })
    }
  },

  /**
   * 场景点击事件
   */
  onSceneTap: function(e) {
    const { id, name, scaleType, sceneName } = e.currentTarget.dataset
    
    console.log('点击场景:', { id, name, scaleType, sceneName })
    
    // 跳转到场景详情页面
    wx.navigateTo({
      url: `/pages/scene/detail/detail?sceneId=${id}&sceneName=${encodeURIComponent(name)}&scaleType=${scaleType || ''}&sceneTheme=${encodeURIComponent(sceneName)}`
    })
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

      const app = getApp();
      if (app.globalData) {
        app.globalData.currentTheme = theme;
        app.globalData.themeConfig = config;
      }

      if (wx.$emitter) {
        wx.$emitter.emit('themeChanged', { theme, config });
      }

      wx.showToast({
        title: `已应用${config.name}`,
        icon: 'none',
        duration: 1500
      });
    } catch (error) {
      console.error('主题切换处理失败:', error);
    }
  },
})
