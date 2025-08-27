#!/usr/bin/env python3
import os
import re

def fix_wxss_file(file_path):
    """修复WXSS文件的兼容性问题"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # 1. 修复vh/vw单位
    content = re.sub(r'(\d+)vh', r'\1rpx /* was \1vh */', content)
    content = re.sub(r'(\d+)vw', r'\1rpx /* was \1vw */', content)
    content = re.sub(r'100vh', '1334rpx /* was 100vh */', content)
    content = re.sub(r'50vh', '667rpx /* was 50vh */', content)
    
    # 2. 注释掉gap属性（不在注释中的）
    content = re.sub(r'^(\s*)gap\s*:', r'\1/* gap: removed for compatibility */ /* gap:', content, flags=re.MULTILINE)
    
    # 3. 注释掉@media查询（不在注释中的）
    content = re.sub(r'^(\s*)@media', r'\1/* @media removed for compatibility */ /* @media', content, flags=re.MULTILINE)
    
    # 4. 注释掉::placeholder伪元素
    content = re.sub(r'::placeholder', r'/* ::placeholder removed for compatibility */ /* ::placeholder', content)
    
    # 5. 注释掉var()函数（不在注释中的）
    content = re.sub(r'var\s*\([^)]+\)', r'/* var() removed for compatibility */', content)
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    wxss_files = []
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.wxss') and 'test_' not in file:
                wxss_files.append(os.path.join(root, file))
    
    print(f"修复 {len(wxss_files)} 个WXSS文件...")
    
    fixed_count = 0
    for file_path in sorted(wxss_files):
        if fix_wxss_file(file_path):
            print(f"✅ 修复: {file_path}")
            fixed_count += 1
        else:
            print(f"⏭️  跳过: {file_path}")
    
    print(f"\n修复完成！共修复 {fixed_count} 个文件")

if __name__ == "__main__":
    main()
