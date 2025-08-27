/**
 * 环境感知管理器
 * 提供噪音检测、环境适配、场景识别等功能
 */

const config = require('./config');

class EnvironmentManager {
  constructor() {
    this.isMonitoring = false;
    this.currentEnvironment = {
      noiseLevel: 0,        // 噪音水平 (0-100)
      environmentType: 'unknown', // 环境类型
      lightLevel: 0,        // 光线水平
      timeOfDay: 'unknown', // 时间段
      location: null,       // 位置信息
      weather: null         // 天气信息
    };
    
    // 环境检测配置
    this.detectionInterval = 5000; // 检测间隔5秒
    this.detectionTimer = null;
    
    // 回调函数
    this.onEnvironmentChange = null;
    this.onNoiseDetected = null;
    this.onSceneRecognized = null;
    
    // 环境阈值配置
    this.noiseThresholds = {
      quiet: 30,    // 安静环境 < 30dB
      normal: 60,   // 正常环境 30-60dB
      noisy: 80     // 嘈杂环境 > 60dB
    };
    
    // 场景识别规则
    this.sceneRules = {
      bedroom: {
        timeRange: [22, 7],     // 晚上10点到早上7点
        noiseLevel: [0, 40],    // 噪音水平
        lightLevel: [0, 30]     // 光线水平
      },
      office: {
        timeRange: [9, 18],     // 工作时间
        noiseLevel: [30, 70],
        lightLevel: [40, 80]
      },
      outdoor: {
        noiseLevel: [50, 100],
        lightLevel: [60, 100]
      },
      transport: {
        noiseLevel: [60, 90],
        movement: true          // 检测到移动
      }
    };
    
    // 初始化环境检测
    this._initEnvironmentDetection();
  }
  
  /**
   * 初始化环境检测
   * @private
   */
  _initEnvironmentDetection() {
    console.log('初始化环境感知管理器');
    
    // 获取初始时间信息
    this._updateTimeOfDay();
    
    // 获取位置信息（微信暂未开放，临时注释）
    // this._getLocationInfo();
    
    // 获取系统信息
    this._getSystemInfo();
  }
  
  /**
   * 开始环境监测
   * @returns {Promise} 操作结果
   */
  startMonitoring() {
    return new Promise((resolve, reject) => {
      if (this.isMonitoring) {
        resolve();
        return;
      }
      
      console.log('开始环境监测');
      this.isMonitoring = true;
      
      // 立即执行一次检测
      this._performEnvironmentDetection();
      
      // 设置定时检测
      this.detectionTimer = setInterval(() => {
        this._performEnvironmentDetection();
      }, this.detectionInterval);
      
      resolve();
    });
  }
  
  /**
   * 停止环境监测
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }
    
    console.log('停止环境监测');
    this.isMonitoring = false;
    
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = null;
    }
  }
  
  /**
   * 执行环境检测
   * @private
   */
  _performEnvironmentDetection() {
    // 更新时间信息
    this._updateTimeOfDay();
    
    // 检测噪音水平（模拟实现）
    this._detectNoiseLevel();
    
    // 检测光线水平（模拟实现）
    this._detectLightLevel();
    
    // 场景识别
    this._recognizeScene();
    
    // 触发环境变化回调
    if (this.onEnvironmentChange) {
      this.onEnvironmentChange(this.currentEnvironment);
    }
  }
  
  /**
   * 更新时间段信息
   * @private
   */
  _updateTimeOfDay() {
    const now = new Date();
    const hour = now.getHours();
    
    let timeOfDay;
    if (hour >= 6 && hour < 12) {
      timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 18) {
      timeOfDay = 'afternoon';
    } else if (hour >= 18 && hour < 22) {
      timeOfDay = 'evening';
    } else {
      timeOfDay = 'night';
    }
    
    this.currentEnvironment.timeOfDay = timeOfDay;
  }
  
  /**
   * 检测噪音水平（模拟实现）
   * @private
   */
  _detectNoiseLevel() {
    // 由于小程序无法直接获取环境噪音，这里使用模拟数据
    // 实际应用中可以通过硬件设备或用户反馈来获取
    
    const timeOfDay = this.currentEnvironment.timeOfDay;
    let baseNoiseLevel;
    
    // 根据时间段估算基础噪音水平
    switch (timeOfDay) {
      case 'night':
        baseNoiseLevel = 25; // 夜间较安静
        break;
      case 'morning':
        baseNoiseLevel = 45; // 早晨中等
        break;
      case 'afternoon':
        baseNoiseLevel = 55; // 下午较嘈杂
        break;
      case 'evening':
        baseNoiseLevel = 50; // 傍晚中等
        break;
      default:
        baseNoiseLevel = 40;
    }
    
    // 添加随机波动
    const variation = (Math.random() - 0.5) * 20;
    const noiseLevel = Math.max(0, Math.min(100, baseNoiseLevel + variation));
    
    this.currentEnvironment.noiseLevel = Math.round(noiseLevel);
    
    // 确定环境类型
    if (noiseLevel < this.noiseThresholds.quiet) {
      this.currentEnvironment.environmentType = 'quiet';
    } else if (noiseLevel < this.noiseThresholds.normal) {
      this.currentEnvironment.environmentType = 'normal';
    } else {
      this.currentEnvironment.environmentType = 'noisy';
    }
    
    // 触发噪音检测回调
    if (this.onNoiseDetected) {
      this.onNoiseDetected({
        level: noiseLevel,
        type: this.currentEnvironment.environmentType
      });
    }
  }
  
  /**
   * 检测光线水平（模拟实现）
   * @private
   */
  _detectLightLevel() {
    const timeOfDay = this.currentEnvironment.timeOfDay;
    let baseLightLevel;
    
    // 根据时间段估算光线水平
    switch (timeOfDay) {
      case 'night':
        baseLightLevel = 10; // 夜间很暗
        break;
      case 'morning':
        baseLightLevel = 70; // 早晨明亮
        break;
      case 'afternoon':
        baseLightLevel = 90; // 下午最亮
        break;
      case 'evening':
        baseLightLevel = 40; // 傍晚较暗
        break;
      default:
        baseLightLevel = 50;
    }
    
    // 添加随机波动
    const variation = (Math.random() - 0.5) * 30;
    const lightLevel = Math.max(0, Math.min(100, baseLightLevel + variation));
    
    this.currentEnvironment.lightLevel = Math.round(lightLevel);
  }
  
  /**
   * 场景识别
   * @private
   */
  _recognizeScene() {
    const env = this.currentEnvironment;
    const hour = new Date().getHours();
    
    let recognizedScene = 'unknown';
    let confidence = 0;
    
    // 检查各种场景规则
    for (const [sceneName, rules] of Object.entries(this.sceneRules)) {
      let sceneConfidence = 0;
      let ruleCount = 0;
      
      // 检查时间范围
      if (rules.timeRange) {
        const [startHour, endHour] = rules.timeRange;
        const inTimeRange = (startHour <= endHour) 
          ? (hour >= startHour && hour < endHour)
          : (hour >= startHour || hour < endHour);
        
        if (inTimeRange) {
          sceneConfidence += 30;
        }
        ruleCount++;
      }
      
      // 检查噪音水平
      if (rules.noiseLevel) {
        const [minNoise, maxNoise] = rules.noiseLevel;
        if (env.noiseLevel >= minNoise && env.noiseLevel <= maxNoise) {
          sceneConfidence += 40;
        }
        ruleCount++;
      }
      
      // 检查光线水平
      if (rules.lightLevel) {
        const [minLight, maxLight] = rules.lightLevel;
        if (env.lightLevel >= minLight && env.lightLevel <= maxLight) {
          sceneConfidence += 30;
        }
        ruleCount++;
      }
      
      // 计算平均置信度
      if (ruleCount > 0) {
        sceneConfidence = sceneConfidence / ruleCount;
        
        if (sceneConfidence > confidence) {
          confidence = sceneConfidence;
          recognizedScene = sceneName;
        }
      }
    }
    
    // 只有置信度足够高才认为识别成功
    if (confidence > 50) {
      this.currentEnvironment.scene = recognizedScene;
      this.currentEnvironment.sceneConfidence = confidence;
      
      console.log(`场景识别: ${recognizedScene} (置信度: ${confidence.toFixed(1)}%)`);
      
      if (this.onSceneRecognized) {
        this.onSceneRecognized({
          scene: recognizedScene,
          confidence: confidence
        });
      }
    } else {
      this.currentEnvironment.scene = 'unknown';
      this.currentEnvironment.sceneConfidence = 0;
    }
  }
  
  /**
   * 获取位置信息
   * @private
   * 注意：微信暂未开放getLocation接口，此方法已临时禁用
   */
  _getLocationInfo() {
    // 微信暂未开放getLocation接口，临时注释
    console.log('位置信息功能暂时不可用（微信未开放接口）');
    /*
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          wx.getLocation({
            type: 'gcj02',
            success: (res) => {
              this.currentEnvironment.location = {
                latitude: res.latitude,
                longitude: res.longitude,
                accuracy: res.accuracy
              };
              console.log('获取位置信息成功:', this.currentEnvironment.location);
            },
            fail: (err) => {
              console.log('获取位置信息失败:', err);
            }
          });
        }
      }
    });
    */
  }
  
  /**
   * 获取系统信息
   * @private
   */
  _getSystemInfo() {
    try {
      // 使用新的API替代弃用的wx.getSystemInfoSync
      wx.getAppBaseInfo({
        success: (appBaseInfo) => {
          wx.getDeviceInfo({
            success: (deviceInfo) => {
              wx.getWindowInfo({
                success: (windowInfo) => {
                  this.currentEnvironment.systemInfo = {
                    platform: deviceInfo.platform,
                    system: deviceInfo.system,
                    version: appBaseInfo.version,
                    screenBrightness: windowInfo.screenBrightness || 0,
                    pixelRatio: windowInfo.pixelRatio || 2
                  };
                  console.log('获取系统信息成功');
                },
                fail: (error) => {
                  console.error('获取窗口信息失败:', error);
                  this._fallbackGetSystemInfo();
                }
              });
            },
            fail: (error) => {
              console.error('获取设备信息失败:', error);
              this._fallbackGetSystemInfo();
            }
          });
        },
        fail: (error) => {
          console.error('获取应用基础信息失败:', error);
          this._fallbackGetSystemInfo();
        }
      });
    } catch (error) {
      console.error('获取系统信息失败:', error);
      this._fallbackGetSystemInfo();
    }
  }
  
  /**
   * 降级获取系统信息
   */
  _fallbackGetSystemInfo() {
    this.currentEnvironment.systemInfo = {
      platform: 'unknown',
      system: 'unknown',
      version: 'unknown',
      screenBrightness: 0,
      pixelRatio: 2
    };
    console.warn('使用降级方式设置系统信息');
  }
  
  /**
   * 获取当前环境信息
   * @returns {Object} 环境信息
   */
  getCurrentEnvironment() {
    return { ...this.currentEnvironment };
  }
  
  /**
   * 获取环境建议
   * @returns {Object} 环境建议
   */
  getEnvironmentSuggestions() {
    const env = this.currentEnvironment;
    const suggestions = {
      volume: 70,           // 建议音量
      audioProfile: 'normal', // 音频配置
      therapyMode: 'standard' // 疗愈模式
    };
    
    // 根据噪音水平调整建议
    if (env.environmentType === 'quiet') {
      suggestions.volume = 50;
      suggestions.audioProfile = 'quiet';
      suggestions.therapyMode = 'gentle';
    } else if (env.environmentType === 'noisy') {
      suggestions.volume = 85;
      suggestions.audioProfile = 'enhanced';
      suggestions.therapyMode = 'intensive';
    }
    
    // 根据时间段调整建议
    if (env.timeOfDay === 'night') {
      suggestions.volume = Math.min(suggestions.volume, 60);
      suggestions.therapyMode = 'sleep';
    }
    
    // 根据场景调整建议
    if (env.scene === 'bedroom') {
      suggestions.volume = Math.min(suggestions.volume, 55);
      suggestions.audioProfile = 'sleep';
      suggestions.therapyMode = 'sleep';
    } else if (env.scene === 'office') {
      suggestions.audioProfile = 'focus';
      suggestions.therapyMode = 'concentration';
    }
    
    return suggestions;
  }
  
  /**
   * 销毁管理器
   */
  destroy() {
    this.stopMonitoring();
    console.log('环境感知管理器已销毁');
  }
}

// 创建单例实例
const environmentManager = new EnvironmentManager();

module.exports = environmentManager;
