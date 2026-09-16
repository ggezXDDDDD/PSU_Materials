import os
import re
import urllib.parse

WORKSPACE = '/Users/kongpop/Desktop/PSU_Materials'
EXCLUDED_DIRS = {'.git', 'android', 'node_modules', 'runtime', 'logs', 'web', '__pycache__'}
broken = []
total_links = 0
html_files = []

for root, dirs, files in os.walk(WORKSPACE):
    dirs[:] = [name for name in dirs if name not in EXCLUDED_DIRS]
    for f in files:
        if f.endswith('.html'):
            html_files.append(os.path.join(root, f))

for hfile in html_files:
    with open(hfile, 'r', encoding='utf-8') as f:
        content = f.read()
    
    links = re.findall(r'(?:href|src)=["\']([^"\']+)["\']', content)
    for link in links:
        total_links += 1
        if link.startswith(('#', 'http://', 'https://', 'mailto:', 'javascript:', 'data:')):
            continue
        if '${' in link:
            continue
        clean_link = link.split('?')[0].split('#')[0]
        if not clean_link:
            continue
        clean_link = urllib.parse.unquote(clean_link)
        target = os.path.normpath(os.path.join(os.path.dirname(hfile), clean_link))
        if not os.path.exists(target):
            broken.append((hfile, link, target))

print(f'Total links checked: {total_links}')
if broken:
    print(f'Found {len(broken)} broken links:')
    for h, l, t in broken:
        print(f'  In {os.path.basename(h)}: {l} -> {t}')
else:
    print('ALL LINKS VALID! 0 broken links.')
