# -*- coding: utf-8 -*-
"""找出套完規則後仍是整句英文、而且位置在三元運算／引數／回傳的字面值。
掃描器只看介面屬性（title、label…），這些位置它看不到。

用法：python scripts/dev/puresweep.py <套完規則的 index.js>
（套完規則的檔案用 node scripts/dev/emit.js 產生）
"""
import io, os, re, sys

s = io.open(sys.argv[1], encoding='utf-8').read()

pat = re.compile(r'(?:[?:(,\[]|return|=>)\s*(["`])([A-Z][^"`\\\n]{24,420}[.?!…])\1')
seen = {}
for m in pat.finditer(s):
    t = m.group(2)
    if re.search(r'[一-鿿]', t):
        continue
    if len(t.split()) < 5:
        continue
    seen.setdefault(t, m.start())

# 位置落在 Monaco／第三方函式庫的排除掉：用前文特徵粗分
def is_lib(pos):
    ctx = s[max(0, pos - 400):pos]
    return bool(re.search(r'\bv\(\{key:|\bcn\("|nls\.|localize\(|ZodError|\$Zod|KaTeX|katex|ParseError', ctx))

rows = [(p, t) for t, p in seen.items() if not is_lib(p)]
rows.sort()
print('共 %d 筆' % len(rows))
for p, t in rows:
    print('@%d  %s' % (p, t[:200]))
