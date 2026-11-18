# 别给水分付运费 · 独立参考实现：按文字规则把每一种整数公斤拆法（就地 a、原样拉 b、加工再拉 c）都试一遍。
# 不看 core.js 的写法；钱用 Fraction（元）精确算，车数用 math.ceil(Fraction)。
import json, random, math
from fractions import Fraction as F
random.seed(20261118)
def best(c):
    q=c['qty']; T=F(c['fee'])/100+F(c['perkm'])/100*c['dist']; y=F(c['yld'],1000)
    p0,p1,p2,pr=F(c['p0'],100),F(c['p1'],100),F(c['p2'],100),F(c['proc'],100)
    bk=None
    for b in range(q+1):
        for cc in range(q-b+1):
            a=q-b-cc
            nb=math.ceil(F(b,c['cap1'])); nc=math.ceil(cc*y/c['cap2'])
            net=a*p0+b*p1+cc*y*p2-cc*pr-(nb+nc)*T
            key=(net,-(nb+nc),a,-cc)
            if bk is None or key>bk[0]: bk=(key,(a,b,cc),nb,nc)
    (net,_,_,_),(a,b,cc),nb,nc=bk
    return {'net_mf':int(net*100000),'q':[a,b,cc],'n':[nb,nc]}
cases=[]
for i in range(300):
    q=random.randint(1,160)
    c={'qty':q,'p0':random.randint(0,400),'p1':random.randint(0,600),'dist':random.choice([0,random.randint(1,400)]),
       'cap1':random.randint(5,120),'fee':random.randint(0,30000),'perkm':random.choice([0,random.randint(1,800)]),
       'yld':random.randint(1,1000),'proc':random.randint(0,200),'p2':random.randint(0,3000),'cap2':random.randint(1,80)}
    if math.ceil(F(q,c['cap1']))>100 or math.ceil(F(q*c['yld'],1000*c['cap2']))>100: continue
    c['ref']=best(c); cases.append(c)
json.dump(cases,open('ref.json','w'))
from collections import Counter
print(len(cases),'组', Counter(('A' if x['ref']['q'][0]==x['qty'] else 'B' if x['ref']['q'][1]==x['qty'] else 'C' if x['ref']['q'][2]==x['qty'] else 'mix') for x in cases))
