// 可访问性测试页面
const AccessibilityTest = require('../../utils/accessibilityTest');

Page({
  data: {
    isRunning: false,
    testResults: null,
    customForeground: '#1F2937',
    customBackground: '#FFFFFF',
    customTestResult: null
  },

  onLoad() {
    console.log('可访问性测试页面加载完成');
    this.accessibilityTest = new AccessibilityTest();
    
    // 自动运行一次测试显示结果
    setTimeout(() => {
      this.runFullTest();
    }, 500);
  },

  /**
   * 运行完整测试
   */
  runFullTest() {
    if (this.data.isRunning) return;
    
    this.setData({ isRunning: true });
    
    // 显示加载提示
    wx.showLoading({
      title: '测试中...',
      mask: true
    });
    
    try {
      // 运行测试（模拟异步操作）
      setTimeout(() => {
        const results = this.accessibilityTest.generateAccessibilityReport();
        
        this.setData({
          testResults: results,
          isRunning: false
        });
        
        wx.hideLoading();
        
        // 显示测试完成提示
        const passRate = parseFloat(results.summary.passRate);
        let title = '测试完成！';
        let icon = 'success';
        
        if (passRate >= 90) {
          title = `优秀！通过率 ${results.summary.passRate}%`;
        } else if (passRate >= 70) {
          title = `良好！通过率 ${results.summary.passRate}%`;
          icon = 'none';
        } else {
          title = `需改进！通过率 ${results.summary.passRate}%`;
          icon = 'none';
        }
        
        wx.showToast({
          title: title,
          icon: icon,
          duration: 2500
        });
        
        // 触觉反馈
        wx.vibrateShort({
          type: 'medium'
        });
        
      }, 1000);
      
    } catch (error) {
      console.error('测试运行失败:', error);
      this.setData({ isRunning: false });
      wx.hideLoading();
      
      wx.showToast({
        title: '测试运行失败',
        icon: 'error',
        duration: 2000
      });
    }
  },

  /**
   * 生成测试报告
   */
  generateReport() {
    if (!this.data.testResults) {
      wx.showToast({
        title: '请先运行测试',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    try {
      const report = this.generateReportContent();
      
      // 将报告保存到本地存储
      wx.setStorageSync('accessibility_report', {
        content: report,
        timestamp: new Date().toISOString(),
        results: this.data.testResults
      });
      
      wx.showToast({
        title: '报告已生成',
        icon: 'success',
        duration: 1500
      });
      
      console.log('可访问性测试报告:', report);
      
    } catch (error) {
      console.error('报告生成失败:', error);
      wx.showToast({
        title: '报告生成失败',
        icon: 'error',
        duration: 1500
      });
    }
  },

  /**
   * 生成报告内容
   */
  generateReportContent() {
    const results = this.data.testResults;
    const timestamp = new Date().toLocaleString('zh-CN');
    
    let report = `# 可访问性测试报告\n\n`;
    report += `生成时间: ${timestamp}\n`;
    report += `测试标准: WCAG 2.1\n\n`;
    
    // 概览
    report += `## 📊 测试概览\n`;
    report += `- 总测试项: ${results.summary.total}\n`;
    report += `- 通过项: ${results.summary.passed}\n`;
    report += `- 失败项: ${results.summary.failed}\n`;
    report += `- 通过率: ${results.summary.passRate}%\n\n`;
    
    // 详细结果
    report += `## 📋 详细测试结果\n`;
    results.details.forEach((item, index) => {
      const status = item.passed ? '✅ 通过' : '❌ 失败';
      report += `### ${index + 1}. ${item.description}\n`;
      report += `- 状态: ${status}\n`;
      report += `- 前景色: ${item.foreground}\n`;
      report += `- 背景色: ${item.background}\n`;
      report += `- 对比度: ${item.ratio}:1\n`;
      report += `- 等级: ${item.level}\n`;
      report += `- 建议: ${item.recommendation}\n\n`;
    });
    
    // 改进建议
    report += `## 💡 改进建议\n`;
    results.recommendations.forEach((rec, index) => {
      report += `${index + 1}. ${rec}\n`;
    });
    
    return report;
  },

  /**
   * 导出测试结果
   */
  exportResults() {
    if (!this.data.testResults) {
      wx.showToast({
        title: '请先运行测试',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    try {
      // 格式化测试数据用于导出
      const exportData = {
        metadata: {
          appName: '音乐疗愈项目',
          testDate: new Date().toISOString(),
          standard: 'WCAG 2.1',
          version: '1.0.0'
        },
        summary: this.data.testResults.summary,
        details: this.data.testResults.details.map(item => ({
          test: item.description,
          passed: item.passed,
          contrast: item.ratio,
          level: item.level,
          colors: {
            foreground: item.foreground,
            background: item.background
          }
        })),
        recommendations: this.data.testResults.recommendations
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // 保存到剪贴板
      wx.setClipboardData({
        data: jsonString,
        success: () => {
          wx.showToast({
            title: '已复制到剪贴板',
            icon: 'success',
            duration: 2000
          });
        },
        fail: () => {
          wx.showToast({
            title: '导出失败',
            icon: 'error',
            duration: 1500
          });
        }
      });
      
    } catch (error) {
      console.error('导出失败:', error);
      wx.showToast({
        title: '导出失败',
        icon: 'error',
        duration: 1500
      });
    }
  },

  /**
   * 前景色输入变化
   */
  onForegroundChange(e) {
    this.setData({
      customForeground: e.detail.value,
      customTestResult: null
    });
  },

  /**
   * 背景色输入变化
   */
  onBackgroundChange(e) {
    this.setData({
      customBackground: e.detail.value,
      customTestResult: null
    });
  },

  /**
   * 测试自定义颜色组合
   */
  testCustomColors() {
    const { customForeground, customBackground } = this.data;
    
    if (!this.isValidHexColor(customForeground) || !this.isValidHexColor(customBackground)) {
      wx.showToast({
        title: '请输入有效的十六进制颜色值',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    try {
      const result = this.accessibilityTest.testColorCombination(
        customForeground,
        customBackground,
        '自定义颜色组合'
      );
      
      this.setData({
        customTestResult: result
      });
      
      // 触觉反馈
      wx.vibrateShort({
        type: 'light'
      });
      
    } catch (error) {
      console.error('自定义颜色测试失败:', error);
      wx.showToast({
        title: '颜色测试失败',
        icon: 'error',
        duration: 1500
      });
    }
  },

  /**
   * 验证十六进制颜色值
   */
  isValidHexColor(hex) {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
  },

  /**
   * 页面分享
   */
  onShareAppMessage() {
    return {
      title: '音乐疗愈项目 - 可访问性测试结果',
      path: '/pages/accessibility-test/accessibility-test',
      imageUrl: '/images/share-accessibility.png'
    };
  },

  /**
   * 页面卸载时清理
   */
  onUnload() {
    // 清理定时器等资源
    if (this.testTimer) {
      clearTimeout(this.testTimer);
    }
  }
});
