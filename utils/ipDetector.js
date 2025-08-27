/**
 * IP地址自动检测器
 * 用于真机调试时自动获取开发机IP
 */

class IPDetector {
  constructor() {
    this.detectedIP = null
    // 常见的网络段配置（CIDR格式）
    this.commonNetworks = [
      // 家庭路由器常用网段
      '192.168.1.0/24',
      '192.168.0.0/24', 
      '192.168.124.0/24', // 您家的网段
      '192.168.2.0/24',
      '192.168.3.0/24',
      
      // 企业网络常用网段
      '10.0.0.0/24',
      '172.16.0.0/24',
      '172.31.0.0/24',
      
      // 移动热点网段
      '192.168.43.0/24',
      '172.20.10.0/24',
      
      // 虚拟机网段
      '192.168.56.0/24',
      '192.168.99.0/24',
    ]
    
    // 备用固定IP列表（快速测试用）
    this.quickTestIPs = [
      '192.168.124.3', // 您的主要IP
      '192.168.124.7', // 您的备用IP
      '192.168.124.100', // 同网段常用IP
      '192.168.1.100', '192.168.0.100',
      '10.0.0.100', '172.16.0.100'
    ]
  }

  /**
   * 自动检测可用的开发机IP
   */
  async detectDevelopmentIP() {
    console.log('🔍 开始智能检测开发机IP地址...')
    
    // 1. 尝试从缓存获取
    const cachedIP = this.getCachedIP()
    if (cachedIP && await this.testIP(cachedIP)) {
      console.log('✅ 使用缓存的IP:', cachedIP)
      return cachedIP
    }

    // 2. 快速测试常用IP地址
    console.log('🚀 快速测试常用IP...');
    const quickResult = await this.quickIPTest();
    if (quickResult) {
      console.log('✅ 快速测试找到可用IP:', quickResult);
      this.cacheIP(quickResult);
      this.detectedIP = quickResult;
      return quickResult;
    }

    // 3. 延迟网络段扫描（避免与正常请求冲突）
    console.log('⏳ 延迟5秒后进行网络段扫描，避免冲突...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🔍 开始网络段扫描...');
    const networkScanResult = await this.scanNetworkRanges();
    if (networkScanResult) {
      console.log('✅ 网络段扫描找到可用IP:', networkScanResult);
      this.cacheIP(networkScanResult);
      this.detectedIP = networkScanResult;
      return networkScanResult;
    }

    // 4. 智能推测扫描（最后手段）
    console.log('🧠 尝试智能推测扫描...');
    const smartIP = await this.smartNetworkScan();
    if (smartIP) {
      console.log('✅ 智能扫描找到可用IP:', smartIP);
      this.cacheIP(smartIP);
      this.detectedIP = smartIP;
      return smartIP;
    }

    // 5. 如果都失败，返回默认IP（优先使用用户的IP）
    console.warn('❌ 未能检测到可用IP，使用默认值');
    return '192.168.124.3'; // 使用您的主要IP作为默认值
  }

  /**
   * 快速测试常用IP地址
   */
  async quickIPTest() {
    console.log('🚀 快速测试IP列表:', this.quickTestIPs);
    
    const testPromises = this.quickTestIPs.map(ip => 
      this.testIP(ip).then(success => ({ ip, success }))
    );
    
    try {
      const results = await Promise.all(testPromises);
      const successIP = results.find(result => result.success);
      return successIP ? successIP.ip : null;
    } catch (error) {
      console.warn('⚠️ 快速测试出错:', error);
      return null;
    }
  }

  /**
   * 扫描网络段范围
   */
  async scanNetworkRanges() {
    for (const network of this.commonNetworks) {
      console.log(`🔍 扫描网络段: ${network}`);
      
      const scanIPs = this.generateNetworkIPs(network);
      const result = await this.scanIPBatch(scanIPs, `网段 ${network}`);
      
      if (result) {
        return result;
      }
    }
    return null;
  }

  /**
   * 生成网络段内的IP地址列表
   */
  generateNetworkIPs(cidr) {
    const [networkAddr, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength);
    
    if (prefix !== 24) {
      // 简化处理，只支持 /24 网段
      console.warn(`暂不支持 /${prefix} 网段，跳过: ${cidr}`);
      return [];
    }
    
    const [a, b, c] = networkAddr.split('.').map(Number);
    const ips = [];
    
    // 扫描常用的服务器IP地址（避免扫描整个网段的254个IP）
    const commonHostIds = [
      1, 2, 3, 100, 101, 102, 110, 111, 200, 201, 202, 254
    ];
    
    for (const hostId of commonHostIds) {
      if (hostId >= 1 && hostId <= 254) {
        ips.push(`${a}.${b}.${c}.${hostId}`);
      }
    }
    
    return ips;
  }

  /**
   * 批量测试IP地址
   */
  async scanIPBatch(ips, description) {
    if (ips.length === 0) return null;
    
    console.log(`🔄 ${description} - 测试 ${ips.length} 个IP:`, ips.slice(0, 5), ips.length > 5 ? '...' : '');
    
    // 分批测试，避免过多并发
    const batchSize = 6;
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      
      const testPromises = batch.map(ip => 
        this.testIP(ip).then(success => ({ ip, success }))
      );
      
      try {
        const results = await Promise.all(testPromises);
        const successIP = results.find(result => result.success);
        
        if (successIP) {
          console.log(`✅ ${description} - 找到可用IP:`, successIP.ip);
          return successIP.ip;
        }
      } catch (error) {
        console.warn(`⚠️ ${description} - 批次测试出错:`, error);
      }
    }
    
    return null;
  }

  /**
   * 测试IP地址是否可达
   */
  async testIP(ip) {
    try {
      const testUrl = `http://${ip}:5000/api/health`
      
      const result = await new Promise((resolve) => {
        wx.request({
          url: testUrl,
          method: 'GET',
          timeout: 3000,
          success: () => resolve(true),
          fail: () => resolve(false)
        })
      })

      return result
    } catch (error) {
      return false
    }
  }

  /**
   * 缓存可用的IP
   */
  cacheIP(ip) {
    try {
      wx.setStorageSync('dev_server_ip', {
        ip: ip,
        timestamp: Date.now()
      })
    } catch (error) {
      console.warn('缓存IP失败:', error)
    }
  }

  /**
   * 获取缓存的IP
   */
  getCachedIP() {
    try {
      const cached = wx.getStorageSync('dev_server_ip')
      if (cached && cached.ip) {
        // 缓存24小时有效
        const age = Date.now() - cached.timestamp
        if (age < 24 * 60 * 60 * 1000) {
          return cached.ip
        }
      }
    } catch (error) {
      console.warn('读取缓存IP失败:', error)
    }
    return null
  }

  /**
   * 智能网段扫描
   * 基于网络信息智能推测可能的服务器IP
   */
  async smartNetworkScan() {
    try {
      console.log('🧠 开始智能网段扫描...');
      
      // 基于时间特征和网络类型推测可能的网段
      const smartIPs = this.generateSmartIPs();
      
      // 快速并发测试智能推测的IP
      const testPromises = smartIPs.map(ip => 
        this.testIP(ip).then(success => ({ ip, success }))
      );
      
      const results = await Promise.allSettled(testPromises);
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          return result.value.ip;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('智能扫描失败:', error);
      return null;
    }
  }

  /**
   * 生成智能推测的IP列表
   */
  generateSmartIPs() {
    const smartIPs = [];
    const now = new Date();
    const hour = now.getHours();
    
    // 根据时间段推测网络环境
    if (hour >= 9 && hour <= 18) {
      // 工作时间，可能是办公网络
      smartIPs.push('10.0.0.100', '10.0.0.101', '172.16.0.100', '172.16.0.101');
    } else {
      // 非工作时间，可能是家庭网络
      smartIPs.push('192.168.1.100', '192.168.1.101', '192.168.0.100', '192.168.0.101');
    }
    
    // 添加热点网络IP（移动开发常用）
    smartIPs.push('192.168.43.1', '192.168.43.100', '172.20.10.1', '172.20.10.100');
    
    // 添加一些随机变化的IP（基于当前日期）
    const dayOfMonth = now.getDate();
    const baseIPs = ['192.168.1', '192.168.0', '10.0.0'];
    baseIPs.forEach(base => {
      smartIPs.push(`${base}.${100 + (dayOfMonth % 20)}`);
    });
    
    return [...new Set(smartIPs)]; // 去重
  }

  /**
   * 获取开发服务器URL
   */
  async getDevelopmentServerURL() {
    const ip = await this.detectDevelopmentIP()
    return {
      api: `http://${ip}:5000/api`,
      static: `http://${ip}:5000`
    }
  }

  /**
   * 获取检测统计信息
   */
  getDetectionStats() {
    const cachedData = wx.getStorageSync('dev_server_ip') || {};
    return {
      currentIP: this.detectedIP,
      cachedIP: cachedData.ip,
      lastDetectionTime: cachedData.timestamp ? new Date(cachedData.timestamp).toLocaleString() : '未知',
      totalNetworkRanges: this.commonNetworks.length,
      totalQuickTestIPs: this.quickTestIPs.length,
      supportedNetworks: this.commonNetworks
    };
  }
}

// 创建全局实例
const ipDetector = new IPDetector()

module.exports = ipDetector

