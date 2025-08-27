#!/usr/bin/env python3
import os
import re

def fix_nested_comments(file_path):
    """修复嵌套注释问题"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # 修复各种嵌套注释模式
    
    # 1. 修复 /* 替换XXXrpx /* was XXX /* was XXX */ */，格式
    content = re.sub(r'/\* 替换[^/]*/\* was [^/]*/\* was [^/]*\*/ \*/[^/]*\*/', 
                     '/* 替换单位，小程序不支持vh单位 */', content)
    
    # 2. 修复 /* /* var() removed for compatibility */ */
    content = re.sub(r'/\* /\* var\(\) removed for compatibility \*/ \*/', 
                     '/* var() removed for compatibility */', content)
    
    # 3. 修复 /* gap removed - not supported */ /* gap: XXX;
    content = re.sub(r'/\* gap removed - not supported \*/ /\* gap: ([^;]*;)', 
                     r'/* gap: \1 removed for compatibility */', content)
    
    content = re.sub(r'/\* /\* backdrop-filter: blur removed for compatibility \*/ \*/', 
    
    # 5. 修复 /* 小程序不支持/* ::placeholder... 
    content = re.sub(r'/\* 小程序不支持/\* ::placeholder removed for compatibility \*/ /\* ::placeholder[^}]*}[^/]*\*/', 
                     '/* 小程序不支持::placeholder伪元素，通过placeholder-style属性处理 */', content)
    
    # 6. 修复 /* @media - not supported */ /* @media 格式
    content = re.sub(r'/\* @media - not supported \*/ /\* @media', 
                     '/* @media removed for compatibility', content)
    
    # 7. 修复一般的双重注释开始 /* /*
    content = re.sub(r'/\* /\*', '/*', content)
    
    # 8. 修复一般的双重注释结束 */ */
    content = re.sub(r'\*/ \*/', '*/', content)
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    wxss_files = []
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.wxss'):
                wxss_files.append(os.path.join(root, file))
    
    print(f"修复 {len(wxss_files)} 个WXSS文件的嵌套注释问题...")
    
    fixed_count = 0
    for file_path in sorted(wxss_files):
        if fix_nested_comments(file_path):
            print(f"✅ 修复: {file_path}")
            fixed_count += 1
        else:
            print(f"⏭️  跳过: {file_path}")
    
    print(f"\n修复完成！共修复 {fixed_count} 个文件")

if __name__ == "__main__":
    main()
