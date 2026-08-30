# CLAUDE.md — Backend (EcoSense IoT)

Guia para trabalhar na API. Complementa `frontend/CLAUDE.md`, que define o
contrato do lado do cliente. **O contrato da API é o formato do store do
frontend** (`frontend/src/store/useDevices.js`): o banco é detalhe interno e
não deve vazar para a UI.

## Papel do backend

O frontend **nunca fala MQTT**. Ele fala REST + WebSocket com este backend, e o
backend traduz para/do broker MQTT:

```
React  ──REST──►  Backend  ──MQTT publish──►  ESP32
React  ◄──WS───   Backend  ◄──MQTT subscribe──  ESP32
```

- **Comandos (saída):** `POST /api/devices/:slug/command` → grava o estado,
  registra no histórico e publica em `ecosense/<slug>/cmd`.
- **Status (entrada):** o device publica em `ecosense/<slug>/status`; o backend
  grava e repassa aos clientes WebSocket, que chamam `applyIncoming` no store.

Hoje o MQTT ainda **não** está plugado: `src/services/deviceBus.ts` é o ponto
de encaixe (loga o comando). Quando o broker entrar, só esse arquivo muda —
nenhum controller.

## Stack

| Item | Escolha |
|---|---|
| Runtime | Node.js **≥ 22.18** (ESM, `--watch`, type stripping nativo) |
| Build | `tsc` (TypeScript 7) — só para produção; em dev o Node roda `.ts` direto |
| Framework | Express 5 |
| Linguagem | **TypeScript** (ESM estrito) — `"type": "module"` |
| Banco | PostgreSQL 17 |
| ORM | Prisma 7 com driver adapter `@prisma/adapter-pg` |
| Validação | Zod 4 |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Testes | Vitest + Supertest (Prisma mockado — roda sem banco) |

## Estrutura de pastas

```
backend/
├── prisma/
│   ├── schema.prisma        # modelos + enums
│   ├── migrations/          # SQL versionado (commitar sempre)
│   └── seed.ts              # ambientes, dispositivos e usuário de teste
├── prisma7.config.ts        # config da CLI do Prisma 7 (carrega o .env)
├── generated/prisma/        # cliente gerado — NÃO versionar, NÃO editar
├── docker-compose.yml       # Postgres local
├── tsconfig.json            # strict + erasableSyntaxOnly (ver "TypeScript")
├── tsconfig.build.json      # o build ignora tests/
├── vitest.config.ts         # suíte de testes + cobertura
├── tests/                   # ver "Testes"
│   ├── setup.ts             # variáveis de ambiente da suíte
│   ├── helpers/             # prismaMock.ts e fixtures.ts
│   ├── unit/                # funções puras (serializers, HttpError)
│   └── integration/         # rotas de ponta a ponta, via Supertest
├── dist/                    # saída do `npm run build` — NÃO versionar
└── src/
    ├── server.ts            # bootstrap: conecta o banco, sobe o HTTP, shutdown
    ├── app.ts               # monta o Express (cors, json, /api, 404, erros)
    ├── config/env.ts        # valida process.env com Zod — falha no boot
    ├── lib/prisma.ts        # PrismaClient + PrismaPg (única instância)
    ├── types/
    │   ├── api.ts           # DTOs do contrato — o shape que o frontend espera
    │   └── express.d.ts     # `req.user` e `req.validatedQuery`
    ├── routes/              # só declara caminho + validação + handler
    │   ├── index.ts         # router raiz montado em /api
    │   ├── schemas.ts       # schemas Zod das rotas
    │   ├── health.routes.ts
    │   ├── auth.routes.ts
    │   ├── device.routes.ts
    │   └── routine.routes.ts
    ├── controllers/         # req/res: lê a request, chama o service, responde
    ├── services/            # regra de negócio e acesso ao banco
    │   ├── device.service.ts
    │   ├── routine.service.ts
    │   ├── auth.service.ts
    │   ├── event.service.ts
    │   └── deviceBus.ts     # ponto de encaixe do MQTT
    ├── middlewares/         # validate, auth, notFound, errorHandler
    └── utils/               # HttpError, asyncHandler, serializers
```

### Regra de camadas (não quebrar)

> **Rota** declara. **Controller** traduz HTTP. **Service** decide e acessa o
> banco. Nada de `prisma.*` em controller ou rota; nada de `req`/`res` em
> service.

Isso mantém a regra de negócio testável e permite reusar os services no
listener MQTT (que não tem `req`/`res`).

## TypeScript

Duas formas de rodar o mesmo código, sem duplicação:

- **Dev:** `node --watch --env-file=.env src/server.ts`. O Node 22.18+/24 apaga
  os tipos na hora (*type stripping*) — sem build, sem `ts-node`, sem watcher
  extra.
- **Produção:** `npm run build` (`tsc`) gera `dist/`, e `npm start` roda o JS.

Para os dois funcionarem com o mesmo código-fonte:

- **Imports relativos terminam em `.ts`** (`import { env } from "../config/env.ts"`).
  É o que o Node exige em runtime; no build o `rewriteRelativeImportExtensions`
  troca por `.js`. Não escreva `.js` nem omita a extensão.
- **`erasableSyntaxOnly`** está ligado: nada de `enum`, `namespace` ou
  parameter properties (`constructor(private x)`) — só sintaxe que some ao
  apagar os tipos. Use `as const` no lugar de `enum`.
- **`verbatimModuleSyntax`**: importe tipos com `import type`.
- `strict` e `noUncheckedIndexedAccess` ligados. `npm run typecheck` roda
  `tsc --noEmit` — use antes de commitar.

### Tipos

- Os DTOs da API vivem em `src/types/api.ts`. **É o contrato com o frontend**:
  mexeu neles, alinhe com `frontend/src/store/useDevices.js`.
- Os tipos das entidades vêm do cliente gerado:
  `import type { Device, Prisma } from "../../generated/prisma/client.ts"`
  (os modelos ficam em `client.ts`, não em `models.ts`).
- Campos que middlewares acrescentam à request (`req.user`,
  `req.validatedQuery`) são declarados em `src/types/express.d.ts`.

## Rotas

Todas sob `/api`. O proxy do Vite (`frontend/vite.config.js`) já encaminha.

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/health` | Liveness + checagem do Postgres |
| `POST` | `/api/auth/login` | E-mail + senha → `{ token, user }` |
| `GET` | `/api/auth/me` | Usuário do token (exige `Bearer`) |
| `GET` | `/api/devices` | Lista os 4 dispositivos, na ordem das telas |
| `GET` | `/api/devices/events` | Histórico do `EventList` (`?limit=40`) |
| `GET` | `/api/devices/:slug` | Um dispositivo |
| `POST` | `/api/devices/:slug/command` | Comando do painel → estado + MQTT |
| `POST` | `/api/devices/:slug/status` | Estado reportado pelo device/simulador |
| `GET` | `/api/routines` | Lista rotinas |
| `POST` | `/api/routines` | Cria rotina (SE → ENTÃO) |
| `PATCH` | `/api/routines/:id` | Atualiza (usado pelo toggle ativar/desativar) |
| `DELETE` | `/api/routines/:id` | Remove |

`:slug` é sempre um de `luz | projetor | irrigacao | umidificador` — os mesmos
ids do store e dos tópicos MQTT.

### Formato do comando

Exatamente o que `api.sendCommand` já envia:

```json
{ "action": "power",     "value": "on" }
{ "action": "mode",      "value": "auto" }
{ "action": "threshold", "key": "threshold", "value": 30 }
{ "action": "config",    "maxPumpSec": 12 }
```

Ações desconhecidas (IR do projetor: d-pad, menu, volume) são aceitas,
registradas no histórico e publicadas — sem alterar estado no banco.

### Formato da resposta de dispositivo

Igual ao objeto do store — não invente campos novos sem alinhar com o frontend:

```json
{ "id": "irrigacao", "name": "Irrigação", "accent": "var(--leaf)",
  "on": false, "mode": "auto", "online": true,
  "reading": { "soil": 45, "threshold": 30, "maxPumpSec": 10 },
  "environment": { "id": "sala-101", "name": "Sala 101" } }
```

A tradução banco → esse formato mora em `src/utils/serializers.ts`. Mexeu no
schema? Ajuste o serializer, não o frontend.

## Banco (Prisma + Postgres)

### Modelo de dados

```
Environment 1 ──── N Device 1 ──── N Reading
 (ambientes)        (devices)       (readings)
      │                 │
      └───── N ─────────┼──── N Event      (histórico do dashboard)
        (leituras)      ├──── N Command    (auditoria dos comandos)
                        └──── N Routine ─── N:1 ── User
```

| Tabela | Guarda | Chave de negócio |
|---|---|---|
| `users` | Quem acessa o painel (senha em hash bcrypt) | `email` |
| `environments` | Onde os dispositivos ficam: sala, estufa, laboratório | `slug` |
| `devices` | Os 4 subsistemas + estado corrente | `slug` |
| `readings` | Série temporal dos sensores — uma linha por medição | — |
| `events` | Histórico legível do `EventList` | — |
| `commands` | Auditoria do que foi mandado ao dispositivo | — |
| `routines` | Regras SE → ENTÃO | — |

Quatro decisões que valem entender antes de mexer:

1. **`slug` é a chave pública; `id` (UUID) é interna.** O frontend e os tópicos
   MQTT falam `luz`, `irrigacao`, `sala-101`. O UUID nunca sai da API — quem
   traduz é o serializer.
2. **Estado corrente e histórico ficam separados.** O valor *agora* de um sensor
   vive em `Device.settings` (Json), para a tela carregar com uma consulta só;
   a série completa vive em `readings`. Os dois são escritos no mesmo ponto
   (`applyIncomingStatus`).
3. **`Reading` guarda `environmentId` além do `deviceId`.** É desnormalização
   proposital: se o dispositivo for realocado depois, o histórico continua
   dizendo em que ambiente aquilo foi medido. Não "corrija" isso para um join.
4. **`Device.environmentId` é opcional** (`onDelete: SetNull`). Um dispositivo
   recém-pareado existe antes de alguém dizer onde ele fica, e apagar um
   ambiente não pode derrubar os dispositivos junto.

### O que vira leitura de sensor

O payload de status mistura medição com configuração — `soil` é sensor,
`threshold` é ajuste do usuário. Só o que está em `SENSOR_METRICS`
(`src/services/device.service.ts`) vira linha em `readings`; o resto fica apenas
em `Device.settings`. Sensor novo? Adicione a métrica e a unidade nesse mapa.
Booleano (`presenca`) é gravado como 1/0, para caber num gráfico.

### Regras de acesso

- Uma única instância de `PrismaClient`, exportada por `src/lib/prisma.ts`.
  Nunca dê `new PrismaClient()` em outro arquivo (vaza conexão).
- Prisma 7 acessa o banco por **driver adapter** (`@prisma/adapter-pg`) — por
  isso `pg` é dependência direta.
- O cliente é gerado em `generated/prisma` **em TypeScript** e entra no
  `tsconfig.json` — por isso o build sai em `dist/src/` e `dist/generated/`.
- `settings` (Json) guarda o `reading` de cada dispositivo. É de formato livre
  **por dispositivo** — sempre faça patch (`{ ...settings, ...novo }`), nunca
  substitua o objeto inteiro.
- Consulta de dispositivo sempre com `include: { environment: true }` — o DTO
  expõe o ambiente, e sem o include vira consulta N+1 na listagem.

Fluxo de mudança de schema:

```bash
# 1. edite prisma/schema.prisma
npm run prisma:migrate -- --name descreva_a_mudanca   # cria SQL + aplica + gera
npm run db:seed                                       # se precisar repopular
```

Commite sempre `prisma/migrations/`. Nunca edite uma migration já aplicada —
crie outra.

Migrations existentes:

| Migration | O que faz |
|---|---|
| `20260830120000_init` | users, devices, readings, events, commands, routines |
| `20260830140000_add_environments` | environments + `environmentId` em devices e readings |

## Configuração e segredos

- `src/config/env.ts` valida tudo com Zod e **mata o processo no boot** se
  faltar algo. Variável nova? Adicione no schema, no `.env.example` e aqui.
- `.env` não vai pro git; `.env.example` vai.
- `JWT_SECRET` de exemplo é só para desenvolvimento.

## Erros

Lance `HttpError` (`utils/HttpError.ts`) — o `errorHandler` traduz para JSON.
Erros do Prisma (`P2002`, `P2025`, ...) já têm tradução automática. Não faça
`try/catch` em controller só para responder erro: deixe subir.

```ts
throw HttpError.notFound(`Dispositivo "${slug}" não existe`);
```

## Comandos

```bash
docker compose up -d          # Postgres local (porta 5432)
npm run prisma:migrate        # aplica as migrations
npm run db:seed               # popula dispositivos + usuário de teste
npm run dev                   # API em http://localhost:3000/api (roda .ts direto)
npm test                      # suíte completa (não precisa de banco)
npm run typecheck             # tsc --noEmit
npm run build && npm start    # compila para dist/ e roda o JS
npm run prisma:studio         # inspeciona o banco no navegador
```

## Testes

```bash
npm test                # roda tudo uma vez
npm run test:watch      # reexecuta o que mudou enquanto você edita
npm run test:coverage   # relatório de cobertura (texto + HTML em coverage/)
```

**A suíte não precisa de Postgres nem de broker MQTT.** Roda em qualquer
máquina, inclusive em CI, sem `docker compose up`. Isso é proposital: teste que
depende de infraestrutura não roda, e teste que não roda não protege ninguém.

### Como está organizada

```
tests/
├── setup.ts                 # define as env vars ANTES de qualquer import
├── helpers/
│   ├── prismaMock.ts        # dublê de src/lib/prisma.ts
│   └── fixtures.ts          # linhas de banco de mentira (deviceRow, ...)
├── unit/                    # funções puras, sem HTTP e sem banco
│   ├── serializers.test.ts
│   └── HttpError.test.ts
└── integration/             # requisição HTTP real contra o app em memória
    ├── app.test.ts          # health, 404, 500, CORS
    ├── devices.test.ts
    ├── readings.test.ts     # série temporal + ambiente do dispositivo
    ├── routines.test.ts
    └── auth.test.ts
```

### A estratégia: mockar só o banco

Os testes de integração exercitam **rota → validate → controller → service** de
verdade. A única peça substituída é `src/lib/prisma.ts`:

```ts
vi.mock("../../src/lib/prisma.ts", () => import("../helpers/prismaMock.ts"));
```

O `vi.mock` é içado para o topo do arquivo, por isso ele vem **antes** dos
imports da aplicação em cada teste — não dá para escondê-lo no `setup.ts`.

Com isso, um único teste cobre validação Zod, tradução de erro, serialização e
o formato exato da resposta. E as asserções podem olhar o que foi *pedido* ao
banco:

```ts
expect(prisma.device.update).toHaveBeenCalledWith(
  expect.objectContaining({ data: { settings: { soil: 45, threshold: 25 } } }),
);
```

Chame `resetPrismaMock()` no `beforeEach` — sem isso, o retorno configurado num
teste vaza para o seguinte.

### O que testar ao mexer no código

| Você mudou | Escreva teste de |
|---|---|
| Um serializer | `unit/` — é o contrato com o frontend, quebrou lá quebra a UI |
| Uma rota nova | `integration/` — caminho feliz + corpo inválido (400) + recurso ausente (404) |
| Regra de negócio num service | `integration/`, afirmando o que foi pedido ao Prisma |
| Um middleware | `integration/`, pela rota que o usa |

Cinco coisas que a suíte já protege e **não** devem regredir:

1. **O shape da resposta.** `serializeDevice` devolve `{ id, name, accent, on,
   mode, online, reading, environment }` — o mesmo objeto do store do frontend.
   Ajustar essa expectativa sem alinhar com `frontend/src/store/useDevices.js`
   quebra a UI.
2. **Patch de `settings`, nunca substituição.** Um comando de `threshold` altera
   uma chave e preserva as outras.
3. **Status é via de mão única.** `POST /:slug/status` grava o estado e **não**
   publica comando de volta — senão vira laço entre backend e dispositivo.
4. **Só medição vira `Reading`.** `threshold` e afins ficam de fora da série
   temporal; comando do painel não gera leitura nenhuma.
5. **O UUID não sai da API.** Dispositivo e ambiente se identificam pelo `slug`.

### Limites atuais (o que a suíte ainda não cobre)

- **Não há teste contra um Postgres real.** Migrations, constraints e cascatas
  do schema não são exercitadas. Se mexer em relação ou índice, teste à mão com
  o banco de pé (ou adicione um teste de integração com Testcontainers).
- **`src/lib/prisma.ts` fica fora da cobertura** — é justamente o módulo
  substituído pelo mock.
- **MQTT e WebSocket ainda não existem**, então não há teste deles. Quando o
  `deviceBus` passar a publicar de verdade, ele precisa de dublê próprio.

## Qualidade (piso, não opcional)

- Toda entrada de rota validada com Zod antes de chegar ao service.
- Nenhuma senha em texto puro no banco ou em log.
- Nenhuma query direta fora de `services/`.
- Respostas em JSON com o mesmo shape do store do frontend.
- Handler async sempre com `asyncHandler` (ou `next(err)` explícito).
- `npm run typecheck` limpo antes de commitar. Nada de `any` solto nem
  `@ts-ignore` — se o tipo não fecha, o modelo está errado.
- `npm test` verde antes de commitar. Rota nova entra com teste junto, no mesmo
  commit — não "depois".
- Teste que precisa de Postgres, broker ou rede não entra em `tests/`.
- Mensagens de erro e comentários em português, como no resto do projeto.
