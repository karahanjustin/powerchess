"""Write the file list and a content hash into scan/sw.js (run after changing any file of the app)."""
import hashlib, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files, h = [], hashlib.sha256()
for d, _, fs in os.walk(ROOT):
    for f in sorted(fs):
        p = os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/')
        if p == 'sw.js' or p.startswith('tools/') or p.startswith('test') or p.endswith('.txt') or p.endswith('.md'):
            continue
        files.append(p)
files.sort()
for p in files:
    h.update(p.encode()); h.update(open(os.path.join(ROOT, p), 'rb').read())
files = ['./'] + files
sw = open(os.path.join(ROOT, 'sw.js')).read()
sw = re.sub(r"var VERSION = '[^']*';", "var VERSION = '%s';" % h.hexdigest()[:12], sw)
sw = re.sub(r"var FILES = \[.*?\];", "var FILES = %s;" % json.dumps(files), sw, flags=re.S)
open(os.path.join(ROOT, 'sw.js'), 'w').write(sw)
print(len(files), 'files, version', h.hexdigest()[:12])
