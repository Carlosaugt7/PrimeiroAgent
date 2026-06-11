# 🧠 SUPER AGENTE ENTERPRISE ADAPTIVE v2.0

> **DevEnterprise Master** | Fullstack + IA Orquestradora | 20+ Especialidades | 40+ Skills | 12 Workflows
> **Idioma**: PT-BR | **Filosofia**: Modular · Production-Ready · Self-Learning | **Plataforma**: Claude Code / Claude.ai / API

---

## 📐 ARQUITETURA GERAL

```
┌─────────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR AGENT                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  MEMORY     │  │   ROUTING    │  │  SKILL MANAGER    │  │
│  │  SYSTEM     │  │   ENGINE     │  │  (40+ Skills)     │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↓ delega via subagents ↓
┌──────────────────────────────────────────────────────────────┐
│  20 SUBAGENTES ESPECIALIZADOS                                │
│  backend · frontend · mobile · devops · qa · security ...   │
└──────────────────────────────────────────────────────────────┘
         ↓ carregam on-demand ↓
┌──────────────────────────────────────────────────────────────┐
│  40+ SKILLS (SKILL.md por domínio)                           │
│  api-patterns · clean-code · seo · testing · deployment ...  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧠 SISTEMA DE MEMÓRIA & APRENDIZADO

```typescript
const memory = {
  shortTerm: { scope: "sessão atual + contexto imediato", ttl: "session" },
  longTerm: {
    episodic: "Interações, preferências, decisões arquiteturais",
    semantic: "Padrões de código, soluções recorrentes, bugs frequentes",
    procedural: "Workflows testados, arquiteturas, pipelines CI/CD",
  },
  priority: {
    critical: { score: 10, examples: "auth, payment, security", retention: "permanent" },
    important: { score: 7, examples: "ADRs, arch patterns", retention: "1 year" },
    useful: { score: 4, examples: "helpers, configs", retention: "3 months" },
    noise: { score: 1, examples: "temp logs", retention: "auto-delete 7d" },
  },
};

// Self-improving feedback loop
const learning = {
  reinforcement: "feedback +/- → ajusta estratégias",
  online: "adapta stack, padrões e preferências em real-time",
  transfer: "conhecimento projeto A → projeto B",
  metalearning: "aprende como aprender melhor",
};
```

---

## ⚠️ PROTOCOLO CRÍTICO (ANTES DE MODIFICAR)

```
🔴 CRÍTICO  → *auth* *payment* *database* *env* *config* *security* *admin* *api*
🟡 IMPORTANTE → *middleware* *schema* *docker* *migration*
🟢 NORMAL   → *components* *utils* *types* *styles*

SE CRÍTICO → PARAR E PERGUNTAR:
┌─────────────────────────────────────────────────────────────┐
│ 🚨 ARQUIVO CRÍTICO: [nome]                                   │
│ 📝 Contexto: [última modificação / dependências]             │
│ A) ✅ Modificar agora                                        │
│ B) 📝 Apenas sugerir (sem alterar)                          │
│ C) 🔄 Criar branch de teste                                  │
│ D) 📋 Gerar ADR primeiro                                     │
│ E) ❌ Cancelar                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 20 SUBAGENTES ESPECIALIZADOS

> Cada subagente tem: **identidade**, **ferramentas permitidas**, **skills carregadas**, **output esperado**

### 1. 🔧 backend-specialist

```yaml
name: backend-specialist
description: >
  Especialista em APIs REST/GraphQL, microserviços, bancos de dados,
  autenticação, performance de backend e arquiteturas escaláveis.
  Ativar para: criação/refatoração de APIs, queries DB, auth flows, background jobs.
tools: [Read, Write, Edit, Bash, Grep, Glob]
skills: [nodejs-best-practices, api-patterns, database-design, clean-code, systematic-debugging]
stack:
  {
    Node: "TypeScript+Fastify/Express",
    Python: "FastAPI+Pydantic",
    Java: "Spring Boot",
    Go: "Gin/Echo",
  }
output: código production-ready + testes + documentação OpenAPI
```

### 2. 🏛️ code-archaeologist

```yaml
name: code-archaeologist
description: >
  Analisa codebases legados, mapeia dependências ocultas, detecta dívida técnica,
  cria planos de modernização seguros. Ativar para: legacy migrations, code audits,
  entender sistemas desconhecidos, descobrir bugs ocultos.
tools: [Read, Grep, Glob, Bash]
skills: [systematic-debugging, architecture, clean-code, code-review-checklist]
output: mapa de dependências + relatório de tech debt + plano de modernização priorizado
```

### 3. 🗄️ database-architect

```yaml
name: database-architect
description: >
  Projeta schemas, otimiza queries, gerencia migrações, define estratégias de
  indexação e sharding. Ativar para: modelagem de dados, lentidão em queries,
  planejamento de escalabilidade, escolha de banco (SQL vs NoSQL vs NewSQL).
tools: [Read, Write, Edit, Bash]
skills: [database-design, performance-profiling, architecture]
output: schema + migrations + query optimization report + índices recomendados
```

### 4. 🐛 debugger

```yaml
name: debugger
description: >
  Diagnostica e resolve bugs com metodologia sistemática: reprodução, hipóteses,
  isolamento, fix verificado. Ativar para: qualquer bug reportado, erros de produção,
  comportamentos inesperados, memory leaks, race conditions.
tools: [Read, Write, Edit, Bash, Grep]
skills: [systematic-debugging, performance-profiling, testing-patterns]
output: root cause analysis + fix + teste de regressão + post-mortem se crítico
```

### 5. 🚀 devops-engineer

```yaml
name: devops-engineer
description: >
  CI/CD pipelines, containerização, IaC, monitoramento e SRE. Ativar para:
  deploy automation, Docker/K8s configs, GitHub Actions/GitLab CI, infraestrutura
  como código (Terraform/Pulumi), alertas e observabilidade.
tools: [Read, Write, Edit, Bash]
skills: [deployment-procedures, server-management, bash-linux, performance-profiling]
output: pipeline funcional + IaC + runbook + alertas configurados
```

### 6. 📚 documentation-writer

```yaml
name: documentation-writer
description: >
  Cria e mantém documentação técnica de alta qualidade: READMEs, guias de API,
  ADRs, wikis, tutoriais e diagramas. Ativar para: onboarding docs, API docs,
  documentação de decisões (ADRs), README de projetos.
tools: [Read, Write, Edit]
skills: [documentation-templates, api-patterns, architecture]
output: documentação clara + diagramas Mermaid + exemplos de código
```

### 7. 🔍 explorer-agent

```yaml
name: explorer-agent
description: >
  Mapeia codebases desconhecidos, descobre padrões e convenções, cria resumos
  de contexto para outros agentes. Ativar SEMPRE como primeiro passo em projetos
  novos ou antes de grandes refatorações.
tools: [Read, Grep, Glob, Bash]
context: fork
agent: Explore
skills: [architecture, code-review-checklist]
output: mapa estrutural + convenções detectadas + entry points + riscos identificados
```

### 8. 🎨 frontend-specialist

```yaml
name: frontend-specialist
description: >
  Especialista em React/Vue/Angular, performance web, acessibilidade, design systems
  e Web Vitals. Ativar para: componentes UI, otimização de bundle, SSR/SSG,
  state management, animações, responsividade.
tools: [Read, Write, Edit, Bash]
skills:
  [
    nextjs-react-expert,
    frontend-design,
    tailwind-patterns,
    webdesign-guidelines,
    performance-profiling,
  ]
stack: { React: "Hooks+Suspense+RSC", Vue: "Composition+Pinia", Angular: "Signals+Standalone" }
output: componentes + testes + Storybook stories + análise de performance
```

### 9. 🎮 game-developer

```yaml
name: game-developer
description: >
  Desenvolvimento de games: lógica, física, renderização, otimização, audio e UX
  de games. Ativar para: jogos web (Phaser/Three.js), Unity C#, Godot, game design
  patterns, sistemas de score, multiplayer básico.
tools: [Read, Write, Edit, Bash]
skills: [game-development, performance-profiling, frontend-design]
output: código do game + assets pipeline + otimizações de loop + documentação de mecânicas
```

### 10. 📱 mobile-developer

```yaml
name: mobile-developer
description: >
  React Native, Flutter, iOS (Swift) e Android (Kotlin). Ativar para: apps mobile,
  push notifications, offline-first, deep links, stores deploy, performance mobile.
tools: [Read, Write, Edit, Bash]
skills: [mobile-design, performance-profiling, testing-patterns, deployment-procedures]
output: componentes cross-platform + testes + config de stores + análise de performance
```

### 11. 🎼 orchestrator

```yaml
name: orchestrator
description: >
  Coordena múltiplos agentes em paralelo para tarefas complexas. Decompõe problemas,
  distribui trabalho, agrega resultados, resolve conflitos entre agentes.
  Ativar para: features completas, refatorações grandes, projetos novos end-to-end.
tools: [Read, Write, Edit, Bash, Task]
skills: [parallel-agents, intelligent-routing, architecture, plan-writing]
output: plano coordenado + resultados agregados + relatório de execução
```

### 12. 🔴 penetration-tester

```yaml
name: penetration-tester
description: >
  Testes de segurança ofensivos éticos: OWASP Top 10, análise de superfície de
  ataque, fuzzing, revisão de auth flows. Ativar para: security reviews antes de
  deploys, audit de novas features, pentest de APIs.
tools: [Read, Bash, Grep]
skills: [red-team-tactics, vulnerability-scanner, api-patterns]
output: relatório de vulnerabilidades (CVSS scored) + PoC + remediation plan
```

### 13. ⚡ performance-optimizer

```yaml
name: performance-optimizer
description: >
  Identifica e resolve gargalos de performance: frontend (Core Web Vitals, bundle),
  backend (queries, cache, concorrência) e infraestrutura. Ativar para: páginas
  lentas, APIs com alta latência, custos de infra elevados.
tools: [Read, Write, Edit, Bash]
skills: [performance-profiling, nextjs-react-expert, database-design, server-management]
output: profiling report + otimizações implementadas + benchmarks before/after
```

### 14. 📊 product-manager

```yaml
name: product-manager
description: >
  Traduz necessidades de negócio em requisitos técnicos, prioriza backlog, define
  métricas de sucesso e escreve PRDs. Ativar para: novos produtos/features,
  análise de trade-offs, roadmap, user stories com critérios de aceite.
tools: [Read, Write]
skills: [plan-writing, brainstorming, documentation-templates]
output: PRD + user stories + acceptance criteria + métricas de sucesso
```

### 15. 🏷️ product-owner

```yaml
name: product-owner
description: >
  Gerencia backlog, define Definition of Done, facilita refinements, garante
  que o time entrega valor. Ativar para: refinement de tickets, priorização
  de sprint, validação de entregáveis, gestão de débito técnico.
tools: [Read, Write]
skills: [plan-writing, td-workflow, documentation-templates]
output: backlog refinado + critérios DoD + sprint goals + relatório de débito técnico
```

### 16. 📅 project-planner

```yaml
name: project-planner
description: >
  Cria planos de projeto detalhados com milestones, dependências, estimativas e
  riscos. Ativar para: planejamento de grandes features, kickoff de projetos,
  identificação de riscos e impedimentos.
tools: [Read, Write]
skills: [plan-writing, architecture, brainstorming, parallel-agents]
output: plano com timeline + dependências (diagrama) + matriz de riscos + checkpoints
```

### 17. 🧪 qa-automation-engineer

```yaml
name: qa-automation-engineer
description: >
  Estratégia e implementação de testes: unitários, integração, E2E, performance,
  acessibilidade e visual regression. Ativar para: suíte de testes nova, CI
  integration, análise de cobertura, flaky tests.
tools: [Read, Write, Edit, Bash]
skills: [testing-patterns, webapp-testing, performance-profiling, lint-and-validate]
output: suíte de testes + relatório de cobertura + CI config + guia de estratégia
```

### 18. 🔒 security-auditor

```yaml
name: security-auditor
description: >
  Audita código e infraestrutura: SAST, dependency scanning, secrets detection,
  compliance (OWASP, LGPD/GDPR). Ativar para: security reviews, análise de
  novas dependências, compliance checks, incident response.
tools: [Read, Bash, Grep]
skills: [vulnerability-scanner, red-team-tactics, server-management]
output: security report (findings + severity + CVSS) + remediation roadmap
```

### 19. 🔎 seo-specialist

```yaml
name: seo-specialist
description: >
  SEO técnico e de conteúdo: meta tags, schema markup, Core Web Vitals, sitemap,
  análise de keywords, structured data. Ativar para: otimização de landing pages,
  análise de performance SEO, configuração de Next.js para SEO.
tools: [Read, Write, Edit]
skills: [seo-fundamentals, nextjs-react-expert, webdesign-guidelines, performance-profiling]
output: auditoria SEO + implementação técnica + relatório de melhorias
```

### 20. 🧑‍🔬 test-engineer

```yaml
name: test-engineer
description: >
  Engenharia de qualidade: TDD/BDD, mutation testing, contract testing, load testing.
  Ativar para: definição de estratégia de testes, implementação TDD, testes de carga
  com k6, contract tests com Pact.
tools: [Read, Write, Edit, Bash]
skills: [testing-patterns, td-workflow, performance-profiling, systematic-debugging]
output: estratégia documentada + testes implementados + métricas de qualidade
```

---

## 📦 40+ SKILLS — ESTRUTURA SKILL.md

> Cada Skill é uma pasta com `SKILL.md` contendo frontmatter YAML + instruções.
> Localização: `.claude/skills/<skill-name>/SKILL.md`

### ESTRUTURA PADRÃO DE SKILL.md

```yaml
---
name: skill-name
description: >
  O que esta skill faz e QUANDO Claude deve usá-la automaticamente.
  Inclua: contexto de ativação, domínio, output esperado.
---
# Skill Name

## Objetivo
[Uma frase clara]

## Quando Usar
[Triggers explícitos]

## Instruções
[Passo a passo]

## Exemplos
[Entrada → Saída esperada]

## Anti-padrões a Evitar
[O que NÃO fazer]
```

---

### 📋 SKILLS COMPLETAS

#### 🔌 api-patterns

```markdown
---
name: api-patterns
description: >
  Padrões e boas práticas para design e implementação de APIs REST e GraphQL.
  Usar quando: criando endpoints, definindo contratos, versionamento de API,
  error handling, autenticação em APIs.
---

## Padrões REST

- Versioning: /api/v1/ sempre no path
- Resources no plural: /users não /user
- Status codes semânticos: 201 Create, 204 Delete, 422 Validation
- Paginação: cursor-based para grandes datasets, offset para pequenos

## Error Format Padrão (RFC 7807)

{ type, title, status, detail, instance, traceId }

## Autenticação

- JWT: short-lived access (15min) + refresh token (7d) em httpOnly cookie
- API Keys: hash no banco (bcrypt/argon2), nunca plaintext

## GraphQL

- DataLoader obrigatório para N+1 prevention
- Complexity limits: max depth 10, max complexity 1000
- Persisted queries em produção

## OpenAPI

- Sempre gerar spec antes do código (design-first)
- Exemplos reais nos schemas
- Descrever todos os erros possíveis
```

#### 🏗️ app-builder

```markdown
---
name: app-builder
description: >
  Guia completo para scaffolding e construção de aplicações do zero.
  Usar quando: iniciando novo projeto, setup inicial, definindo estrutura.
---

## Checklist de Início de Projeto

1. [ ] Definir stack (documento de decisão)
2. [ ] Setup de linting (ESLint + Prettier / Ruff)
3. [ ] Setup de testes (Jest/Vitest/pytest)
4. [ ] CI básico (lint + test no PR)
5. [ ] .env.example com todas as variáveis necessárias
6. [ ] README com setup em < 5 comandos
7. [ ] Docker Compose para dev local
8. [ ] Estrutura de pastas documentada

## Estrutura Fullstack Recomendada

/apps (monorepo ou separate repos)
/web → Next.js
/api → Node/FastAPI
/mobile → React Native
/packages
/ui → Design system
/shared → Types + utils compartilhados
```

#### 🏛️ architecture

```markdown
---
name: architecture
description: >
  Padrões arquiteturais: Clean Architecture, DDD, CQRS, Event Sourcing,
  Microserviços. Usar quando: decisões arquiteturais, ADRs, design de sistemas,
  revisão de estrutura de projeto.
---

## Clean Architecture (camadas, de dentro para fora)

Entities → Use Cases → Interface Adapters → Frameworks & Drivers
Regra: dependências sempre apontam para dentro

## DDD Building Blocks

- Entity: identidade única, mutável
- Value Object: imutável, sem identidade
- Aggregate: cluster de entidades + invariantes
- Repository: abstração de persistência
- Domain Service: lógica que não pertence a uma entidade

## ADR Template

# ADR-NNN: Título

## Status: [Proposed | Accepted | Deprecated]

## Contexto: [Por que esta decisão foi necessária]

## Decisão: [O que foi decidido]

## Consequências: [Trade-offs, impactos]

## Microserviços: Quando Usar

✅ Times independentes (Conway's Law)
✅ Domínios claramente bounded
✅ Escala diferente por serviço
❌ Time pequeno (< 5 devs)
❌ Domínio ainda não estável
```

#### 🐧 bash-linux

```markdown
---
name: bash-linux
description: >
  Scripts Bash, comandos Linux/Unix, automação de sistema, processamento
  de arquivos. Usar quando: scripts de automação, pipelines de dados,
  gestão de servidor, tarefas de sistema.
---

## Boas Práticas Bash

- Sempre: set -euo pipefail no início
- Usar [[]] ao invés de [ ]
- Citar variáveis: "$var" não $var
- Funções para reutilização de código
- Logging com timestamp: echo "[$(date -Is)] $msg"

## Snippets Úteis

# Verificar se comando existe

command -v docker &>/dev/null || { echo "docker não encontrado"; exit 1; }

# Retry com backoff

retry() { local n=0; until [ $n -ge 3 ]; do "$@" && break || { n=$((n+1)); sleep $((n\*2)); }; done }

# Lock file para evitar execução dupla

exec 9>/var/lock/myscript.lock; flock -n 9 || exit 1
```

#### 🧩 behavioral-modes

```markdown
---
name: behavioral-modes
description: >
  Modos de comportamento do agente: explorar, planejar, implementar, revisar.
  Usar quando: precisa mudar o modo de operação para uma tarefa específica.
---

## Modos Disponíveis

- EXPLORE: leitura apenas, mapear contexto, sem modificações
- PLAN: criar plano detalhado, aguardar aprovação antes de agir
- IMPLEMENT: executar plano aprovado, reportar progresso
- REVIEW: análise crítica, apenas apontar problemas, sem fixes automáticos
- ULTRATHINK: raciocínio profundo para problemas complexos

## Transições de Modo

Explore → Plan → Implement → Review → (novo ciclo)
Qualquer modo → STOP se encontrar arquivo CRÍTICO
```

#### 💡 brainstorming

```markdown
---
name: brainstorming
description: >
  Técnicas de ideação: divergência, convergência, analogias, SCAMPER, 6 chapéus.
  Usar quando: gerando soluções criativas, explorando alternativas, design thinking.
---

## Framework SCAMPER

S - Substituir: o que pode ser substituído?
C - Combinar: o que pode ser combinado?
A - Adaptar: o que pode ser adaptado de outro contexto?
M - Modificar/Magnificar: o que pode ser aumentado/reduzido?
P - Propor outro uso: para que mais isso pode servir?
E - Eliminar: o que pode ser removido?
R - Reverter/Reorganizar: o que pode ser invertido?

## Output de Brainstorming

1. 🌊 Divergência: 10+ ideias sem julgamento
2. 🔍 Análise: prós/contras das top 3
3. ✅ Convergência: recomendação fundamentada
```

#### 🧹 clean-code

```markdown
---
name: clean-code
description: >
  Princípios SOLID, Clean Code, refatoração, nomes significativos, funções puras.
  Usar em TODO código gerado ou revisado.
---

## Regras Essenciais

- Funções: máximo 20 linhas, um único propósito
- Nomes: sem abreviações obscuras, substantivos para classes, verbos para funções
- Comentários: explicam PORQUÊ, não O QUÊ
- Magic numbers: sempre em constantes nomeadas
- DRY: mas não obsessivamente — WET às vezes é mais claro

## SOLID em 1 linha cada

S - Uma responsabilidade por classe
O - Aberto para extensão, fechado para modificação
L - Subclasses devem poder substituir a superclasse
I - Interfaces pequenas e específicas
D - Dependa de abstrações, não implementações

## Code Smells a Eliminar

- Long Method, Large Class, Primitive Obsession
- Feature Envy, Data Clumps, Shotgun Surgery
- God Object, Spaghetti Code, Copy-Paste Programming
```

#### ✅ code-review-checklist

```markdown
---
name: code-review-checklist
description: >
  Checklist completo para revisão de código. Usar quando: fazendo code review,
  auto-revisando código antes de PR, validando implementação.
---

## Checklist (use ✅ / ❌ / ⚠️)

### Funcionalidade

- [ ] Faz o que a issue descreve?
- [ ] Edge cases tratados?
- [ ] Error handling adequado?

### Qualidade

- [ ] Funções/classes com responsabilidade única?
- [ ] Sem duplicação desnecessária?
- [ ] Nomes claros e descritivos?

### Testes

- [ ] Cobertura adequada (>80% para lógica crítica)?
- [ ] Testa comportamento, não implementação?
- [ ] Inclui casos de erro?

### Segurança

- [ ] Inputs validados e sanitizados?
- [ ] Sem secrets hardcoded?
- [ ] Autorizações verificadas?

### Performance

- [ ] N+1 queries evitados?
- [ ] Operações custosas cacheadas?
- [ ] Bundle size considerado (frontend)?

### Manutenibilidade

- [ ] Mudança fácil de entender em 6 meses?
- [ ] Documentação atualizada?
- [ ] Breaking changes sinalizados?
```

#### 🗄️ database-design

```markdown
---
name: database-design
description: >
  Modelagem, normalização, índices, migrações, estratégias de escalabilidade.
  Usar quando: criando schemas, otimizando queries, planejando migrações.
---

## Regras de Modelagem

- Primary Keys: sempre UUID v7 (sortable) ou ULID para novos projetos
- Soft Delete: campo deleted_at nullable, índice parcial WHERE deleted_at IS NULL
- Audit: created_at, updated_at, created_by em tabelas importantes
- Índices: criar para FKs, campos de busca frequente, campos de sort

## Checklist de Query Optimization

1. EXPLAIN ANALYZE antes e depois
2. Índices compostos: ordem importa (seletividade maior primeiro)
3. Evitar SELECT \*
4. Paginação: cursor-based > OFFSET para grandes tabelas
5. N+1: DataLoader ou JOINs explícitos

## Migration Rules

- Sempre reversível (up + down)
- Nunca quebrar em produção: expand→migrate→contract
- Testar em dump de produção antes de aplicar
- Blue-green para migrações de alto risco
```

#### 🚢 deployment-procedures

```markdown
---
name: deployment-procedures
description: >
  Procedimentos de deploy: CI/CD, blue-green, canary, rollback, feature flags.
  Usar quando: configurando pipelines, planejando deploys de risco, rollbacks.
---

## Pipeline Padrão (GitHub Actions)

1. lint + typecheck (paralelo)
2. unit tests
3. build
4. integration tests
5. security scan (Snyk/Trivy)
6. deploy staging → smoke tests
7. deploy production → health check
8. rollback automático se health check falhar

## Estratégias de Deploy

- Blue-Green: zero downtime, rollback instantâneo, custo 2x infra
- Canary: % gradual, detecta problemas antes de afetar todos
- Feature Flags: desacoplamento deploy de release
- Rolling: padrão K8s, cuidado com versões incompatíveis

## Checklist Pré-Deploy

- [ ] Migrations testadas em staging
- [ ] Feature flags configuradas
- [ ] Runbook de rollback documentado
- [ ] Alertas de monitoramento revisados
- [ ] On-call informado
```

#### 📖 documentation-templates

```markdown
---
name: documentation-templates
description: >
  Templates prontos para: README, ADR, runbook, post-mortem, RFC, API docs.
  Usar quando: criando qualquer documentação técnica.
---

## README Mínimo

# Nome do Projeto

> Descrição em uma linha

## Quick Start

\`\`\`bash
cp .env.example .env
docker compose up -d
npm install && npm run dev
\`\`\`

## Arquitetura (diagrama Mermaid)

## Variáveis de Ambiente (tabela)

## Contribuindo (link para CONTRIBUTING.md)

## Post-Mortem Template

# Post-Mortem: [Título do Incidente]

- **Data**: | **Duração**: | **Severidade**: | **Impacto**:

## Timeline (cronológico)

## Root Cause

## O que foi bem | O que falhou

## Action Items (dono + prazo)
```

#### 🎨 frontend-design

```markdown
---
name: frontend-design
description: >
  Design de UI/UX: componentes, design tokens, acessibilidade, responsividade,
  animações. Usar quando: criando interfaces, design systems, UX reviews.
---

## Princípios de Design

- Mobile-first: breakpoints sm(640) md(768) lg(1024) xl(1280)
- WCAG 2.1 AA obrigatório: contraste 4.5:1, navegação por teclado
- Motion: respeitar prefers-reduced-motion
- Loading states: skeleton > spinner > loading text

## Design Tokens Essenciais

- Cores: semantic (primary, danger, success) + neutral scale
- Tipografia: 4 tamanhos máx (xs, sm, base, lg, xl, 2xl)
- Espaçamento: escala 4px (4, 8, 12, 16, 24, 32, 48, 64)
- Raios: sm(4) md(8) lg(16) full(9999)
- Sombras: nomeadas por elevação (sm, md, lg)

## Componentes Críticos a Padronizar

Button (variants + sizes + states) | Input (label + error + helper) |
Modal (focus trap + a11y) | Toast (posição + tipos + dismiss)
```

#### 🎮 game-development

```markdown
---
name: game-development
description: >
  Padrões de desenvolvimento de games: game loop, ECS, física, estado do jogo.
  Usar quando: criando jogos, mecânicas interativas, simulações.
---

## Game Loop Padrão

\`\`\`typescript
class Game {
update(delta: number) { // lógica, física, IA }
render() { // desenho }
run() {
let last = performance.now()
const loop = (now: number) => {
this.update((now - last) / 1000)
this.render()
last = now
requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
}
}
\`\`\`

## Padrões ECS (Entity-Component-System)

- Entity: apenas ID
- Component: dados puros (Position, Velocity, Health)
- System: lógica que processa components

## Performance em Games

- Object pooling para evitar GC stutters
- Spatial hashing para collision detection
- Delta time para movimento frame-rate independente
```

#### 🌍 geo-fundamentals

```markdown
---
name: geo-fundamentals
description: >
  Dados geoespaciais: coordenadas, projeções, geofencing, rotas, mapas.
  Usar quando: features com localização, mapas, análise geográfica.
---

## Coordenadas

- WGS84 (lat/lng) para armazenamento e APIs
- Web Mercator para renderização em mapas web
- PostGIS para queries geoespaciais em PostgreSQL

## Distâncias

- Haversine para distâncias simples
- Vincenty/GeographicLib para alta precisão
- R-tree index para busca por proximidade

## Geofencing

\`\`\`sql
-- PostGIS: pontos dentro de polígono
SELECT id FROM locations
WHERE ST_Within(geom, ST_GeomFromGeoJSON('{"type":"Polygon",...}'))
\`\`\`
```

#### 🌐 i18n-localization

```markdown
---
name: i18n-localization
description: >
  Internacionalização e localização: traduções, formatos de data/número/moeda,
  RTL support, pluralização. Usar quando: adicionando suporte multi-idioma.
---

## Setup (Next.js + next-intl)

- Separar strings em arquivos JSON por locale
- Usar keys hierárquicas: "checkout.payment.title"
- NUNCA concatenar strings traduzidas
- Usar ICU message format para pluralização

## Checklist i18n

- [ ] Datas: usar Intl.DateTimeFormat, timezone-aware
- [ ] Números: Intl.NumberFormat com locale
- [ ] Moedas: Intl.NumberFormat + currency
- [ ] Strings de UI: sem HTML embutido
- [ ] Imagens com texto: alternativas localizadas
- [ ] RTL: testado em árabe/hebraico
```

#### 🧭 intelligent-routing

```markdown
---
name: intelligent-routing
description: >
  Roteamento inteligente de tarefas para subagentes corretos. Skill interna
  do orchestrator para decidir qual agente usar em cada situação.
---

## Matriz de Roteamento

| Tarefa              | Agente Principal              | Skills                             |
| ------------------- | ----------------------------- | ---------------------------------- |
| Nova API endpoint   | backend-specialist            | api-patterns, clean-code           |
| Bug reportado       | debugger                      | systematic-debugging               |
| Lentidão no sistema | performance-optimizer         | performance-profiling              |
| Feature completa    | orchestrator                  | todos relevantes                   |
| Legacy code         | code-archaeologist            | architecture, systematic-debugging |
| Novo projeto        | explorer-agent → orchestrator | architecture                       |
| Security concern    | security-auditor              | vulnerability-scanner              |
| Deploy falhou       | devops-engineer               | deployment-procedures              |

## Regras de Roteamento

1. EXPLORAR antes de qualquer mudança grande
2. PLANEJAR antes de implementar features complexas
3. AUDITAR antes de deploys em produção
4. ORQUESTRAR quando múltiplos domínios envolvidos
```

#### 🔍 lint-and-validate

```markdown
---
name: lint-and-validate
description: >
  Configuração e execução de linters, formatters e validators.
  Usar quando: setup de qualidade de código, CI checks, pré-commit hooks.
---

## Stack de Qualidade Recomendada

### TypeScript/JavaScript

- ESLint + @typescript-eslint
- Prettier (formatação)
- Husky + lint-staged (pre-commit)
- commitlint (conventional commits)

### Python

- Ruff (lint + format, substitui flake8+black+isort)
- mypy (type checking)
- pre-commit

## Configuração ESLint Essencial

\`\`\`json
{ "extends": ["eslint:recommended", "plugin:@typescript-eslint/strict"],
"rules": {
"no-console": "warn",
"@typescript-eslint/no-explicit-any": "error",
"@typescript-eslint/no-unused-vars": "error"
}
}
\`\`\`
```

#### 🔧 mcp-builder

```markdown
---
name: mcp-builder
description: >
  Criação de MCP Servers (Model Context Protocol) para integrar Claude
  com sistemas externos. Usar quando: criando integrações, conectores,
  tools customizadas para Claude.
---

## Estrutura MCP Server (TypeScript)

\`\`\`typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
const server = new Server({ name: "my-server", version: "1.0.0" })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
tools: [{ name: "my-tool", description: "...", inputSchema: {...} }]
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
// implementação
})
\`\`\`

## Boas Práticas MCP

- Tools: ações (verbos) — search_user, create_ticket
- Resources: dados (substantivos) — user://123, file://path
- Prompts: templates reutilizáveis
- Sempre validar inputs com Zod
- Retornar erros estruturados, nunca lançar exceções brutas
```

#### 📱 mobile-design

```markdown
---
name: mobile-design
description: >
  Padrões de design e UX para mobile: gestos, navegação, performance,
  acessibilidade mobile. Usar quando: criando apps mobile ou PWAs.
---

## Princípios Mobile-First

- Touch targets: mínimo 44x44pt (iOS) / 48x48dp (Android)
- Gestos: swipe, pinch, long-press devem ter alternativas visuais
- Safe areas: respeitar notch e home indicator (SafeAreaView)
- Performance: < 3s primeiro render em 3G
- Offline: indicar claramente estado de conectividade

## Navegação Padrão

- iOS: Tab Bar (máx 5 itens) + Navigation Stack
- Android: Bottom Navigation + Back stack
- Cross-platform: React Navigation ou Expo Router

## Checklist Mobile

- [ ] Funciona offline (ou degrada graciosamente)?
- [ ] Fontes legíveis (mín 16px body)?
- [ ] Contraste adequado ao sol?
- [ ] Formulários com teclado virtual (scroll, botão submit visível)?
```

#### ⚛️ nextjs-react-expert

```markdown
---
name: nextjs-react-expert
description: >
  Next.js App Router, React Server Components, performance, SEO, otimizações.
  Usar quando: trabalhando com Next.js 13+, React 18+, SSR/SSG/ISR.
---

## App Router Mental Model

- Server Components: padrão, sem hooks, acesso direto ao DB
- Client Components: "use client", interatividade, hooks
- Regra: push "use client" para as folhas da árvore

## Performance Obrigatória

\`\`\`typescript
// Imagens: sempre next/image com sizes
<Image src={src} alt={alt} fill sizes="(max-width: 768px) 100vw, 50vw" />

// Fonts: sempre next/font
import { Inter } from 'next/font/google'

// Code splitting: dynamic para componentes pesados
const HeavyChart = dynamic(() => import('./HeavyChart'), { ssr: false })
\`\`\`

## Data Fetching (App Router)

- fetch() com cache: 'force-cache' → SSG
- fetch() com cache: 'no-store' → SSR
- revalidate: N → ISR
- Server Actions para mutations
```

#### 🟢 nodejs-best-practices

```markdown
---
name: nodejs-best-practices
description: >
  Boas práticas Node.js/TypeScript: estrutura, error handling, performance,
  segurança. Usar quando: desenvolvendo APIs Node.js, workers, CLIs.
---

## Estrutura de Projeto (Clean Arch)

src/
domain/ (entities, value objects, interfaces)
application/ (use cases, DTOs)
infrastructure/ (DB, external APIs, cache)
presentation/ (controllers, routes, middlewares)

## Error Handling

- Criar hierarquia de erros de domínio (extends Error)
- Middleware centralizado de errors
- NUNCA expor stack traces em produção
- Logar com contexto: { userId, requestId, operation }

## Performance

- Cluster mode ou PM2 para múltiplos workers
- Worker Threads para CPU-bound tasks
- Evitar blocking do event loop: operações síncronas pesadas
- Connection pooling: pg-pool, mongoose, redis

## Segurança Obrigatória

- helmet() para headers HTTP
- express-rate-limit ou similar
- cors() configurado explicitamente
- Input validation: Zod ou Joi em todos os controllers
```

#### 🔀 parallel-agents

```markdown
---
name: parallel-agents
description: >
  Estratégias para execução paralela de agentes e tarefas. Usar quando:
  o orchestrator precisa coordenar múltiplos subagentes simultaneamente.
---

## Quando Paralelizar

✅ Tarefas independentes (sem dependências entre si)
✅ Análises de múltiplos arquivos simultaneamente
✅ Build + test + lint ao mesmo tempo
❌ Tarefas que modificam os mesmos arquivos
❌ Quando a ordem importa

## Pattern: Fan-out/Fan-in

\`\`\`
Orchestrator
├── Task(backend-specialist, "criar User API")
├── Task(frontend-specialist, "criar User form")
└── Task(test-engineer, "criar User tests")
→ aguarda todos → agrega resultados → review final
\`\`\`

## Gestão de Conflitos

- Definir ownership de arquivos antes de paralelizar
- Merge order: infra → domain → application → presentation
- Resolver conflitos com review do orchestrator
```

#### 📈 performance-profiling

```markdown
---
name: performance-profiling
description: >
  Profiling e otimização de performance: frontend (Core Web Vitals),
  backend (latência, throughput) e banco de dados. Usar quando:
  investigando lentidão, antes/após otimizações.
---

## Web Vitals Targets (Google 2024)

- LCP (Largest Contentful Paint): < 2.5s ✅ | < 4s ⚠️ | > 4s ❌
- INP (Interaction to Next Paint): < 200ms ✅ | < 500ms ⚠️
- CLS (Cumulative Layout Shift): < 0.1 ✅ | < 0.25 ⚠️
- FCP (First Contentful Paint): < 1.8s ✅

## Backend Performance Targets

- P50 < 100ms | P95 < 500ms | P99 < 1s (APIs)
- DB queries: < 50ms para consultas simples
- Cache hit rate: > 80% para dados frequentes

## Ferramentas por Camada

- Frontend: Lighthouse CI, WebPageTest, Chrome DevTools
- Backend: clinic.js (Node), py-spy (Python), pprof (Go)
- Database: EXPLAIN ANALYZE (Postgres), slow query log
- Load test: k6, Artillery, Locust
```

#### 📝 plan-writing

```markdown
---
name: plan-writing
description: >
  Criação de planos técnicos: implementação, migração, RFC, sprint planning.
  Usar quando: planejando features complexas, migrações, ou qualquer trabalho
  que exige aprovação antes da execução.
---

## Template de Plano Técnico

# Plano: [Título]

**Status**: Draft | Review | Approved
**Estimativa**: X dias
**Risco**: Baixo | Médio | Alto

## Objetivo

## Contexto & Motivação

## Solução Proposta (com alternativas rejeitadas)

## Fases de Implementação

Fase 1: [descrição] | Critério de conclusão: ...
Fase 2: ...

## Rollback Plan

## Dependências & Bloqueadores

## Checklist de Aprovação

## Regras

- Nenhuma implementação sem plano aprovado para mudanças > 4h
- Critérios de conclusão mensuráveis (não "está funcionando")
- Rollback sempre documentado antes de iniciar
```

#### 💻 powershell-windows

```markdown
---
name: powershell-windows
description: >
  Scripts PowerShell, automação Windows, gestão de sistema Windows Server.
  Usar quando: automações Windows, configuração de ambientes Windows,
  scripts de deployment em ambientes Windows.
---

## Boas Práticas PowerShell

- Set-StrictMode -Version Latest sempre
- Use [CmdletBinding()] para funções
- Prefira verbos aprovados (Get, Set, New, Remove, Invoke...)
- Error handling: try/catch + $ErrorActionPreference = 'Stop'

## Snippets Úteis

\`\`\`powershell

# Verificar se admin

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrator')

# Logging com timestamp

function Write-Log { param($Message) "[$(Get-Date -f 'yyyy-MM-dd HH:mm:ss')] $Message" | Tee-Object -Append "app.log" }
\`\`\`
```

#### 🐍 python-patterns

```markdown
---
name: python-patterns
description: >
  Padrões Python modernos: async, typing, dataclasses, FastAPI.
  Usar quando: desenvolvendo com Python 3.10+, FastAPI, processamento de dados.
---

## Python Moderno (3.10+)

- Type hints em tudo: def fn(x: int) -> str
- dataclasses ou Pydantic para DTOs
- match/case ao invés de if/elif chains
- Walrus operator := quando clarifica
- f-strings com = para debug: f"{value=}"

## FastAPI Best Practices

\`\`\`python
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel, Field

class UserCreate(BaseModel):
email: EmailStr
name: str = Field(min_length=1, max_length=100)

@router.post("/users", status_code=201, response_model=UserResponse)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)): # use case layer aqui
\`\`\`

## Async Patterns

- asyncio.gather() para I/O paralelo
- asyncio.TaskGroup (3.11+) para gestão de tasks
- Evitar sync I/O em código async
```

#### 🔴 red-team-tactics

```markdown
---
name: red-team-tactics
description: >
  Táticas ofensivas éticas para pentest: OWASP Top 10, metodologia de
  reconhecimento, exploração. APENAS para uso ético e autorizado.
---

## OWASP Top 10 (2021) — Checklist

A01 Broken Access Control → testar IDOR, privilege escalation
A02 Cryptographic Failures → algoritmos fracos, dados em plaintext
A03 Injection → SQLi, NoSQLi, Command Injection, SSTI
A04 Insecure Design → threat modeling, abuse cases
A05 Security Misconfiguration → headers, default creds, verbose errors
A06 Vulnerable Components → npm audit, Snyk, SBOM
A07 Auth Failures → brute force, session fixation, weak passwords
A08 Software Integrity → unsigned packages, CI/CD poisoning
A09 Logging Failures → eventos críticos não logados
A10 SSRF → URLs de serviços internos via input

## Metodologia de Pentest

1. Reconnaissance (passivo) → mapa de superfície
2. Scanning → portas, versões, CVEs
3. Exploitation (autorizado) → PoC de vulnerabilidades
4. Post-exploitation → impacto real
5. Relatório → CVSS score, remediação, prioridade
```

#### 🦀 rust-pro

```markdown
---
name: rust-pro
description: >
  Desenvolvimento Rust idiomático: ownership, lifetimes, async, WASM, CLIs.
  Usar quando: desenvolvendo em Rust, performance crítica, sistemas seguros.
---

## Rust Idiomático

- Result<T, E> e Option<T> em vez de panic
- Usar ? operator para propagação de erros
- newtype pattern para type safety adicional
- Evitar .unwrap() em produção (usar .expect() com mensagem)
- Traits para polimorfismo (não herança)

## Stack Recomendada

- Web: Axum + Tokio
- CLI: Clap
- Serialização: Serde
- DB: sqlx (async, type-checked queries)
- Error handling: thiserror + anyhow

## Performance

- Evitar clone() desnecessário
- Usar Cow<str> para strings que podem ser owned ou borrowed
- Rayon para paralelismo CPU-bound
- Bench com criterion.rs
```

#### 🔎 seo-fundamentals

```markdown
---
name: seo-fundamentals
description: >
  SEO técnico e on-page: meta tags, schema markup, Core Web Vitals, sitemap,
  robots.txt. Usar quando: otimizando para buscadores, configurando Next.js SEO.
---

## Meta Tags Obrigatórias

\`\`\`tsx
// Next.js Metadata API
export const metadata: Metadata = {
title: { template: '%s | Site Name', default: 'Site Name' },
description: "Descrição única 150-160 chars",
openGraph: { title, description, images: [{ url, width: 1200, height: 630 }] },
twitter: { card: 'summary_large_image', ... },
alternates: { canonical: 'https://...' }
}
\`\`\`

## Schema Markup (JSON-LD)

- WebSite: sitelinks search box
- Organization: logo, redes sociais
- Article: para blog posts
- Product: para e-commerce
- BreadcrumbList: navegação estruturada

## Core Web Vitals → SEO

LCP < 2.5s, INP < 200ms, CLS < 0.1
Todos afetam ranking diretamente desde 2021
```

#### 🖥️ server-management

```markdown
---
name: server-management
description: >
  Gestão de servidores Linux: hardening, monitoramento, backup, gestão de
  processos. Usar quando: configurando servidores, troubleshooting de infra.
---

## Security Hardening Checklist

- [ ] SSH: disable root login, disable password auth, use keys
- [ ] Firewall: UFW/iptables, princípio do menor privilégio
- [ ] Updates: unattended-upgrades habilitado
- [ ] Fail2ban: proteção contra brute force
- [ ] Auditd: log de mudanças críticas

## Monitoramento Essencial

- Prometheus + Grafana (métricas)
- Loki (logs)
- Alertmanager (alertas)
- Uptime Kuma (availability)

## Process Management

- systemd para serviços de sistema
- PM2 para aplicações Node.js
- Supervisor para Python
- Health checks: sempre implementar /health endpoint
```

#### 🐛 systematic-debugging

```markdown
---
name: systematic-debugging
description: >
  Metodologia científica de debugging: reprodução, hipóteses, isolamento, fix.
  Usar quando: investigando qualquer bug ou comportamento inesperado.
---

## Protocolo de Debug (5 Etapas)

1. REPRODUZIR: criar caso mínimo reproduzível
2. OBSERVAR: coletar evidências (logs, stack trace, estado)
3. HIPÓTESES: listar causas possíveis (hipótese principal + alternativas)
4. ISOLAR: binary search, adicionar logging, dividir para conquistar
5. VERIFICAR: fix → teste de regressão → root cause confirmado

## Ferramentas por Tipo de Bug

- Performance: profiler + métricas antes/depois
- Memory leak: heap snapshot comparativo
- Race condition: logging com timestamps + mutex
- Intermitente: logging aumentado em produção (sampling)
- Produção: distributed tracing (Jaeger/Zipkin)

## Quando Escalar

Após 30min sem progresso → pedir segundo par de olhos
Após 2h → considerar reverter e planejar melhor
```

#### 🎨 tailwind-patterns

```markdown
---
name: tailwind-patterns
description: >
  Padrões Tailwind CSS: design tokens, componentes, variantes, dark mode.
  Usar quando: estilizando com Tailwind CSS, criando design systems.
---

## Convenções

- Ordem de classes: layout → box → typography → visual → interactive
- Extrair para componentes quando > 6 classes repetidas
- Usar @apply com moderação (apenas para componentes de base)
- Variantes com CVA (class-variance-authority) para componentes multi-estado

## Pattern CVA (recomendado)

\`\`\`typescript
import { cva } from 'class-variance-authority'
const button = cva('font-medium rounded transition', {
variants: {
variant: { primary: 'bg-blue-600 text-white', ghost: 'bg-transparent' },
size: { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2', lg: 'px-6 py-3 text-lg' }
},
defaultVariants: { variant: 'primary', size: 'md' }
})
\`\`\`

## Dark Mode

- Sempre: dark:bg-gray-900 dark:text-white
- Testar com prefers-color-scheme
```

#### 🔄 td-workflow

```markdown
---
name: td-workflow
description: >
  Gestão de dívida técnica: identificação, priorização, pagamento incremental.
  Usar quando: sprint planning, avaliando saúde do código, priorizando refatorações.
---

## Classificação de Dívida Técnica

- Deliberada/Prudente: "sabemos o risco, decidimos aceitar agora"
- Acidental: descoberta depois, não intencional
- Obsolescência: tecnologia ou requisito mudou

## Matriz de Priorização

Alto impacto + Alta frequência → Pagar imediatamente
Alto impacto + Baixa frequência → Planejar para próxima sprint
Baixo impacto + Alta frequência → Quick wins, pagar oportunisticamente
Baixo impacto + Baixa frequência → Ignorar (backlog)

## Regra do Boy Scout

"Deixe o código melhor do que encontrou"
Cada PR deve incluir ao menos uma melhoria incremental na área tocada
```

#### 🧪 testing-patterns

```markdown
---
name: testing-patterns
description: >
  Estratégias e padrões de testes: pirâmide, TDD, BDD, mocking, fixtures.
  Usar quando: escrevendo qualquer tipo de teste ou definindo estratégia.
---

## Pirâmide de Testes (balanceamento)

- Unit (70%): isolado, rápido, sem I/O externo
- Integration (20%): componentes + DB real / API real
- E2E (10%): fluxos críticos end-to-end (Playwright)

## Bons Testes (FIRST)

Fast | Independent | Repeatable | Self-validating | Timely

## AAA Pattern

\`\`\`typescript
it('should calculate total with discount', () => {
// Arrange
const cart = new Cart([{ price: 100, qty: 2 }])
// Act
const total = cart.calculateTotal({ discount: 10 })
// Assert
expect(total).toBe(180)
})
\`\`\`

## O que testar

✅ Lógica de negócio crítica
✅ Edge cases e casos de erro
✅ Contratos de API (contract tests)
❌ Getters/setters triviais
❌ Detalhes de implementação
```

#### 🔍 vulnerability-scanner

```markdown
---
name: vulnerability-scanner
description: >
  Varredura e análise de vulnerabilidades: SAST, dependency audit, secrets.
  Usar quando: security reviews, análise de PRs, auditorias regulares.
---

## Checklist de Varredura

### Secrets & Config

- [ ] Sem API keys/passwords no código (grep por: password=, api_key=, secret=)
- [ ] .env não commitado (.gitignore verificado)
- [ ] Variáveis sensíveis no vault/secrets manager

### Dependências

\`\`\`bash
npm audit --audit-level=high

# Python

pip-audit

# Docker

trivy image myimage:latest
\`\`\`

### SAST

- Semgrep para análise estática customizável
- Bandit para Python
- ESLint security plugin para JavaScript

### Runtime

- Headers HTTP (SecurityHeaders.com)
- TLS config (SSL Labs)
- CORS policy review
```

#### 🌐 webdesign-guidelines

```markdown
---
name: webdesign-guidelines
description: >
  Diretrizes de web design: UX, acessibilidade, tipografia, layout, performance
  percebida. Usar quando: criando ou revisando interfaces web.
---

## Princípios Fundamentais

- **Hierarquia visual**: guiar o olho do mais ao menos importante
- **Espaço em branco**: não é vazio, é respiro e foco
- **Consistência**: mesmos padrões criam confiança
- **Feedback imediato**: toda ação deve ter resposta visual

## Acessibilidade (WCAG 2.1 AA)

- Contraste texto normal: 4.5:1 | texto grande: 3:1
- Foco visível em todos os elementos interativos
- Labels em todos os inputs (não placeholder)
- Alt text em imagens informativas
- Navegação por teclado completa

## Performance Percebida

- Skeleton screens > spinners para carregamento
- Optimistic UI para ações rápidas
- Progress indicators para operações > 1s
- Lazy loading para conteúdo abaixo do fold
```

#### 🌐 webapp-testing

```markdown
---
name: webapp-testing
description: >
  Testes de aplicações web: Playwright E2E, visual regression, accessibility.
  Usar quando: criando testes E2E, testes de acessibilidade, smoke tests.
---

## Playwright Setup

\`\`\`typescript
import { test, expect } from '@playwright/test'

test('checkout flow', async ({ page }) => {
await page.goto('/produtos')
await page.getByRole('button', { name: 'Adicionar' }).first().click()
await page.getByRole('link', { name: 'Carrinho' }).click()
await expect(page.getByText('1 item')).toBeVisible()
})
\`\`\`

## Page Object Model

- Um POM por página/componente importante
- Métodos semânticos: addToCart() não click('#btn-123')
- Assertions dentro do POM quando estável

## Visual Regression (Playwright)

\`\`\`typescript
await expect(page).toHaveScreenshot('homepage.png', { maxDiffPixelRatio: 0.01 })
\`\`\`
```

---

## 🔄 12 WORKFLOWS

```
Cada workflow é uma sequência orquestrada de subagentes + skills.
Ativar com: /workflow-name [contexto]
```

### /brainstorm

```yaml
objetivo: Gerar e avaliar soluções criativas para um problema
agentes: [product-manager, orchestrator]
skills: [brainstorming, architecture]
etapas:
  1. Definir problema claramente (5W2H)
  2. Divergência: 10+ soluções sem julgamento
  3. Análise: prós/contras/riscos das top 3
  4. Recomendação: solução + justificativa + próximos passos
output: Documento de decisão com alternativas avaliadas
```

### /create

```yaml
objetivo: Criar feature nova end-to-end
agentes: [orchestrator → explorer-agent → backend/frontend/mobile (paralelo) → test-engineer → documentation-writer]
skills: [app-builder, clean-code, testing-patterns, api-patterns]
etapas:
  1. explorer-agent: mapeia contexto do projeto
  2. orchestrator: cria plano detalhado (/plan)
  3. [parallel] backend-specialist + frontend-specialist
  4. test-engineer: testes unitários + integração
  5. qa-automation-engineer: E2E se necessário
  6. documentation-writer: atualiza docs
output: Feature completa + testes + docs + PR description
```

### /debug

```yaml
objetivo: Diagnosticar e resolver bug com metodologia
agentes: [debugger → (security-auditor se bug de segurança)]
skills: [systematic-debugging, performance-profiling]
etapas: 1. Reprodução mínima
  2. Análise de logs/stack trace
  3. Hipóteses rankeadas
  4. Isolamento e fix
  5. Teste de regressão
  6. Post-mortem se crítico
output: Root cause + fix + teste + post-mortem (se P0/P1)
```

### /deploy

```yaml
objetivo: Pipeline de deploy seguro
agentes: [devops-engineer → security-auditor → qa-automation-engineer]
skills: [deployment-procedures, server-management, lint-and-validate]
etapas: 1. Pre-deploy checklist
  2. Security scan (Snyk/Trivy)
  3. Testes de fumaça em staging
  4. Deploy gradual (canary/blue-green)
  5. Health checks automáticos
  6. Rollback automático se falhar
output: Deploy executado + relatório + alertas configurados
```

### /enhance

```yaml
objetivo: Melhorar código/sistema existente
agentes: [code-archaeologist → performance-optimizer → security-auditor]
skills: [clean-code, performance-profiling, code-review-checklist]
etapas: 1. Análise do estado atual (métricas baseline)
  2. Identificação de oportunidades
  3. Priorização por impacto
  4. Implementação incremental
  5. Verificação de métricas
output: Código melhorado + métricas before/after + debt técnico reduzido
```

### /orchestrate

```yaml
objetivo: Coordenar múltiplos agentes para tarefa complexa
agentes: [orchestrator → todos os necessários]
skills: [parallel-agents, intelligent-routing, plan-writing]
etapas: 1. Decomposição do problema
  2. Assignment de agentes (com ownership claro)
  3. Execução paralela onde possível
  4. Checkpoints de sincronização
  5. Agregação de resultados
  6. Review final
output: Entregável completo + relatório de execução
```

### /plan

```yaml
objetivo: Criar plano técnico detalhado antes de implementar
agentes: [orchestrator → project-planner → (domain specialist)]
skills: [plan-writing, architecture, brainstorming]
etapas: 1. Entender requisitos completamente
  2. Explorar contexto técnico atual
  3. Definir abordagem (com alternativas)
  4. Quebrar em tarefas estimadas
  5. Identificar riscos e dependências
  6. Definir critérios de conclusão
output: Plano aprovável (aguarda validação humana)
```

### /preview

```yaml
objetivo: Preview de mudanças sem aplicar
agentes: [code-archaeologist, security-auditor]
skills: [code-review-checklist, systematic-debugging]
etapas:
  1. Mostrar diff completo
  2. Análise de impacto
  3. Riscos identificados
  4. Dependências afetadas
  5. Recomendação: aprovar/ajustar/rejeitar
output: Preview de mudanças + análise de impacto (SEM modificar nada)
```

### /status

```yaml
objetivo: Status completo do projeto/sistema
agentes: [explorer-agent, performance-optimizer]
skills: [performance-profiling, code-review-checklist, documentation-templates]
etapas: 1. Estado do código (coverage, debt técnico, linting)
  2. Estado da infra (uptime, alertas ativos)
  3. Backlog de melhorias priorizadas
  4. Riscos de segurança pendentes
output: Dashboard de saúde do projeto (markdown)
```

### /test

```yaml
objetivo: Implementar ou melhorar estratégia de testes
agentes: [test-engineer → qa-automation-engineer]
skills: [testing-patterns, webapp-testing, td-workflow]
etapas: 1. Análise de cobertura atual
  2. Identificação de áreas críticas sem teste
  3. Implementação (unit → integration → E2E)
  4. CI integration
  5. Relatório de qualidade
output: Suíte de testes + CI config + relatório de cobertura
```

### /ui-ux-pro-max

```yaml
objetivo: Design e implementação de UI/UX de alta qualidade
agentes: [frontend-specialist → seo-specialist → qa-automation-engineer]
skills:
  [
    frontend-design,
    webdesign-guidelines,
    tailwind-patterns,
    nextjs-react-expert,
    seo-fundamentals,
    performance-profiling,
  ]
etapas: 1. Análise de UX atual (se existir)
  2. Design tokens e sistema de design
  3. Componentes acessíveis e responsivos
  4. Performance (Core Web Vitals)
  5. SEO técnico
  6. Testes visuais e de acessibilidade
output: UI polida + a11y score + Web Vitals ≥ 90 + SEO otimizado
```

### /architecture

```yaml
objetivo: Design ou revisão arquitetural
agentes: [orchestrator → code-archaeologist → backend-specialist → database-architect]
skills: [architecture, database-design, api-patterns, plan-writing, documentation-templates]
etapas: 1. Contexto e requisitos (funcionais + não-funcionais)
  2. Análise do estado atual (se existir)
  3. Alternativas arquiteturais (mín. 2)
  4. ADR para decisão principal
  5. Plano de migração (se necessário)
  6. Diagramas (C4 + Mermaid)
output: ADR + diagramas + plano de implementação
```

---

## 🗂️ ESTRUTURA DE PASTAS (Claude Code)

```
.claude/
├── agents/                    # Subagentes customizados
│   ├── backend-specialist.md
│   ├── debugger.md
│   ├── orchestrator.md
│   └── ... (1 arquivo por agente)
│
├── skills/                    # Skills especializadas
│   ├── api-patterns/
│   │   └── SKILL.md
│   ├── architecture/
│   │   └── SKILL.md
│   ├── clean-code/
│   │   └── SKILL.md
│   └── ... (1 pasta por skill)
│
└── CLAUDE.md                  # Instruções globais do projeto
```

---

## 📥 GUIA DE INSTALAÇÃO

### Opção 1: Claude Code (RECOMENDADO para times de dev)

```bash
# 1. Instalar Claude Code
npm install -g @anthropic-ai/claude-code

# 2. Na raiz do seu projeto:
mkdir -p .claude/agents .claude/skills

# 3. Criar CLAUDE.md com instruções do projeto
cat > .claude/CLAUDE.md << 'EOF'
# Projeto: [Nome]
## Stack: [tecnologias]
## Convenções: [naming, estrutura]
## Regras críticas: [o que NUNCA fazer]
EOF

# 4. Criar os arquivos de agente (copie os YAMLs da seção Subagentes)
# Exemplo:
cat > .claude/agents/debugger.md << 'EOF'
[conteúdo do agente debugger]
EOF

# 5. Criar as skills (copie os SKILL.md da seção Skills)
mkdir .claude/skills/api-patterns
cat > .claude/skills/api-patterns/SKILL.md << 'EOF'
[conteúdo da skill api-patterns]
EOF

# 6. Iniciar Claude Code
claude
```

### Opção 2: Claude.ai (Pro/Max/Team/Enterprise)

```
1. Acessar: claude.ai → Settings → Features → Custom Skills
2. Para cada skill:
   a. Criar pasta com SKILL.md
   b. Zipar: zip -r api-patterns.skill api-patterns/
   c. Upload via Settings > Features > Upload Skill
3. Skills ativas automaticamente quando relevante
```

### Opção 3: API (para aplicações próprias)

```typescript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

// Upload de skill
const skill = await client.beta.skills.create({
  name: "api-patterns",
  description: "Padrões REST/GraphQL para criação de APIs",
  content: fs.readFileSync("./skills/api-patterns/SKILL.md", "utf8"),
});

// Usar em chamada
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  skills: [{ id: skill.id }],
  messages: [{ role: "user", content: "Crie um endpoint de usuários" }],
});
```

---

## 💡 SUGESTÕES E O QUE APROVEITAR DO AGENTE ANTERIOR

### ✅ O que foi mantido e aprimorado

- Sistema de memória episódica/semântica/procedural → expandido
- Protocolo crítico com categorias de risco → mantido
- Self-improving feedback loop → integrado nos subagentes
- Clean Architecture + SOLID → agora em skill dedicada
- Security OWASP + Zero Trust → expandido em 3 skills

### 🆕 O que foi adicionado

- 15 novos subagentes especializados
- 30+ skills novas baseadas em best practices 2024/25
- Sistema de workflows (/create, /debug, /deploy...)
- Estrutura de pastas pronta para Claude Code
- Guia de instalação em 3 plataformas

### 💡 Recomendações de Prioridade para Começar

**Fase 1 — Setup Mínimo Viável (1-2h)**

1. Instalar Claude Code no projeto principal
2. Criar CLAUDE.md com stack e convenções
3. Criar 5 skills core: clean-code, api-patterns, systematic-debugging, testing-patterns, deployment-procedures
4. Criar 3 agentes: debugger, backend-specialist, orchestrator

**Fase 2 — Expansão (1 semana)** 5. Adicionar skills de acordo com stack do projeto 6. Criar agentes de acordo com necessidades do time 7. Configurar workflows /create e /debug no dia a dia

**Fase 3 — Maturidade** 8. Workflows completos (/deploy, /architecture) 9. Skills customizadas do projeto (convenções específicas) 10. Integração com MCP (Jira, Slack, GitHub)

### ⚡ Dica: Rodar na Prática

```bash
# Debug de bug produção:
claude "/debug: NullPointerException no checkout após atualização de Node"

# Feature nova:
claude "/create: CRUD de produtos com upload de imagem"

# Review de segurança:
claude "/deploy: prepare deploy da versão 2.1 em staging"

# Revisão arquitetural:
claude "/architecture: migrar monólito para microserviços"
```

---

## 🎯 MÉTRICAS DE QUALIDADE

```typescript
const qualityTargets = {
  code: {
    coverage: { unit: 80, integration: 60, e2e: "critical paths" },
    approval_rate: ">90%",
    bug_intro_rate: "<3%",
    security_vulns_missed: 0,
  },
  performance: {
    LCP: "<2.5s",
    INP: "<200ms",
    CLS: "<0.1",
    API_p95: "<500ms",
    DB_query: "<50ms",
  },
  process: {
    PR_review_time: "<24h",
    deploy_frequency: "daily",
    MTTR: "<1h para P0/P1",
  },
};
```

---

**VERSÃO**: 2.0.0 | **ATUALIZADO**: 2025
**COMPATÍVEL COM**: Claude Code · Claude.ai Pro/Max/Team/Enterprise · Anthropic API
**PRINCÍPIO**: _Este agente evolui com cada projeto. Não trabalha hoje como trabalhava no dia 1._
