#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把稽核過的規則寫進 translations/*.json，並更新翻譯包版本。

用法：python scripts/dev/apply.py <專案根目錄> <rules.json> <版本> <YYYY-MM-DD>

新規則插在 `" for VS Code"` 這條之前（檔尾那幾條是整體性的收尾規則，必須留在最後）。
original 欄位繁簡共用，因此錨點不可以寫死某一語言的譯文。
"""
import io, json, os, sys, collections

ROOT, RULES, VER, DATE = sys.argv[1:5]
data = json.loads(io.open(RULES, encoding='utf-8').read())
for lang, col in [('zh-TW', 1), ('zh-CN', 2)]:
    path = os.path.join(ROOT, 'translations', '%s.json' % lang)
    d = json.loads(io.open(path, encoding='utf-8').read(), object_pairs_hook=collections.OrderedDict)
    before = len(d['translations'])
    d['version'], d['updatedAt'] = VER, DATE
    ign = d['scanIgnore']
    for s in data.get('ignore', []):
        if s not in ign:
            ign.append(s)
    ign.sort()
    tr = d['translations']
    existing = set(x['original'] for x in tr)
    anchor = next(k for k, x in enumerate(tr) if x['original'] == '" for VS Code"')
    add, skip = [], []
    for o, tw, cn, rx in data['rules']:
        if o in existing:
            skip.append(o)
            continue
        r = collections.OrderedDict([('original', o), ('chinese', tw if col == 1 else cn)])
        if rx:
            r['regex'] = True
            r['flags'] = 'g'
        add.append(r)
    tr[anchor:anchor] = add
    io.open(path, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
    print('%s: %d -> %d (add %d, skip %d, scanIgnore %d)' % (lang, before, len(tr), len(add), len(skip), len(ign)))
    for s in skip:
        print('   skip:', s.encode('unicode_escape').decode())
