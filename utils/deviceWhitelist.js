/**
 * 设备白名单管理器
 * 处理设备白名单的获取、验证、绑定等功能
 */

const { DeviceAPI } = require('./healingApi')

class DeviceWhitelistManager {
  constructor() {
    this.whitelist = []
    this.lastUpdated = 0
    this.cacheExpiry = 30 * 60 * 1000 // 30分钟缓存
    this.lastFailTime = 0 // 上次失败时间
    this.failCooldown = 2 * 60 * 1000 // 失败后2分钟内不再请求
  }
  
  /**
   * 获取设备白名单（带缓存）
   */
  async getWhitelist(forceRefresh = false) {
    const now = Date.now()
    
    // 检查缓存是否有效
    if (!forceRefresh && 
        this.whitelist.length > 0 && 
        (now - this.lastUpdated) < this.cacheExpiry) {
      console.log('使用缓存的设备白名单')
      return this.whitelist
    }

    // 检查失败冷却期
    if (!forceRefresh && this.lastFailTime > 0 && (now - this.lastFailTime) < this.failCooldown) {
      console.log('设备白名单获取处于冷却期，使用现有白名单')
      return this.whitelist || []
    }
    
    try {
      console.log('从服务器获取设备白名单...')
      const result = await DeviceAPI.getWhitelist()
      
      if (result.success) {
        this.whitelist = result.data
        this.lastUpdated = now
        this.lastFailTime = 0 // 清除失败时间
        
        // 缓存到本地存储
        wx.setStorageSync('device_whitelist', {
          data: this.whitelist,
          timestamp: now
        })
        
        console.log(`设备白名单更新成功，共 ${this.whitelist.length} 个设备`)
        return this.whitelist
      } else {
        // API调用失败，使用空白名单
        console.warn('API返回失败，使用空白名单:', result.error)
        this.whitelist = []
        return this.whitelist
      }
    } catch (error) {
      console.error('获取设备白名单失败:', error)
      
      // 记录失败时间
      this.lastFailTime = now
      
      // 尝试使用本地缓存
      try {
        const cached = wx.getStorageSync('device_whitelist')
        if (cached && cached.data && Array.isArray(cached.data)) {
          this.whitelist = cached.data
          this.lastUpdated = cached.timestamp
          console.warn('使用本地缓存的设备白名单')
          return this.whitelist
        }
      } catch (e) {
        console.error('读取本地缓存失败:', e)
      }
      
      // 如果缓存也失败，返回空数组
      console.warn('无法获取设备白名单，使用空白名单')
      return []
    }
  }
  
  /**
   * 验证设备是否在白名单中
   */
  async verifyDevice(macAddress, deviceName) {
    try {
      console.log(`验证设备: ${deviceName} (${macAddress})`)
      
      // 🔥 核心修复：优先检查是否为当前设备
      const currentDeviceResult = this.verifyCurrentDevice(macAddress, deviceName)
      if (currentDeviceResult.is_current_device) {
        console.log('✅ 识别为当前设备，自动允许播放')
        return currentDeviceResult
      }
      
      // 直接调用服务器验证（因为这是公开API）
      const result = await DeviceAPI.verifyDevice({
        mac_address: macAddress,
        device_name: deviceName
      })
      
      if (result.success) {
        console.log('设备验证结果:', result.data)
        return result.data
      } else {
        // API调用失败，使用本地验证
        console.warn('API验证失败，尝试本地验证:', result.error)
        await this.getWhitelist() // 确保有最新的白名单缓存
        return this.verifyDeviceLocally(macAddress, deviceName)
      }
    } catch (error) {
      console.error('设备验证失败:', error)
      
      // 本地验证作为备选
      console.warn('API验证失败，尝试本地验证')
      await this.getWhitelist()
      const localResult = this.verifyDeviceLocally(macAddress, deviceName)
      
      // 如果本地验证也失败，尝试硬编码验证
      if (!localResult.is_whitelisted) {
        const hardcodedResult = this.verifyDeviceByHardcodedList(macAddress, deviceName)
        if (hardcodedResult.is_whitelisted) {
          console.log('硬编码验证通过（作为最后备选）')
          return hardcodedResult
        }
      }
      
      return localResult
    }
  }
  
  /**
   * 验证是否为当前设备（运行小程序的设备）
   * @param {string} macAddress MAC地址
   * @param {string} deviceName 设备名称
   * @returns {object} 验证结果
   */
  verifyCurrentDevice(macAddress, deviceName) {
    try {
      // 获取当前设备信息
      const systemInfo = wx.getSystemInfoSync()
      const deviceInfo = {
        platform: systemInfo.platform,
        system: systemInfo.system,
        model: systemInfo.model,
        brand: systemInfo.brand,
        version: systemInfo.version
      }
      
      console.log('当前设备信息:', deviceInfo)
      
      // 判断是否为当前设备的几种情况：
      const isCurrentDevice = this._checkIfCurrentDevice(macAddress, deviceName, deviceInfo)
      
      if (isCurrentDevice) {
        return {
          is_current_device: true,
          is_whitelisted: true,
          can_bind: true,
          device_info: {
            device_name: `当前设备 (${deviceInfo.model})`,
            device_type: 'current_device',
            manufacturer: deviceInfo.brand,
            model: deviceInfo.model,
            max_users: 1,
            current_bindings: 0
          },
          reason: 'current_device_auto_allowed'
        }
      }
      
      return { is_current_device: false }
      
    } catch (error) {
      console.error('获取当前设备信息失败:', error)
      return { is_current_device: false }
    }
  }
  
  /**
   * 检查是否为当前设备的逻辑
   * @private
   */
  _checkIfCurrentDevice(macAddress, deviceName, deviceInfo) {
    // 情况1: 空MAC地址或无效MAC地址（可能是小程序内播放）
    if (!macAddress || macAddress === '' || macAddress === '00:00:00:00:00:00') {
      console.log('检测到空MAC地址，可能是小程序内播放')
      return true
    }
    
    // 情况2: 设备名称包含当前系统信息
    if (deviceName && deviceInfo.model) {
      const modelMatch = deviceName.toLowerCase().includes(deviceInfo.model.toLowerCase())
      const brandMatch = deviceInfo.brand && deviceName.toLowerCase().includes(deviceInfo.brand.toLowerCase())
      
      if (modelMatch || brandMatch) {
        console.log('设备名称匹配当前设备型号/品牌')
        return true
      }
    }
    
    // 情况3: 特殊的当前设备标识
    const currentDeviceIdentifiers = [
      'current_device',
      '当前设备',
      'local_device',
      'miniprogram_device',
      'phone_speaker',
      'internal_audio'
    ]
    
    if (deviceName) {
      const nameMatch = currentDeviceIdentifiers.some(identifier => 
        deviceName.toLowerCase().includes(identifier.toLowerCase())
      )
      if (nameMatch) {
        console.log('设备名称包含当前设备标识符')
        return true
      }
    }
    
    // 情况4: 小程序环境下的虚拟设备标识
    if (deviceName === 'WeChat MiniProgram' || deviceName === '微信小程序') {
      console.log('检测到小程序虚拟设备')
      return true
    }
    
    return false
  }

  /**
   * 硬编码的设备验证（备选方案）
   */
  verifyDeviceByHardcodedList(macAddress, deviceName) {
    // 定义硬编码的设备白名单
    const hardcodedWhitelist = [
      { pattern: 'BT-Music', type: 'name' },
      { pattern: 'BT-Audio', type: 'name' },
      { pattern: 'BT-Sound', type: 'name' },
      { pattern: 'BT-Player', type: 'name' },
      { pattern: 'Music-BT', type: 'name' },
      { pattern: 'Audio-BT', type: 'name' },
      { pattern: '1129AA254A58', type: 'mac' }, // BT-Music 测试设备
    ]
    
    // 检查设备名称
    if (deviceName) {
      const nameUpper = deviceName.toUpperCase()
      for (const item of hardcodedWhitelist) {
        if (item.type === 'name' && nameUpper.includes(item.pattern.toUpperCase())) {
          return {
            is_whitelisted: true,
            can_bind: true,
            device_info: {
              device_name: deviceName,
              mac_address: macAddress,
              verification_method: 'hardcoded_name'
            },
            reason: null
          }
        }
      }
    }
    
    // 检查MAC地址
    if (macAddress) {
      const normalizedMac = this.normalizeMacAddress(macAddress)
      for (const item of hardcodedWhitelist) {
        if (item.type === 'mac' && normalizedMac === item.pattern) {
          return {
            is_whitelisted: true,
            can_bind: true,
            device_info: {
              device_name: deviceName,
              mac_address: macAddress,
              verification_method: 'hardcoded_mac'
            },
            reason: null
          }
        }
      }
    }
    
    return {
      is_whitelisted: false,
      can_bind: false,
      device_info: null,
      reason: 'not_in_hardcoded_list'
    }
  }
  
  /**
   * 本地验证设备（离线模式）
   */
  verifyDeviceLocally(macAddress, deviceName) {
    const normalizedMac = this.normalizeMacAddress(macAddress)
    
    if (!normalizedMac) {
      return {
        is_whitelisted: false,
        can_bind: false,
        device_info: null,
        reason: 'invalid_mac_format'
      }
    }
    
    const device = this.whitelist.find(d => {
      const whitelistMac = this.normalizeMacAddress(d.mac_address)
      return whitelistMac === normalizedMac && d.is_active
    })
    
    console.log(`本地验证结果: 设备${device ? '在' : '不在'}白名单中`)
    
    return {
      is_whitelisted: !!device,
      can_bind: !!device && device.current_bindings < device.max_users,
      device_info: device || null,
      reason: device ? 
        (device.current_bindings < device.max_users ? null : 'max_users_reached') : 
        'device_not_whitelisted'
    }
  }
  
  /**
   * 绑定设备
   */
  async bindDevice(macAddress, deviceName) {
    try {
      console.log(`绑定设备: ${deviceName} (${macAddress})`)
      
      const result = await DeviceAPI.bindDevice({
        mac_address: macAddress,
        device_name: deviceName
      })
      
      if (result.success) {
        console.log('设备绑定成功:', result.data)
        
        // 清除缓存，强制刷新白名单
        this.lastUpdated = 0
        return result
      } else {
        throw new Error(result.error || '绑定失败')
      }
    } catch (error) {
      console.error('设备绑定失败:', error)
      throw error
    }
  }
  
  /**
   * 解绑设备
   */
  async unbindDevice(macAddress) {
    try {
      console.log(`解绑设备: ${macAddress}`)
      
      const result = await DeviceAPI.unbindDevice({
        mac_address: macAddress
      })
      
      if (result.success) {
        console.log('设备解绑成功')
        
        // 清除缓存，强制刷新
        this.lastUpdated = 0
        return result
      } else {
        throw new Error(result.error || '解绑失败')
      }
    } catch (error) {
      console.error('设备解绑失败:', error)
      throw error
    }
  }
  
  /**
   * 获取用户绑定的设备列表
   */
  async getMyDevices() {
    try {
      const result = await DeviceAPI.getMyDevices()
      
      if (result.success) {
        console.log(`获取用户设备成功，共 ${result.data.length} 个设备`)
        return result.data
      } else {
        throw new Error(result.error || '获取设备列表失败')
      }
    } catch (error) {
      console.error('获取用户设备失败:', error)
      return []
    }
  }
  
  /**
   * 标准化MAC地址格式
   */
  normalizeMacAddress(macAddress) {
    if (!macAddress) return null
    
    // 移除所有非十六进制字符
    const cleanMac = macAddress.replace(/[^0-9A-Fa-f]/g, '').toUpperCase()
    
    // 验证长度
    if (cleanMac.length !== 12) return null
    
    // 添加冒号分隔
    return cleanMac.match(/.{2}/g).join(':')
  }
  
  /**
   * 验证MAC地址格式
   */
  isValidMacAddress(macAddress) {
    const normalized = this.normalizeMacAddress(macAddress)
    return !!normalized
  }
  
  /**
   * 清除缓存
   */
  clearCache() {
    this.whitelist = []
    this.lastUpdated = 0
    try {
      wx.removeStorageSync('device_whitelist')
    } catch (e) {
      console.error('清除本地缓存失败:', e)
    }
  }
  
  /**
   * 获取缓存状态信息
   */
  getCacheInfo() {
    const now = Date.now()
    const cacheAge = now - this.lastUpdated
    const isExpired = cacheAge > this.cacheExpiry
    
    return {
      hasCache: this.whitelist.length > 0,
      lastUpdated: this.lastUpdated,
      cacheAge: cacheAge,
      isExpired: isExpired,
      deviceCount: this.whitelist.length
    }
  }
  
  /**
   * 搜索白名单设备
   */
  searchDevices(keyword) {
    if (!keyword) return this.whitelist
    
    const lowerKeyword = keyword.toLowerCase()
    return this.whitelist.filter(device => 
      device.device_name.toLowerCase().includes(lowerKeyword) ||
      device.mac_address.toLowerCase().includes(lowerKeyword) ||
      (device.manufacturer && device.manufacturer.toLowerCase().includes(lowerKeyword)) ||
      (device.model && device.model.toLowerCase().includes(lowerKeyword))
    )
  }
  
  /**
   * 按设备类型过滤
   */
  filterByType(deviceType) {
    if (!deviceType) return this.whitelist
    
    return this.whitelist.filter(device => 
      device.device_type === deviceType
    )
  }
  
  /**
   * 获取可用的设备类型列表
   */
  getDeviceTypes() {
    const types = new Set()
    this.whitelist.forEach(device => {
      if (device.device_type) {
        types.add(device.device_type)
      }
    })
    return Array.from(types)
  }
  
  /**
   * 检查设备是否可以绑定
   */
  canBindDevice(device) {
    return device && 
           device.is_active && 
           device.current_bindings < device.max_users
  }
  
  /**
   * 获取设备状态描述
   */
  getDeviceStatusText(device) {
    if (!device) return '未知设备'
    if (!device.is_active) return '设备已禁用'
    if (device.current_bindings >= device.max_users) return '绑定已满'
    return '可绑定'
  }
}

// 单例模式
let deviceWhitelistManager = null

function getDeviceWhitelistManager() {
  if (!deviceWhitelistManager) {
    deviceWhitelistManager = new DeviceWhitelistManager()
  }
  return deviceWhitelistManager
}

// 导出兼容的接口，用于替代原有的硬编码白名单验证
async function isDeviceAllowed(macAddress, deviceName) {
  try {
    const manager = getDeviceWhitelistManager()
    const verification = await manager.verifyDevice(macAddress, deviceName)
    return verification.is_whitelisted && verification.can_bind
  } catch (error) {
    console.error('设备白名单验证失败:', error)
    
    // 兜底策略：使用原有的硬编码白名单
    const FALLBACK_ALLOWED_NAMES = ["BT-music", "medsleep"]
    return FALLBACK_ALLOWED_NAMES.some(name => 
      deviceName.toLowerCase().includes(name.toLowerCase())
    )
  }
}

/**
 * 检查当前设备是否允许播放音乐
 * 这是一个简化的接口，专门用于音乐播放权限检查
 */
async function isCurrentDeviceAllowedToPlay() {
  try {
    const manager = getDeviceWhitelistManager()
    
    // 使用空MAC地址和特殊设备名来标识当前设备
    const verification = await manager.verifyDevice('', 'current_device')
    
    console.log('当前设备播放权限检查结果:', verification)
    return verification.is_whitelisted
    
  } catch (error) {
    console.error('当前设备播放权限检查失败:', error)
    // 出错时默认允许播放（当前设备应该始终可以播放）
    return true
  }
}

module.exports = {
  getDeviceWhitelistManager,
  isDeviceAllowed,
  isCurrentDeviceAllowedToPlay,
  DeviceWhitelistManager
}
