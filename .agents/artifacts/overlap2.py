import re,math,html,collections,glob,os
src=open('index.html',encoding='utf-8').read()
cards=re.findall(r'<a class="topic-card" href="\./(topics/[^"]+)"(.*?)</a>',src,re.S)
stop=set("the a an in of for to and or with how why what on at by from is are be this that it as you your can will not but if when then use used using system design guide part more about into which their they also has have each per via vs than one two three all any".split())
def toks(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=re.sub(r'<[^>]+>',' ',t); t=html.unescape(t).lower()
    return [w for w in re.findall(r"[a-z][a-z0-9+#]{2,}",t) if w not in stop]
docs={};titles={}
for href,body in cards:
    if not os.path.exists(href): continue
    txt=open(href,encoding='utf-8').read()
    docs[href]=collections.Counter(toks(txt))
    m=re.search(r'topic-card-title">(.*?)</h3>',body,re.S); titles[href]=html.unescape(m.group(1).strip())
df=collections.Counter()
for c in docs.values(): df.update(c.keys())
N=len(docs)
def vec(c):
    v={w:(1+math.log(n))*math.log(N/df[w]) for w,n in c.items() if df[w]<N*0.3}
    nrm=math.sqrt(sum(x*x for x in v.values())) or 1
    return {w:x/nrm for w,x in v.items()}
V={h:vec(c) for h,c in docs.items()}
hs=list(V);res=[]
for i in range(len(hs)):
    for j in range(i+1,len(hs)):
        a,b=V[hs[i]],V[hs[j]]
        if len(a)>len(b):a,b=b,a
        s=sum(x*b.get(w,0) for w,x in a.items())
        res.append((s,hs[i],hs[j]))
res.sort(reverse=True)
for s,a,b in res[:80]:
    print(f"{s:.2f} | {titles[a][:55]} [{a[7:]}] <> {titles[b][:55]} [{b[7:]}]")
