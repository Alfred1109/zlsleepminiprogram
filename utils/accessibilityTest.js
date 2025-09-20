/**
 * 可访问性测试工具
 * 基于WCAG 2.1标准，测试色彩对比度和可读性
 */

class AccessibilityTest {
  constructor() {
    this.wcagStandards = {
      AA_NORMAL: 4.5,    // WCAG AA级标准 - 普通文字
      AA_LARGE: 3.0,     // WCAG AA级标准 - 大文字(18pt+)
      AAA_NORMAL: 7.0,   // WCAG AAA级标准 - 普通文字
      AAA_LARGE: 4.5     // WCAG AAA级标准 - 大文字
    };

    // 项目配色方案
    this.colorScheme = {
      // 文字颜色（优化后）
      textPrimary: '#1F2937',      // 主文字 - 深灰
      textSecondary: '#4B5563',    // 次要文字 - 中灰
      textMuted: '#6B7280',        // 辅助文字 - 浅灰
      textPlaceholder: '#9CA3AF',  // 占位文字 - 更浅灰
      
      // 背景颜色
      bgWhite: '#FFFFFF',
      bgPrimary: '#F9FAFB',
      bgSecondary: '#F3F4F6',
      
      // 品牌色彩
      brandOrange: '#FF6B35',
      brandLight: '#FF8B5A',
      brandDark: '#E5602F',
      
      // 主题色彩
      themePurple: '#C0A9BD',
      themeLight: '#D4C3D1',
      
      // 语义化色彩
      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',
      info: '#2563EB'
    };

    // 测试组合配置
    this.testCombinations = [
      // 主要文字组合
      { foreground: 'textPrimary', background: 'bgWhite', type: 'normal', description: '主文字 - 白底' },
      { foreground: 'textPrimary', background: 'bgPrimary', type: 'normal', description: '主文字 - 主背景' },
      { foreground: 'textSecondary', background: 'bgWhite', type: 'normal', description: '次要文字 - 白底' },
      { foreground: 'textMuted', background: 'bgWhite', type: 'normal', description: '辅助文字 - 白底' },
      
      // 品牌色组合
      { foreground: '#FFFFFF', background: 'brandOrange', type: 'normal', description: '白字 - 橙色背景' },
      { foreground: '#FFFFFF', background: 'themePurple', type: 'normal', description: '白字 - 紫色背景' },
      
      // 语义化色彩组合
      { foreground: 'success', background: 'bgWhite', type: 'normal', description: '成功色 - 白底' },
      { foreground: 'warning', background: 'bgWhite', type: 'normal', description: '警告色 - 白底' },
      { foreground: 'error', background: 'bgWhite', type: 'normal', description: '错误色 - 白底' },
      { foreground: 'info', background: 'bgWhite', type: 'normal', description: '信息色 - 白底' }
    ];
  }

  /**
   * RGB颜色转换为相对亮度
   */
  getRelativeLuminance(hex) {
    const rgb = this.hexToRgb(hex);
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * 计算颜色对比度
   */
  getContrastRatio(color1, color2) {
    const lum1 = this.getRelativeLuminance(color1);
    const lum2 = this.getRelativeLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * 十六进制转RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * 获取颜色值（支持颜色名称和十六进制）
   */
  getColorValue(color) {
    return this.colorScheme[color] || color;
  }

  /**
   * 评估对比度等级
   */
  evaluateContrast(ratio, textSize = 'normal') {
    const standards = this.wcagStandards;
    const isLarge = textSize === 'large';
    
    let level = 'FAIL';
    let recommendation = '不符合可访问性标准';
    
    if (ratio >= standards.AAA_NORMAL || (isLarge && ratio >= standards.AAA_LARGE)) {
      level = 'AAA';
      recommendation = '优秀 - 超过AAA级标准';
    } else if (ratio >= standards.AA_NORMAL || (isLarge && ratio >= standards.AA_LARGE)) {
      level = 'AA';
      recommendation = '良好 - 符合AA级标准';
    } else if (ratio >= 3.0) {
      level = 'POOR';
      recommendation = '较差 - 建议改进';
    }
    
    return { level, recommendation, ratio };
  }

  /**
   * 运行完整的可访问性测试
   */
  runFullTest() {
    console.log('🔍 开始可访问性测试...\n');
    
    const results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };

    this.testCombinations.forEach(combination => {
      const foregroundColor = this.getColorValue(combination.foreground);
      const backgroundColor = this.getColorValue(combination.background);
      
      const ratio = this.getContrastRatio(foregroundColor, backgroundColor);
      const evaluation = this.evaluateContrast(ratio, combination.type);
      
      const testResult = {
        description: combination.description,
        foreground: foregroundColor,
        background: backgroundColor,
        ratio: ratio.toFixed(2),
        level: evaluation.level,
        recommendation: evaluation.recommendation,
        passed: evaluation.level !== 'FAIL'
      };
      
      if (testResult.passed) {
        results.passed++;
      } else {
        results.failed++;
      }
      results.total++;
      results.details.push(testResult);
      
      // 控制台输出
      const statusIcon = testResult.passed ? '✅' : '❌';
      const levelColor = this.getLevelColor(evaluation.level);
      console.log(`${statusIcon} ${combination.description}`);
      console.log(`   对比度: ${ratio.toFixed(2)}:1 | 等级: ${evaluation.level} | ${evaluation.recommendation}`);
      console.log('');
    });

    // 输出总结
    console.log('📊 测试总结:');
    console.log(`总计: ${results.total} 项测试`);
    console.log(`通过: ${results.passed} 项 (${(results.passed / results.total * 100).toFixed(1)}%)`);
    console.log(`失败: ${results.failed} 项 (${(results.failed / results.total * 100).toFixed(1)}%)`);
    console.log('');

    // 生成改进建议
    this.generateImprovementSuggestions(results);
    
    return results;
  }

  /**
   * 获取等级对应的颜色
   */
  getLevelColor(level) {
    const colors = {
      'AAA': '#059669',   // 绿色
      'AA': '#D97706',    // 橙色
      'POOR': '#DC2626',  // 红色
      'FAIL': '#DC2626'   // 红色
    };
    return colors[level] || '#6B7280';
  }

  /**
   * 生成改进建议
   */
  generateImprovementSuggestions(results) {
    console.log('💡 改进建议:');
    
    const failedTests = results.details.filter(test => !test.passed);
    
    if (failedTests.length === 0) {
      console.log('🎉 恭喜！所有配色组合都通过了可访问性测试');
      return;
    }

    failedTests.forEach((test, index) => {
      console.log(`${index + 1}. ${test.description}`);
      console.log(`   当前对比度: ${test.ratio}:1`);
      console.log(`   建议调整: 增加前景色和背景色的对比度差异`);
      
      // 提供具体的颜色调整建议
      const suggestedColors = this.suggestBetterColors(test.foreground, test.background);
      if (suggestedColors) {
        console.log(`   建议前景色: ${suggestedColors.foreground}`);
        console.log(`   建议背景色: ${suggestedColors.background}`);
      }
      console.log('');
    });
  }

  /**
   * 建议更好的颜色组合
   */
  suggestBetterColors(currentFg, currentBg) {
    // 这里可以实现智能颜色建议算法
    // 基于当前颜色，调整明度或饱和度来改善对比度
    
    // 简化版本：提供一些预设的高对比度组合
    const highContrastCombinations = {
      '#FFFFFF': ['#1F2937', '#374151', '#4B5563'],  // 白底配深色文字
      '#F9FAFB': ['#1F2937', '#374151'],             // 浅背景配深色文字
      '#FF6B35': ['#FFFFFF', '#FEF3C7'],             // 橙色背景配浅色文字
      '#C0A9BD': ['#FFFFFF', '#F3F4F6']              // 紫色背景配浅色文字
    };

    return highContrastCombinations[currentBg] ? {
      foreground: highContrastCombinations[currentBg][0],
      background: currentBg
    } : null;
  }

  /**
   * 测试特定颜色组合
   */
  testColorCombination(foreground, background, description = '自定义组合') {
    const fgColor = this.getColorValue(foreground);
    const bgColor = this.getColorValue(background);
    
    const ratio = this.getContrastRatio(fgColor, bgColor);
    const evaluation = this.evaluateContrast(ratio);
    
    console.log(`🔍 测试: ${description}`);
    console.log(`前景色: ${fgColor}`);
    console.log(`背景色: ${bgColor}`);
    console.log(`对比度: ${ratio.toFixed(2)}:1`);
    console.log(`等级: ${evaluation.level}`);
    console.log(`建议: ${evaluation.recommendation}`);
    console.log('');
    
    return {
      ratio: ratio.toFixed(2),
      level: evaluation.level,
      recommendation: evaluation.recommendation,
      passed: evaluation.level !== 'FAIL'
    };
  }

  /**
   * 生成可访问性报告（用于展示）
   */
  generateAccessibilityReport() {
    const results = this.runFullTest();
    
    return {
      summary: {
        total: results.total,
        passed: results.passed,
        failed: results.failed,
        passRate: (results.passed / results.total * 100).toFixed(1)
      },
      details: results.details,
      recommendations: this.getRecommendations(results),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取优化建议
   */
  getRecommendations(results) {
    const recommendations = [];
    
    if (results.passed / results.total >= 0.9) {
      recommendations.push('✅ 配色方案整体表现优秀，符合可访问性标准');
    } else if (results.passed / results.total >= 0.7) {
      recommendations.push('⚠️ 配色方案基本符合要求，建议优化部分组合');
    } else {
      recommendations.push('❌ 配色方案需要重大改进，多项测试未通过');
    }
    
    // 基于失败的测试提供具体建议
    const failedTests = results.details.filter(test => !test.passed);
    if (failedTests.length > 0) {
      recommendations.push(`需要优化 ${failedTests.length} 个配色组合`);
      recommendations.push('建议增加前景色和背景色的对比度');
      recommendations.push('可考虑使用更深的文字颜色或更浅的背景色');
    }
    
    return recommendations;
  }
}

// 导出工具类
module.exports = AccessibilityTest;

// 如果在小程序环境中运行测试
if (typeof wx !== 'undefined') {
  // 创建全局测试实例
  const accessibilityTest = new AccessibilityTest();
  
  // 添加到全局对象中，方便在开发工具中调用
  wx.accessibilityTest = accessibilityTest;
  
  console.log('🎨 可访问性测试工具已加载');
  console.log('使用 wx.accessibilityTest.runFullTest() 运行完整测试');
  console.log('使用 wx.accessibilityTest.testColorCombination("#FF6B35", "#FFFFFF") 测试特定组合');
}
