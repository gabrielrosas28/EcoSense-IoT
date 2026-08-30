# EcoSense IoT — Backend

API REST do EcoSense IoT: Node.js + **TypeScript** + Express 5 + PostgreSQL
(Prisma 7), testada com Vitest.
Serve o painel React (`../frontend`) e, na fase 2, faz a ponte com os
dispositivos via MQTT.

## Pré-requisitos

- Node.js **22.18+** — o projeto roda TypeScript direto, sem build em
  desenvolvimento (type stripping nativo do Node)
- Docker (para o Postgres local) ou um Postgres 14+ já rodando

## Como rodar

```bash
cd backend
npm install
cp .env.example .env          # ajuste DATABASE_URL e JWT_SECRET se precisar

docker compose up -d          # sobe o Postgres em localhost:5432
npm run prisma:migrate        # cria as tabelas
npm run db:seed               # popula ambientes, dispositivos e usuário de teste

npm run dev                   # http://localhost:3000/api
```

Usuário criado pelo seed: `admin@ecosense.local` / `ecosense123`.
O seed também cria dois ambientes — **Sala 101** (iluminação e projetor) e
**Estufa** (irrigação e umidificador) — com os dispositivos já alocados.

Com o backend no ar, `npm run dev` no `frontend` já enxerga a API — o proxy do
Vite encaminha `/api` para `localhost:3000`.

### Verificação rápida

```bash
curl http://localhost:3000/api/health
```

```bash
curl http://localhost:3000/api/devices
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe a API com reload automático, rodando `.ts` direto |
| `npm test` | Roda a suíte de testes (não precisa de banco) |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:coverage` | Testes + relatório de cobertura |
| `npm run typecheck` | `tsc --noEmit` — verifica os tipos sem gerar nada |
| `npm run build` | Compila para `dist/` com o `tsc` |
| `npm start` | Sobe a API compilada (produção) — exige `npm run build` antes |
| `npm run prisma:migrate` | Cria e aplica migration em desenvolvimento |
| `npm run prisma:deploy` | Aplica migrations existentes (produção/CI) |
| `npm run prisma:generate` | Regera o Prisma Client |
| `npm run prisma:studio` | Abre o Prisma Studio |
| `npm run db:seed` | Popula o banco |
| `npm run db:reset` | Zera o banco e reaplica tudo |

## Testes

```bash
npm test
```

A suíte roda **sem Postgres e sem broker MQTT** — o acesso ao banco é
substituído por um dublê, então dá para rodar em qualquer máquina e em CI sem
subir nada. São testes de unidade (serializers, erros) e de integração, que
batem em cada rota via Supertest e verificam status, corpo da resposta e o que
foi pedido ao banco.

Detalhes da estratégia e o que testar ao mexer no código:
[CLAUDE.md](CLAUDE.md#testes).

## Modelo de dados

| Tabela | Guarda |
|---|---|
| `users` | Quem acessa o painel |
| `environments` | Ambientes monitorados (sala, estufa, laboratório) |
| `devices` | Os 4 subsistemas e o estado corrente de cada um |
| `readings` | Série temporal dos sensores |
| `events` | Histórico exibido no dashboard |
| `commands` | Auditoria dos comandos enviados |
| `routines` | Regras SE → ENTÃO |

O diagrama e as decisões de modelagem estão em
[CLAUDE.md](CLAUDE.md#modelo-de-dados).

## Endpoints

Veja a tabela completa (e as regras de arquitetura) em [CLAUDE.md](CLAUDE.md).

## Estrutura

```
src/
├── server.ts      bootstrap (banco → HTTP → shutdown)
├── app.ts         montagem do Express
├── config/        validação de variáveis de ambiente
├── lib/           conexão com o Postgres (Prisma + adapter pg)
├── types/         DTOs do contrato com o frontend + tipos do Express
├── routes/        declaração de rotas + schemas Zod
├── controllers/   tradução HTTP
├── services/      regra de negócio e acesso ao banco
├── middlewares/   validate, auth, notFound, errorHandler
└── utils/         HttpError, asyncHandler, serializers

tests/
├── helpers/       dublê do Prisma + fixtures
├── unit/          funções puras
└── integration/   rotas de ponta a ponta (Supertest)
```

> Imports relativos terminam em `.ts` — é o que o Node exige para rodar sem
> build; o `tsc` reescreve para `.js` ao compilar. Detalhes em
> [CLAUDE.md](CLAUDE.md#typescript).
