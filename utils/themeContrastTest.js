/**
 * 主题配色对比度测试工具
 * 基于WCAG 2.1标准，验证新的主题配色方案
 */

class ThemeContrastTest {
  constructor() {
    this.wcagStandards = {
      AA_NORMAL: 4.5,    // WCAG AA级标准 - 普通文字
      AA_LARGE: 3.0,     // WCAG AA级标准 - 大文字(18pt+)
      AAA_NORMAL: 7.0,   // WCAG AAA级标准 - 普通文字
      AAA_LARGE: 4.5     // WCAG AAA级标准 - 大文字
    };

    // 主题配色方案
    this.themeColors = {
      // 平静模式 - 蓝绿色调
      'calm-mode': {
        background: '#E0F2F1',
        textPrimary: '#065F46',
        textSecondary: '#047857',
        textMuted: '#047857', // 使用中绿色提高对比度
        buttonBg: '#065F46', // 使用更深的绿色提高对比度
        buttonText: '#FFFFFF'
      },
      
      // 专注模式 - 紫色调
      'focus-mode': {
        background: '#EEE7F4',
        textPrimary: '#4C1D95',
        textSecondary: '#5B21B6',
        textMuted: '#7C3AED',
        buttonBg: '#4C1D95', // 使用更深的紫色提高对比度
        buttonText: '#FFFFFF'
      },
      
      // 活力模式 - 橙色调
      'energy-mode': {
        background: '#FFF4E6',
        textPrimary: '#9A3412',
        textSecondary: '#C2410C',
        textMuted: '#C2410C', // 使用中橙色替代活力橙色提高对比度
        buttonBg: '#9A3412', // 使用更深的橙色提高对比度
        buttonText: '#FFFFFF'
      },
      
      // 放松模式 - 绿色调
      'relax-mode': {
        background: '#F0FDF4',
        textPrimary: '#166534',
        textSecondary: '#15803D',
        textMuted: '#15803D', // 使用中绿色替代自然绿色提高对比度
        buttonBg: '#166534', // 使用更深的绿色提高对比度
        buttonText: '#FFFFFF'
      },
      
      // 晨间主题 - 金黄色调
      'morning-theme': {
        background: '#FEF3C7',
        textPrimary: '#92400E',
        textSecondary: '#B45309',
        textMuted: '#B45309', // 使用中棕橙色替代金色提高对比度
        buttonBg: '#92400E', // 使用更深的棕橙色提高对比度
        buttonText: '#FFFFFF'
      },
      
      // 暮间主题 - 蓝紫色调
      'evening-theme': {
        background: '#E0E7FF',
        textPrimary: '#1E1B4B',
        textSecondary: '#312E81',
        textMuted: '#3730A3',
        buttonBg: '#3730A3',
        buttonText: '#FFFFFF'
      },
      
      // 夜间主题 - 深色调
      'night-theme': {
        background: '#1F2937',
        textPrimary: '#F9FAFB',
        textSecondary: '#E5E7EB',
        textMuted: '#D1D5DB',
        buttonBg: '#6366F1',
        buttonText: '#FFFFFF'
      }
    };
  }

  /**
   * 计算相对亮度
   * @param {string} hex - 十六进制颜色值
   * @returns {number} 相对亮度值 (0-1)
   */
  getLuminance(hex) {
    // 移除 # 符号
    const color = hex.replace('#', '');
    
    // 转换为RGB值
    const r = parseInt(color.substr(0, 2), 16) / 255;
    const g = parseInt(color.substr(2, 2), 16) / 255;
    const b = parseInt(color.substr(4, 2), 16) / 255;
    
    // 应用gamma校正
    const getRGBValue = (value) => {
      return value <= 0.03928 
        ? value / 12.92 
        : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    
    const rLuminance = getRGBValue(r);
    const gLuminance = getRGBValue(g);
    const bLuminance = getRGBValue(b);
    
    // 计算相对亮度
    return 0.2126 * rLuminance + 0.7152 * gLuminance + 0.0722 * bLuminance;
  }

  /**
   * 计算对比度
   * @param {string} color1 - 颜色1
   * @param {string} color2 - 颜色2
   * @returns {number} 对比度比值
   */
  getContrastRatio(color1, color2) {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * 评估对比度等级
   * @param {number} ratio - 对比度比值
   * @returns {object} 评估结果
   */
  evaluateContrast(ratio) {
    return {
      ratio: ratio.toFixed(2),
      aaPass: ratio >= this.wcagStandards.AA_NORMAL,
      aaaPass: ratio >= this.wcagStandards.AAA_NORMAL,
      aaLargePass: ratio >= this.wcagStandards.AA_LARGE,
      aaaLargePass: ratio >= this.wcagStandards.AAA_LARGE
    };
  }

  /**
   * 测试单个主题的配色对比度
   * @param {string} themeName - 主题名称
   * @returns {object} 测试结果
   */
  testThemeContrast(themeName) {
    const colors = this.themeColors[themeName];
    if (!colors) {
      return { error: `主题 ${themeName} 不存在` };
    }

    const tests = {
      // 主要文字对比度
      primaryText: this.evaluateContrast(
        this.getContrastRatio(colors.textPrimary, colors.background)
      ),
      
      // 次要文字对比度
      secondaryText: this.evaluateContrast(
        this.getContrastRatio(colors.textSecondary, colors.background)
      ),
      
      // 辅助文字对比度
      mutedText: this.evaluateContrast(
        this.getContrastRatio(colors.textMuted, colors.background)
      ),
      
      // 按钮文字对比度
      buttonText: this.evaluateContrast(
        this.getContrastRatio(colors.buttonText, colors.buttonBg)
      )
    };

    return {
      theme: themeName,
      colors,
      tests,
      overall: {
        allAAPass: Object.values(tests).every(test => test.aaPass),
        allAAAPass: Object.values(tests).every(test => test.aaaPass)
      }
    };
  }

  /**
   * 测试所有主题
   * @returns {object} 全部测试结果
   */
  testAllThemes() {
    const results = {};
    const summary = {
      totalThemes: 0,
      aaPassThemes: 0,
      aaaPassThemes: 0,
      issues: []
    };

    Object.keys(this.themeColors).forEach(themeName => {
      const result = this.testThemeContrast(themeName);
      results[themeName] = result;
      
      summary.totalThemes++;
      if (result.overall.allAAPass) summary.aaPassThemes++;
      if (result.overall.allAAAPass) summary.aaaPassThemes++;
      
      // 收集问题
      Object.entries(result.tests).forEach(([textType, test]) => {
        if (!test.aaPass) {
          summary.issues.push({
            theme: themeName,
            textType,
            ratio: test.ratio,
            colors: {
              text: result.colors[textType] || result.colors.buttonText,
              background: textType === 'buttonText' ? result.colors.buttonBg : result.colors.background
            }
          });
        }
      });
    });

    return { results, summary };
  }

  /**
   * 生成测试报告
   * @returns {string} 格式化的测试报告
   */
  generateReport() {
    const { results, summary } = this.testAllThemes();
    
    let report = '\n=== 主题配色对比度测试报告 ===\n\n';
    
    // 总体概况
    report += `📊 测试概况:\n`;
    report += `• 总主题数: ${summary.totalThemes}\n`;
    report += `• WCAG AA 达标: ${summary.aaPassThemes}/${summary.totalThemes}\n`;
    report += `• WCAG AAA 达标: ${summary.aaaPassThemes}/${summary.totalThemes}\n\n`;
    
    // 各主题详情
    Object.entries(results).forEach(([themeName, result]) => {
      const chineseNames = {
        'calm-mode': '🧘 平静模式',
        'focus-mode': '🎯 专注模式', 
        'energy-mode': '⚡ 活力模式',
        'relax-mode': '🌿 放松模式',
        'morning-theme': '🌅 晨间主题',
        'evening-theme': '🌇 暮间主题',
        'night-theme': '🌙 夜间主题'
      };
      
      report += `${chineseNames[themeName] || themeName}:\n`;
      report += `  • 主要文字: ${result.tests.primaryText.ratio} ${result.tests.primaryText.aaPass ? '✅' : '❌'}\n`;
      report += `  • 次要文字: ${result.tests.secondaryText.ratio} ${result.tests.secondaryText.aaPass ? '✅' : '❌'}\n`;
      report += `  • 辅助文字: ${result.tests.mutedText.ratio} ${result.tests.mutedText.aaPass ? '✅' : '❌'}\n`;
      report += `  • 按钮文字: ${result.tests.buttonText.ratio} ${result.tests.buttonText.aaPass ? '✅' : '❌'}\n`;
      report += `  • 整体评级: ${result.overall.allAAPass ? '✅ AA达标' : '❌ AA未达标'}\n\n`;
    });
    
    // 问题清单
    if (summary.issues.length > 0) {
      report += '⚠️ 需要注意的配色问题:\n';
      summary.issues.forEach((issue, index) => {
        report += `${index + 1}. ${issue.theme} - ${issue.textType}: 对比度 ${issue.ratio}\n`;
        report += `   文字色: ${issue.colors.text}, 背景色: ${issue.colors.background}\n`;
      });
    } else {
      report += '🎉 所有主题配色都符合 WCAG AA 标准！\n';
    }
    
    report += '\n=== 测试完成 ===';
    
    return report;
  }

  /**
   * 在小程序环境中运行测试
   */
  runTest() {
    const report = this.generateReport();
    console.log(report);
    
    // 如果在小程序环境中，可以显示弹窗
    if (typeof wx !== 'undefined') {
      wx.showModal({
        title: '配色测试报告',
        content: '详细报告已输出到控制台，请查看开发者工具',
        showCancel: false
      });
    }
    
    return this.testAllThemes();
  }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeContrastTest;
}

// 在浏览器或小程序环境中自动运行测试
if (typeof wx !== 'undefined' || typeof window !== 'undefined') {
  const tester = new ThemeContrastTest();
  // 可以通过 console 调用: tester.runTest()
  console.log('🎨 主题配色测试工具已加载，调用 tester.runTest() 开始测试');
}
