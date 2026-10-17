# Generates the two dependency diagrams (one per use case):
#   docs/dependency-diagram-use-case-1.svg/.png  (Predict Year)
#   docs/dependency-diagram-use-case-2.svg/.png  (Scenarios)
#   docs/dependency-diagram-system.svg/.png      (data version, hash, sync)
# and src/dependency-diagram-data.js (base64 of both PNGs, used by applyDesignScheme).
# Run from docs/:  python3 dependency-diagram.make.py   (PNG conversion needs ImageMagick `convert`)
import base64, re, subprocess

C = {'base': '#8e63ce', 'input': '#4285f4', 'output': '#34a853', 'saved': '#fb8c00', 'charts': '#00acc1', 'status': '#9e9e9e'}
W = 1120

class Diagram:
    def __init__(self, height):
        self.o = []; self.H = height
    def box(self, x, y, w, h, t, role, size=14):
        self.o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{C[role]}"/>')
        self.o.append(f'<text x="{x+w/2}" y="{y+h/2+5}" text-anchor="middle" fill="#fff" font-size="{size}" font-weight="600">{t}</text>')
    def act(self, x, y, w, h, lines):
        self.o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{min(h/2,20)}" fill="#fff" stroke="#555" stroke-width="1.5"/>')
        n = len(lines); y0 = y + h/2 - (n-1)*8 + 5
        for i, t in enumerate(lines):
            self.o.append(f'<text x="{x+w/2}" y="{y0+i*16}" text-anchor="middle" fill="#222" font-size="14" font-weight="600">{t}</text>')
    def line(self, d, dash=False, color='#555', arrow=True):
        da = ' stroke-dasharray="6 4"' if dash else ''
        self.o.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.6"{da}/>')
        if arrow:  # explicit arrow head (ImageMagick does not render SVG markers); path uses only M, H, V
            x = y = px = py = 0
            for cmd, val in re.findall(r'([MHV])\s*(-?[\d.]+)(?:[ ,](-?[\d.]+))?', d.replace(',', ' ')) and [(m.group(1), m.group(2)) for m in re.finditer(r'([MHV])\s*(-?[\d.]+)', d)]:
                px, py = x, y
                if cmd == 'M':
                    x = float(val)
                    y = float(re.search(r'M\s*-?[\d.]+[ ,]\s*(-?[\d.]+)', d).group(1))
                elif cmd == 'H': x = float(val)
                else: y = float(val)
            dx = (x > px) - (x < px); dy = (y > py) - (y < py)
            if dx:
                pts = f'{x},{y} {x-8*dx},{y-4} {x-8*dx},{y+4}'
            else:
                pts = f'{x},{y} {x-4},{y-8*dy} {x+4},{y-8*dy}'
            self.o.append(f'<polygon points="{pts}" fill="{color}"/>')
    def label(self, x, y, t, anchor='middle', size=12, color='#666'):
        self.o.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" fill="{color}" font-size="{size}">{t}</text>')
    def svg(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{self.H}" viewBox="0 0 {W} {self.H}" font-family="Helvetica, Arial, sans-serif">'
                '<rect width="100%" height="100%" fill="#fff"/><g transform="translate(0,40)">' + ''.join(self.o) + '</g></svg>')

def headers(d, title, cols=('Inputs and base data', 'Menu action', 'Output tabs', 'Charts')):
    d.label(560, -18, title, size=15, color='#222')
    for x, t in zip((115, 405, 705, 985), cols):
        d.label(x, 28, t, size=13, color='#222')

bx, bw = 20, 190
ox, ow = 600, 210

# ---------- Use case 1: Predict Year ----------
d1 = Diagram(360)
headers(d1, 'Use case 1: Predict Year (single year)')
d1.box(bx, 50, bw, 34, '20_year-input', 'input')
d1.box(bx, 110, bw, 34, '10_demand-yearly', 'base'); d1.box(bx, 152, bw, 34, '11_must-run-yearly', 'base')
d1.box(bx, 194, bw, 34, '12_raw-data-hourly', 'base')
d1.act(290, 110, 230, 76, ['Predict Year'])
d1.label(405, 206, 'reads 20, 10, 11, 12', size=11)
d1.line('M210,67 H265 V128 H290')
for y in (127, 169, 211): d1.line(f'M210,{y} H240', arrow=False)
d1.line('M240,127 V211', arrow=False); d1.line('M240,160 H290')
d1.box(ox, 110, ow, 34, '23_year-hourly', 'output'); d1.box(ox, 152, ow, 34, '22_year-daily', 'output'); d1.box(ox, 194, ow, 34, '21_year-summary', 'output')
d1.box(ox, 252, ow, 34, '29_year-run-history', 'saved'); d1.label(705, 302, 'logs 20_year-input + 21_year-summary', size=11)
d1.line('M520,148 H560', arrow=False); d1.line('M560,127 V269', arrow=False)
for y in (127, 169, 211): d1.line(f'M560,{y} H600')
d1.line('M560,269 H600', color='#fb8c00')
d1.box(890, 110, 190, 34, '24_year-chart-day', 'charts'); d1.box(890, 152, 190, 34, '25_year-chart-annual', 'charts')
d1.line('M810,127 H890'); d1.line('M810,169 H890')
d1.label(985, 205, '24: one day, from 23', size=11); d1.label(985, 219, '25: all days, from 22', size=11)

# ---------- Use case 2: Scenarios ----------
d2 = Diagram(346)
headers(d2, 'Use case 2: Scenarios')
d2.box(bx, 50, bw, 34, '30_scenarios-input', 'input')
d2.box(bx, 110, bw, 34, '10_demand-yearly', 'base'); d2.box(bx, 152, bw, 34, '11_must-run-yearly', 'base')
d2.box(bx, 194, bw, 34, '12_raw-data-hourly', 'base'); d2.box(bx, 236, bw, 34, '13_assumptions', 'base')
d2.act(290, 100, 230, 90, ['Calculate Scenarios', 'and Costs'])
d2.label(405, 210, 'reads 30, 10, 11, 12, 13', size=11)
d2.label(405, 226, '(not 20_year-input)', size=11)
d2.line('M210,67 H265 V125 H290')
for y in (127, 169, 211, 253): d2.line(f'M210,{y} H240', arrow=False)
d2.line('M240,127 V253', arrow=False); d2.line('M240,160 H290')
d2.box(ox, 110, ow, 34, '31_scenarios-yearly', 'output')
d2.line('M520,127 H600')
d2.label(985, 127, '31 also holds', size=11); d2.label(985, 141, 'two charts', size=11)

# ---------- System: data version, hash and sync ----------
d3 = Diagram(340)
headers(d3, 'System: data version, hash and sync (not part of a use case)', cols=('Sources', 'Menu action', 'Tabs', ''))
d3.box(bx, 50, bw, 34, '10-13 (hash ranges)', 'base')
d3.box(bx, 200, bw, 34, 'MASTER spreadsheet', 'status')
d3.act(290, 48, 230, 38, ['Update data hash'])
d3.act(290, 128, 230, 38, ['Check data status'])
d3.act(290, 200, 230, 60, ['Sync from master'])
d3.label(405, 276, 'in a researcher copy', size=11)
d3.label(405, 186, 'compares 10-13 with _meta', size=11)
d3.box(ox, 50, ow, 34, '_meta', 'status'); d3.box(ox, 128, ow, 34, '_status', 'status')
d3.box(ox, 198, ow, 34, '10-13', 'base'); d3.label(705, 248, 'overwritten from master', size=11)
d3.line('M210,67 H290'); d3.line('M210,67 H250 V147 H290')
d3.line('M210,217 H290')
d3.line('M520,67 H600'); d3.line('M520,147 H600')
d3.line('M520,230 H570', arrow=False); d3.line('M570,230 V67', arrow=False)
d3.line('M570,147 H600'); d3.line('M570,230 H600'); d3.line('M570,67 H600')

# ---------- write files ----------
b64 = {}
for n, d in ((1, d1), (2, d2), (3, d3)):
    name = {1: 'use-case-1', 2: 'use-case-2', 3: 'system'}[n]
    svg = f'dependency-diagram-{name}.svg'; png = f'dependency-diagram-{name}.png'
    open(svg, 'w').write(d.svg())
    subprocess.run(['convert', '-background', 'white', '-density', '96', svg, png], check=True)
    b64[n] = base64.b64encode(open(png, 'rb').read()).decode()
heights = {1: d1.H, 2: d2.H, 3: d3.H}
with open('../src/dependency-diagram-data.js', 'w') as f:
    f.write('// GENERATED by docs/dependency-diagram.make.py (PNGs of the diagrams, base64). Do not edit by hand.\n')
    for n in (1, 2, 3):
        f.write(f"const DEPENDENCY_DIAGRAM_{n}_PNG_BASE64 = '{b64[n]}';\n")
    f.write(f'const DEPENDENCY_DIAGRAM_SIZE = {{width: {W}, heights: [{heights[1]}, {heights[2]}, {heights[3]}]}};\n')
print('ok')
