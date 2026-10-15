import re,sys,html
src=open('index.html',encoding='utf-8').read()
cards=re.findall(r'<a class="topic-card" href="\./(topics/[^"]+)"(.*?)</a>',src,re.S)
stop=set("the a an in of for to and or with how why what on at by from is are be system design use code data guide part".split())
def stem(w):
    w=w.lower()
    for s in("ing","ation","ers","er","es","s","ed"):
        if w.endswith(s) and len(w)-len(s)>=4: return w[:-len(s)]
    return w
rows=[]
for href,body in cards:
    kw=re.search(r'data-keywords="([^"]*)"',body)
    t=re.search(r'topic-card-title">(.*?)</h3>',body,re.S)
    kws={stem(w) for w in re.findall(r"[A-Za-z0-9+#.]+",kw.group(1) if kw else "") if w.lower() not in stop and len(w)>2}
    rows.append((href,html.unescape(t.group(1).strip()) if t else "",kws))
out=[]
for i in range(len(rows)):
    for j in range(i+1,len(rows)):
        a,b=rows[i][2],rows[j][2]
        if not a or not b: continue
        s=len(a&b)/min(len(a),len(b))
        out.append((s,rows[i][0],rows[j][0],rows[i][1],rows[j][1]))
out.sort(reverse=True)
print(len(rows),"cards")
for s,a,b,ta,tb in out[:int(sys.argv[1]) if len(sys.argv)>1 else 60]:
    print(f"{s:.2f} | {a.split('/')[-1]} <> {b.split('/')[-1]}")
