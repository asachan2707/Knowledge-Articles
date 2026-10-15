import re,sys,json
S={}  # survivor -> dict(title, short, summary, kw, min, absorbed[])
def add(surv,title,short,summary,kw,mins,absorbed):
    S[surv]=dict(title=title,short=short,summary=summary,kw=kw,min=mins,absorbed=absorbed)
add("building-ai-agents-end-to-end","Building AI Agents: Concepts, Architecture and a Step-by-Step Build","Building AI Agents: Concepts & Step-by-Step Build",
"A complete guide to AI agents, from the think-act-observe loop, the four pillars, memory, tools, actions, skills, reasoning and environment to multi-agent orchestration. It then builds a production-ready JavaScript agent step by step, with the failure each layer prevents.",
"ai agents agent-loop react tool-use function-calling memory vector-store rag skills actions guardrails validation reflection environment multi-agent orchestration javascript anthropic hallucination failure-modes step-by-step",40,["build-ai-agent-step-by-step"])
add("master-data-structures-algorithms","Master Data Structures and Algorithms: Patterns, Study Plan and a 24-Problem Interview Bank","Master DSA: Patterns, Study Plan & 24-Problem Bank",
"Teaches the 14 patterns behind most interview problems, the 10 data structures that matter, a 12-week study plan, a 4-step practice method and a clear 'enough' signal. It ends with a 24-problem company interview bank with solution pages, pattern map and a progress tracker.",
"dsa data-structures algorithms leetcode coding-interview patterns two-pointers sliding-window dynamic-programming graphs trees heap trie union-find big-o study-plan 12-week pattern-recognition problem-bank javascript faang blind-75 neetcode practice-method",30,["interview/dsa-problems"])
add("claude-code-complete-guide","The Complete Claude Code Guide: CLAUDE.md, Skills, Hooks, Plugins & the Claude OS Execution Engine","Complete Claude Code Guide & Claude OS",
"A single reference to Claude Code's programmable layers: CLAUDE.md, Hooks, Skills, Plugins/MCP and Workflows. It folds in the 'Claude OS' pattern, covering execution contracts, autonomy gates, deploy skill, session-summary hook and parallel pre-release workflows, which turn Claude from a chat assistant into a reproducible execution engine.",
"claude-code claude-os claude-md skills hooks plugins mcp workflows sub-agents execution-engine orchestration autonomy-gates settings-json slash-commands pre-release-check automation quality-gates",38,["claude-os-execution-engine"])
add("elasticsearch","Elasticsearch Deep Dive: Architecture, Vector/AI Search & How It Compares to the Alternatives","Elasticsearch Deep Dive, Vector Search & Alternatives",
"A production guide to Elasticsearch internals (inverted index, shards, write/read paths, Query DSL, ILM, tuning) plus a deep dive on vector and AI search: HNSW, quantization, kNN, hybrid RRF, ELSER and the Inference API. Includes head-to-head comparisons with Solr, OpenSearch, Typesense, Meilisearch, Algolia and PostgreSQL, with a decision guide.",
"elasticsearch lucene inverted-index shards bm25 query-dsl ilm elk vector-search knn hnsw quantization hybrid-search rrf elser inference-api opensearch solr typesense meilisearch algolia postgres-tsvector",40,["elasticsearch-vs-alternatives-vector-search"])
add("rag-production-complete-guide","RAG from Scratch to Production: Build the Pipeline, Scale to 10M+ Documents, Reduce Hallucination","RAG from Scratch to Production",
"A two-part RAG guide: build a working Node.js pipeline stage by stage, then harden it for production. Covers chunking strategies, hybrid search, re-ranking, Flow RAG routing, 10M+ document indexing, faithfulness checks, semantic caching and evals.",
"rag retrieval-augmented-generation llm chunking embeddings pgvector hnsw hybrid-search bm25 rrf re-ranking flow-rag modular-rag hallucination faithfulness semantic-cache evals nodejs voyage citations vector-database",55,["llm-backbone-rag-gpt-scratch"])
add("uber-architecture-driver-tracking","Uber System Design: Driver Tracking, Matching, ETA and Surge Pricing (Architecture and Interview Guide)","Uber System Design: Tracking, Matching, ETA & Surge",
"End-to-end design of Uber's real-time core: GPS ingestion, H3 indexing, Kafka and WebSocket pipelines, driver matching with distributed locks, A* ETA, and surge pricing with regulatory caps. Includes schemas, APIs, fault tolerance and a company-by-company interview guide.",
"uber system-design ride-hailing driver-tracking geospatial h3 geohash s2 kafka websocket redis-geo dispatch matching distributed-lock eta a-star surge-pricing flink cassandra postgres cap-theorem fault-tolerance interview",65,["interview/uber-driver-matching","uber-surge-pricing-system-design"])
add("cache-stampede-hot-key","Cache Stampedes, Hot Keys and Mass TTL Expiry: Mutex, XFetch, Jitter, Single-Flight and Multi-Level Caching","Cache Stampedes, Hot Keys & Mass TTL Expiry",
"Covers hot-key stampedes and mass TTL expiry, with mutex/SETNX, background refresh, XFetch, jittered TTLs, single-flight and L1/L2/L3 caching with pub/sub invalidation. It also covers circuit breakers and Redis Sentinel vs Cluster, with JavaScript, Python and Go examples.",
"cache-stampede hot-key thundering-herd ttl-expiry mutex setnx xfetch jitter single-flight multi-level-cache l1-l2-l3 pubsub-invalidation redis redis-sentinel redis-cluster circuit-breaker background-refresh production-outage system-design caching",38,["redis-cache-production-outage-stampede"])
add("system-design-complete-visual-guide","System Design: The Complete Guide — Fundamentals to 80+ Concepts","System Design: Complete Guide, Fundamentals to 80+ Concepts",
"One reference for system design, from a no-prerequisites walkthrough of servers, DNS, scaling, caching and Kafka to 80+ concepts across networking, APIs, databases, security and DevOps. It also has real-world teardowns, trade-off deep dives with JavaScript rate limiter and consistent hashing code, the RESHADED interview framework and a 70+ term glossary.",
"system-design scalability cap-theorem consistency-models caching sharding replication consistent-hashing kafka message-queues rate-limiting observability load-balancing api-design databases security devops microservices interview-framework reshaded glossary back-of-envelope",150,["top-system-design-concepts","system-design-for-beginners"])
add("financial-planning-it-professional-india","Financial Planning for IT Professionals in India: Milestones Before 40 and the Complete Roadmap","Financial Planning for IT Professionals in India",
"Why your 30s are the decisive compounding window, with the 8 milestones to hit before 40: emergency fund, debt, insurance, net worth, estate basics. Followed by a complete India-specific plan covering PPF/NPS/EPF, tax, home, child education, parents, retirement and a 20-year roadmap.",
"personal-finance India IT-professional financial-milestones 30s emergency-fund insurance term-insurance health-insurance SIP index-funds PPF NPS EPF tax-planning home-loan child-education retirement FIRE net-worth roadmap",38,["financial-milestones-before-40"])
add("ecommerce-order-processing-system","E-Commerce Order Processing, Saga Pattern and Distributed Transactions: Architecture and Interview Guide","E-Commerce Order Processing & Saga Pattern",
"End-to-end guide to order processing: lifecycle state machine, why ACID and 2PC fail across services, Saga choreography vs orchestration with compensations, Transactional Outbox, idempotency, CQRS, sharding, flash-sale inventory, DLQ and recovery. Includes how a FAANG engineer answers it at L4/L5/L6 in interviews.",
"e-commerce order-processing saga-pattern distributed-transactions microservices choreography orchestration compensating-transactions transactional-outbox idempotency-keys CQRS 2PC Kafka Debezium Vitess SKIP-LOCKED flash-sale dead-letter-queue circuit-breaker Temporal system-design interview FAANG",55,["ecommerce-order-processing-faang","saga-pattern-payment-order-failed"])
add("graphify-folder-knowledge-graph","Graphify: Turn Any Folder Into a Knowledge Graph — How to Use It and How It Went Viral in 48 Hours","Graphify: Folder to Knowledge Graph (and the 48h Story)",
"Graphify turns a folder of code, docs and PDFs into a queryable knowledge graph, reportedly cutting AI token use up to 71.5x. Covers install, usage, internals and FAQ, plus how it was built in 48 hours after a Karpathy request and the shipping lessons.",
"graphify knowledge-graph karpathy tree-sitter networkx leiden god-nodes token-reduction codebase-understanding claude-code cursor mcp open-source viral shipping-fast mvp context-engineering llm-context graph-rag developer-tools career",15,["graphify-karpathy-viral-story"])
add("spec-driven-development-claude","Spec-Driven Development with Claude Code: The SPEC.md Pattern, and How GSD, Spec Kit, OpenSpec and Taskmaster AI Compare","Spec-Driven Development & SDD Tools Compared",
"AI coding sessions degrade by hour three because a context window is not project memory. Spec-Driven Development fixes this with a persistent SPEC.md and a session protocol, and the page compares GSD, Spec Kit, OpenSpec and Taskmaster AI.",
"spec-driven-development sdd claude-code spec-md claude-md context-window session-state agentic-coding gsd spec-kit openspec taskmaster-ai prd task-graph schema-validation hour-three drift-recovery javascript multi-agent ai-coding-workflow",25,["sdd-tools-comparison"])
add("netflix-260m-concurrent-streams","Netflix at Scale: 260M Concurrent Streams, Open Connect CDN Architecture and Cache Prewarming","Netflix at Scale: 260M Streams, CDN & Prewarming",
"How Netflix serves 260M+ subscribers without buffering: Open Connect ISP-embedded CDN, tiered cache hierarchy, encoding pipelines, adaptive bitrate, AWS control plane and chaos engineering. Includes the proactive cache prewarming pipeline that prevents launch-night buffering for new-season releases.",
"netflix streaming cdn open-connect oca cache-prewarming cache-fill abr adaptive-bitrate encoding av1 aws microservices chaos-engineering region-evacuation system-design edge-caching tiered-caching isp-peering launch-night",38,["netflix-cdn-cache-prewarming"])
add("ai-agent-fundamentals-guide","AI Agent Fundamentals: Context Engineering, RAG, and Reliable Agent Design","AI Agent Fundamentals: Context Engineering & RAG",
"Complete guide to building reliable AI agents: agent basics, hybrid reasoning, and context engineering with domains, instructions, actions and filters. Then the RAG layer: content curation, chunking, hybrid search, prompt templates, citations, query rewriting, model choice, and debugging with benchmarks.",
"ai-agents context-engineering rag retrieval-augmented-generation domains subagents instructions actions hybrid-reasoning deterministic-logic chunking embeddings hybrid-search reranking prompt-templates citations pre-filters query-rewriting benchmarks debugging guardrails",30,["best-practices-for-better-agents"])
add("local-llm-coding-2026","Running Local LLMs: Deployment Guide and Best Models for Coding (2026)","Running Local LLMs: Deployment & Best Coding Models",
"A complete guide to running LLMs locally. It covers why to run them locally, hardware sizing, formats, quantisation, runtimes and production serving. It then covers the best coding models on Apple Silicon, with Ollama, Node.js, Continue.dev and Aider setup.",
"local-llm ollama llama.cpp gguf quantization q4_k_m apple-silicon macbook vllm litellm qwen2.5-coder deepseek phi-4 llama-3 continue.dev aider hardware-sizing self-hosted privacy coding-assistant openai-compatible deployment",30,["llm-local-deployment-guide"])
add("best-claude-skills","Claude Skills: The Best Ones and How to Build Them Well","Claude Skills: Best Ones & How to Build Them",
"What 100 field-tested Claude Skills taught one author about which categories save time. Combined with the Skills 2.0 toolkit (Skill-Creator, progressive disclosure, evals) for writing skills that trigger correctly and stay reliable.",
"claude-skills skill.md skill-creator progressive-disclosure evals ab-testing trigger-accuracy frontmatter deterministic-output prompt-engineering workflow-automation capability-uplift encoded-preferences developer-workflows brand-voice team-sharing anthropic claude",12,["claude-skills-2-better-than-99-percent"])
add("real-interview-system-design-questions","System Design Interview Handbook: Real Questions from 10+ Companies and 60+ Scenarios","System Design Interview Handbook: Real Questions & 60+ Scenarios",
"Real system design questions from 11 companies, with component breakdowns, the evaluation rubric, cross-cutting patterns and a 45-minute answer structure. It also folds in a catalog of 60+ scenarios, each reduced to its core insight, plus a pattern quick-reference table and a runnable JavaScript fan-out example.",
"system-design interview faang scenarios fan-out news-feed idempotency kafka redis caching sharding consistent-hashing cqrs circuit-breaker payments search rate-limiter tradeoffs capacity-estimation architecture career",75,["60-system-design-scenarios-interview"])
add("system-design-tradeoffs-l4-to-l7","System Design Interview Mastery: 7 Tradeoffs (L4 → L7) and Lessons from an L7 Teardown","System Design Interview: 7 Tradeoffs L4→L7 & L7 Teardown",
"Combines two Medium articles. One frames system design interviews around tradeoff reasoning, with 7 core tradeoffs and what separates L4 from L7. The other recounts a Google L7 interviewer dismantling a memorized URL shortener design, with a 7-step interview flow and prep FAQ.",
"system-design interview tradeoffs L4 L5 L6 L7 google senior-engineer cap-theorem consistency scaling sql-nosql microservices monolith url-shortener tinyurl failure-modes capacity-estimation bottleneck career",14,["google-l7-system-design"])
add("microservices-patterns-crash-course","Microservices Design Patterns: A Crash Course on the 9 Essential Patterns","Microservices Design Patterns: 9 Essential Patterns",
"Nine essential microservices patterns, from Database Per Service and CQRS to Saga, API Gateway, Circuit Breaker, Service Discovery and Sidecar. Each is explained by the problem it solves, how it works and when to use it, with JavaScript examples for Saga, CQRS, Service Discovery and Event Sourcing.",
"microservices design-patterns database-per-service api-gateway bff cqrs event-sourcing saga orchestration choreography circuit-breaker service-discovery sidecar service-mesh resilience distributed-transactions nodejs",14,["top-6-microservices-patterns-modern"])
add("event-driven-architecture-guide","Event-Driven Architecture for Microservices: The Complete Guide to Scalable, Resilient, Loosely Coupled Systems","Event-Driven Architecture for Microservices: Complete Guide",
"A complete guide to event-driven microservices. It covers the five core properties (immutability, producer independence, broker, consumer groups, replay), event types, Kafka vs RabbitMQ vs SQS, delivery guarantees, idempotent consumers, DLQs, choreography vs orchestration, schema evolution, CQRS and out-of-order events, with Node.js code.",
"event-driven-architecture eda microservices kafka rabbitmq sqs consumer-groups replay idempotency delivery-guarantees dead-letter-queue choreography orchestration saga cqrs schema-evolution event-sourcing out-of-order-events scalability resilience nodejs",35,["event-driven-microservices-scalability"])
add("ai-roadmap-2026","The Complete AI Engineer Roadmap 2026: Phases, Monthly Plan, Projects & Career Path","AI Engineer Roadmap 2026: Phases, Monthly Plan & Career",
"A six-phase AI engineering roadmap folded into a month-by-month 6-month plan: APIs, RAG, agents, evals, production infrastructure and specialisation. Includes JavaScript code, CV and portfolio advice, a skills-transfer section and an FAQ.",
"ai-engineer roadmap-2026 career llm prompt-engineering rag embeddings vector-database agents react tool-use mcp evals llm-as-judge observability caching model-routing portfolio cv faq javascript",45,["become-ai-engineer-2026"])
add("8-llm-cost-optimization-techniques","LLM Cost Optimization: 8 Techniques, Token Reduction, Model Routing & Cost Observability","LLM Cost Optimization: 8 Techniques & Cost Observability",
"Why LLM bills explode after launch and how to cut them 60–80%: output control, prompt caching, model routing, context management, batching, RAG, response caching and fine-tuning. Adds cost observability with budget alerts, production gotchas and a checklist, with JavaScript and Python code.",
"llm-cost token-reduction prompt-caching model-routing output-control max-tokens structured-output batch-api rag semantic-caching fine-tuning cost-observability budget-alerts anthropic haiku sonnet opus system-design checklist",25,["ai-platform-cost-token-reduction-model-routing"])
add("api-gateway-pattern-microservices","API Gateway Pattern in Microservices: Responsibilities, Implementation & Scaling Bottlenecks","API Gateway Pattern: Responsibilities & Scaling Bottlenecks",
"The API Gateway pattern end to end: six core responsibilities and a Node.js reference gateway, then what breaks at 40,000 RPS. Covers JWT verification cost, route resolution, connection pools, edge caching, clustering with Redis rate limiting, failure modes and a readiness checklist.",
"api-gateway microservices jwt-verification rs256 hs256 route-resolution connection-pool littles-law http2 edge-caching etag rate-limiting redis-lua horizontal-scaling l4-load-balancer circuit-breaker failure-modes checklist nodejs",35,["api-gateway-scaling-bottleneck"])
json.dump(S,open('.agents/artifacts/merge_map.json','w'),indent=1)
absorbed2surv={a:s for s,d in S.items() for a in d['absorbed']}
def esc(t): return t.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

# ---- index.html
src=open('index.html',encoding='utf-8').read()
card_re=re.compile(r'(?:[ \t]*<!--[^\n]*-->\n)?[ \t]*<a class="topic-card" href="\./topics/([^"]+)"(.*?)</a>\n\n?',re.S)
cards={m.group(1)[:-5]:m for m in card_re.finditer(src)}
cats={}
for a,s in absorbed2surv.items():
    m=cards.get(a)
    if m:
        c=re.search(r'data-categories="([^"]*)"',m.group(2)).group(1).split()
        rm=re.search(r'data-relevance="(\d+)"',m.group(2)); r=int(rm.group(1)) if rm else 0
        cats.setdefault(s,[set(),0]); cats[s][0]|=set(c); cats[s][1]=max(cats[s][1],r)
missing=[s for s in S if s not in cards]
def upd(m):
    slug=m.group(1)[:-5]
    if slug in absorbed2surv: return ''
    if slug in S:
        t=m.group(0); d=S[slug]
        t=re.sub(r'data-keywords="[^"]*"','data-keywords="%s"'%esc(d['kw']),t,1)
        t=re.sub(r'(topic-card-title">).*?(</h3>)',lambda x:x.group(1)+esc(d['title'])+x.group(2),t,1,flags=re.S)
        t=re.sub(r'(topic-card-summary">).*?(</p>)',lambda x:x.group(1)+esc(d['summary'])+x.group(2),t,1,flags=re.S)
        t=re.sub(r'(topic-card-meta">)[^<]*(</span>)',lambda x:x.group(1)+'%d min'%d['min']+x.group(2),t,1)
        if slug in cats:
            cs=set(re.search(r'data-categories="([^"]*)"',t).group(1).split())|cats[slug][0]
            t=re.sub(r'data-categories="[^"]*"','data-categories="%s"'%' '.join(sorted(cs)),t,1)
            if re.search(r'data-relevance="\d+"',t):
                t=re.sub(r'data-relevance="\d+"',lambda x:'data-relevance="%d"'%max(cats[slug][1],int(re.search(r'data-relevance="(\d+)"',t).group(1))),t,1)
        return t
    return m.group(0)
new=card_re.sub(upd,src)
open('index.html','w',encoding='utf-8').write(new)
print("index: removed",sum(1 for a in absorbed2surv if a in cards),"cards; survivors missing from index:",missing)

# ---- graph/tree files
for fn in ['graph.html','tree.html','tree-multi.html']:
    lines=open(fn,encoding='utf-8').read().split('\n'); out=[]
    present=set(re.findall(r"href:'\./topics/([^']+)\.html'",'\n'.join(lines)))
    claimed={}
    for ln in lines:
        m=re.search(r"href:'\./topics/([^']+)\.html'",ln)
        if m and m.group(1) in absorbed2surv:
            a=m.group(1); s=absorbed2surv[a]
            if s in present or claimed.get(s,a)!=a: continue
            claimed[s]=a
            ln=ln.replace("topics/%s.html"%a,"topics/%s.html"%s)
            ln=re.sub(r"title:'(?:[^'\\]|\\.)*'","title:'%s'"%S[s]['short'].replace("'","\\'"),ln,1)
        elif m and m.group(1) in S:
            ln=re.sub(r"title:'(?:[^'\\]|\\.)*'","title:'%s'"%S[m.group(1)]['short'].replace("'","\\'"),ln,1)
        out.append(ln)
    open(fn,'w',encoding='utf-8').write('\n'.join(out))
    left=sum(1 for ln in out for a in absorbed2surv if "topics/%s.html"%a in ln)
    print(fn,"lines",len(lines),"->",len(out),"leftover refs",left)
