C={'base':'#8e63ce','input':'#4285f4','output':'#34a853','saved':'#fb8c00','charts':'#00acc1','status':'#9e9e9e'}
W,H=1120,580
o=[]
def box(x,y,w,h,t,role,size=14):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{C[role]}"/>')
    o.append(f'<text x="{x+w/2}" y="{y+h/2+5}" text-anchor="middle" fill="#fff" font-size="{size}" font-weight="600">{t}</text>')
def act(x,y,w,h,lines):
    o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{min(h/2,20)}" fill="#fff" stroke="#555" stroke-width="1.5"/>')
    n=len(lines); y0=y+h/2-(n-1)*8+5
    for i,t in enumerate(lines):
        o.append(f'<text x="{x+w/2}" y="{y0+i*16}" text-anchor="middle" fill="#222" font-size="14" font-weight="600">{t}</text>')
def line(d,dash=False,color='#555',arrow=True):
    da=' stroke-dasharray="6 4"' if dash else ''
    m=' marker-end="url(#a)"' if arrow else ''
    o.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.6"{da}{m}/>')
def label(x,y,t,anchor='middle',size=12,color='#666'):
    o.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" fill="{color}" font-size="{size}">{t}</text>')
for x,t in [(115,'Inputs and base data'),(405,'Menu action'),(705,'Output tabs'),(985,'Charts')]:
    label(x,30,t,size=13,color='#222')
bx,bw=20,190
box(bx,50,bw,34,'13_costs','base'); box(bx,100,bw,34,'10_demand-yearly','base'); box(bx,142,bw,34,'11_must-run-yearly','base'); box(bx,184,bw,34,'12_raw-data-hourly','base')
box(bx,260,bw,34,'20_parameters','input'); box(bx,330,bw,34,'21_scenarios-keyframes','input')
act(290,48,230,38,['Calculate Costs']); act(290,168,230,48,['Predict Year']); act(290,306,230,62,['Calculate Scenarios','and Costs'])
label(405,386,'also reads 10-13 and 20_parameters',size=11)
label(405,230,'reads 20, 10, 11, 12',size=11)
ox,ow=600,210
box(ox,50,ow,34,'30_costs-forecast','output')
box(ox,120,ow,34,'42_hourly-predicted','output'); box(ox,162,ow,34,'41_daily-predicted','output'); box(ox,204,ow,34,'40_year-summary','output')
box(ox,262,ow,34,'90_run-history','saved'); label(705,312,'logs 20_parameters + 40_year-summary',size=11)
box(ox,324,ow,34,'50_scenarios-yearly','output')
box(890,141,190,34,'60_daily-chart','charts'); box(890,264,190,34,'61_yearly-chart','charts')
# inputs -> predict (bus x=240)
for y in (117,159,201): line(f'M210,{y} H240',arrow=False)
line('M210,277 H265',arrow=False)
line('M240,117 V277',arrow=False)
line('M240,192 H290')
# 21 -> scenarios (bus x=265)
line('M210,347 H265',arrow=False); line('M265,277 V347',arrow=False); line('M265,337 H290')
# costs
line('M210,67 H290'); line('M520,67 H600')
# predict -> outputs
line('M520,192 H560',arrow=False); line('M560,137 V279',arrow=False)
line('M560,137 H600'); line('M560,179 H600'); line('M560,221 H600'); line('M560,279 H600',color='#fb8c00')
# scenarios -> 50 and 30
line('M520,341 H600'); line('M520,322 H582 V76 H600'.replace('V76 H600','V67'),arrow=False); 
line('M582,67 H600',arrow=False)
# charts (sources per tab descriptions, not verified)
line('M810,137 H850 V158 H890',dash=True); line('M810,179 H850 V158',dash=True,arrow=False)
line('M810,221 H870 V281 H890',dash=True); line('M810,341 H870 V281',dash=True,arrow=False)
label(985,320,'chart sources: per tab description',size=11)
label(985,334,'(to verify)',size=11)
# 30 -> 20
line('M705,50 V16 H8 V277 H20',dash=True,color='#4285f4')
label(360,12,'20_parameters C24/C26 read 30_costs-forecast (HLOOKUP by year)',size=11,color='#4285f4')
# system
o.append('<line x1="20" y1="425" x2="1100" y2="425" stroke="#ddd"/>')
box(bx,455,bw,40,'10-13 (data hash ranges)','base',size=13)
act(290,453,230,44,['Update data hash','Check data status'])
line('M210,475 H290'); line('M520,465 H600'); line('M520,485 H600')
box(ox,448,ow,34,'_meta','status'); box(ox,490,ow,34,'_status','status')
svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#555"/></marker></defs><rect width="100%" height="100%" fill="#fff"/>'+'<g transform="translate(0,24)">'+''.join(o)+'</g></svg>'
open('dep.svg','w').write(svg)
