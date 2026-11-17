# -*- coding: utf-8 -*-
"""在套完規則的輸出裡找「中英混雜」的字串：同一個字面值裡有中文，又有連續兩個以上的英文單字。
這種多半是規則只翻到一半。

用法：python scripts/dev/mixed.py <套完規則的 index.js>
（先用 scratchpad 的 emit.js 或 ctx.js 同樣的方式產生套完規則的檔案）
"""
import io, os, re, sys

s = io.open(sys.argv[1], encoding='utf-8').read()

CJK = re.compile(r'[一-鿿]')
EN2 = re.compile(r"[A-Za-z][a-z']{2,} [a-z][a-z']{1,}(?: [a-z][a-z']+)*")
# 允許出現的英文片語（指令、品牌、識別字）
ALLOW = re.compile(r'Claude Code|Claude in Chrome|claude auth logout|Visual Studio|VS Code|Remote Control|'
                   r'Model Context|system prompt|pull request|npm install|git [a-z]+')

out = {}
for m in re.finditer(r'"((?:[^"\\\n]|\\.){4,400})"|`((?:[^`\\]|\\.){4,600})`', s):
    t = m.group(1) or m.group(2)
    if not CJK.search(t):
        continue
    plain = re.sub(r'\$\{[^{}]*\}', ' ', t)          # 樣板運算式不算
    plain = ALLOW.sub(' ', plain)
    hit = EN2.search(plain)
    if hit and len(hit.group(0)) >= 9:
        out.setdefault(t, m.start())

print('共 %d 筆' % len(out))
for t, pos in sorted(out.items(), key=lambda kv: kv[1]):
    print('@%d  %s' % (pos, t[:230]))
    print()
