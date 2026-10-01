# EcoSense IoT — Backend

API do EcoSense IoT em **Node.js + Express 5 + PostgreSQL**, ligada aos
dispositivos por **MQTT** (Mosquitto). É a ponte entre o painel React
(`../frontend`) e os dispositivos da sala: o frontend nunca fala MQTT, só com
esta API.

```
React ──REST──► API (Express) ──► PostgreSQL
                  │        ▲
     publica cmd  ▼        │  assina status
              Mosquitto (broker MQTT)
                  │        ▲
                  ▼        │
         ESP32 ou simulador (../simulator)
```

## Pré-requisitos

- **Node.js 22.12+** (testado no 24)
- **Docker**: `docker compose up -d` sobe o PostgreSQL 17 e o broker MQTT
  (Mosquitto 2) já configurados.
- Sem Docker: `npm run db:local` sobe um PostgreSQL embutido (PGlite), que não
  precisa instalar nada. Sem broker, deixe `MQTT_URL` vazio no `.env`: a API
  funciona, mas os comandos não chegam aos dispositivos.

## Como rodar

```bash
cd backend
npm install
cp .env.example .env      # os valores padrão já funcionam em desenvolvimento

docker compose up -d      # PostgreSQL + Mosquitto (sem Docker: npm run db:local)
npm run db:migrate        # cria as tabelas
npm run db:seed           # dispositivos, rotinas e usuário de teste

npm run dev               # http://localhost:3000/api (reinicia ao salvar)
```

Para ter "dispositivos" respondendo, rode o simulador em outro terminal. Ele
usa o mesmo broker, então pule o `npm run broker` dele:

```bash
cd ../simulator
npm install
npm start                 # SIM_SPEED=60 npm start acelera o tempo (1 min por segundo)
```

Usuário de desenvolvimento criado pelo seed: **admin@ecosense.local** /
**ecosense123**.

Com a API no ar, o `npm run dev` do frontend já a enxerga: o proxy do Vite
encaminha `/api` para `localhost:3000`.

### Testando na mão

```bash
curl http://localhost:3000/api/health

# login → token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ecosense.local","password":"ecosense123"}'

# rotas protegidas: mande o token
curl http://localhost:3000/api/devices -H "Authorization: Bearer <token>"
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | API com reinício automático (`node --watch`) |
| `npm start` | API sem watch (produção) |
| `npm test` | Testes contra um PostgreSQL real em memória (não precisa de Docker) |
| `npm run test:watch` | Testes em modo watch |
| `npm run lint` | Lint com oxlint (mesma ferramenta do frontend) |
| `npm run db:migrate` | Aplica as migrations pendentes |
| `npm run db:seed` | Popula o banco (pode rodar de novo sem duplicar) |
| `npm run db:reset` | **Apaga tudo** e recria (bloqueado em produção) |
| `npm run db:local` | PostgreSQL embutido para quem não tem Docker |

## Variáveis de ambiente

Todas são validadas no boot (`src/config/env.js`): se faltar ou estiver errada,
a API nem sobe e diz o que corrigir.

| Variável | Padrão | Para quê |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` ou `production` |
| `PORT` | `3000` | Porta HTTP (o proxy do Vite aponta para 3000) |
| `CORS_ORIGIN` | `http://localhost:5173` | Origens liberadas, separadas por vírgula (`*` libera todas) |
| `DATABASE_URL` | obrigatória | `postgresql://usuario:senha@host:porta/banco` |
| `DB_POOL_MAX` | `10` | Conexões simultâneas com o banco |
| `JWT_SECRET` | obrigatória | Segredo dos tokens (mín. 16 caracteres; o de exemplo é recusado em produção) |
| `JWT_EXPIRES_IN` | `8h` | Validade do login (`30m`, `8h`, `7d`...) |
| `APP_TIMEZONE` | `America/Sao_Paulo` | Fuso do horário exibido no histórico |
| `MQTT_URL` | vazio (sem MQTT) | Broker: `mqtt://localhost:1883` no `.env.example` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | — | Credenciais, se o broker exigir |

## Rotas

Todas sob `/api`. Erros sempre no formato `{ "error": "...", "details": [{ "campo", "erro" }] }`
(`details` só em erro de validação).

| Método | Rota | Login | O que faz |
|---|---|---|---|
| `GET` | `/api/health` | — | Situação da API, do banco e do broker (503 se o banco cair) |
| `POST` | `/api/auth/login` | — | `{ email, password }` → `{ token, user }` |
| `GET` | `/api/auth/me` | ✔ | Usuário da sessão |
| `GET` | `/api/devices` | ✔ | Os 4 dispositivos, na ordem das telas |
| `GET` | `/api/devices/:id` | ✔ | Um dispositivo (`luz`, `projetor`, `irrigacao`, `umidificador`) |
| `POST` | `/api/devices/:id/command` | ✔ | Comando do painel → grava o estado e publica no barramento (202) |
| `GET` | `/api/routines` | ✔ | Rotinas SE → ENTÃO |
| `POST` | `/api/routines` | ✔ | Cria (aceita o `id` gerado pela tela) |
| `PATCH` | `/api/routines/:id` | ✔ | Altera, por exemplo o interruptor `{ "enabled": false }` |
| `DELETE` | `/api/routines/:id` | ✔ | Remove (204) |
| `GET` | `/api/events` | ✔ | Histórico do dashboard (`?limit=20&device=luz`) |

Rota protegida sem token, ou com token vencido, responde **401**. O login do
frontend (branch `feat/setup-do-frontend`) trata esse 401 voltando para a tela
de login.

### Formato dos dados

Dispositivo, no mesmo formato do store do frontend (`store/useDevices.js`):

```json
{ "id": "irrigacao", "name": "Irrigação", "accent": "var(--leaf)",
  "on": false, "mode": "auto", "online": true,
  "reading": { "soil": 45, "threshold": 30, "maxPumpSec": 10 },
  "lastSeenAt": null }
```

Comandos, exatamente o que `api.sendCommand` envia (e o que o simulador/ESP32
recebe em `ecosense/<id>/cmd`):

```json
{ "action": "power",     "value": "on" }
{ "action": "mode",      "value": "manual" }
{ "action": "threshold", "key": "threshold", "value": 25 }
{ "action": "config",    "maxPumpSec": 12 }
{ "action": "ir",        "key": "source:HDMI 2" }
```

Cada dispositivo só aceita os próprios ajustes, nos limites dos sliders:
`luz.sleepMin`, `projetor.fonte | autoOff | autoOffMin`,
`irrigacao.threshold | maxPumpSec` e `umidificador.threshold`. Leitura de sensor
(`soil`, `air`, `presenca`) só o dispositivo altera. Tudo isso fica em
`src/domain/devices.js`.

Rotina, no formato de `store/useRoutines.js`:

```json
{ "id": "r1", "sensor": "soil", "operator": "lt", "value": 30,
  "action": "on", "device": "irrigacao", "enabled": true }
```

## MQTT

O broker é o Mosquitto do `docker-compose.yml`, o mesmo do simulador (container
`ecosense-mqtt`, porta 1883; 9001 para WebSocket). A ponte fica em
`src/mqtt/bridge.js` e segue o contrato de `simulator/README.md`:

| Direção | Tópico | Payload | Como |
|---|---|---|---|
| API → dispositivo | `ecosense/<id>/cmd` | o comando do painel (`{ "action": ... }`) | QoS 1, **sem** reter |
| dispositivo → API | `ecosense/<id>/status` | `{ on, mode, online, ...reading }` | QoS 1, retido |
| broker → API | `ecosense/<id>/status` | `{ "online": false }` (Last Will) | quando o dispositivo cai |

- **Comando**: a API grava o estado pedido e publica. Comando não é retido: um
  dispositivo que reconecta não pode repetir ordem velha.
- **Status**: é a verdade sobre o hardware. A API grava estado, leituras e
  `lastSeenAt`, e registra no histórico só o que mudou sem passar pelo painel:
  "Irrigação ligada pelo dispositivo", "Umidificador ficou offline". Heartbeat
  sem mudança não gera evento, e o status que confirma um comando também não.
- Campo desconhecido ou fora da faixa no status é ignorado (com aviso no log)
  sem descartar o resto da mensagem.
- Como o status é retido, ao conectar a API recebe na hora o último estado de
  cada dispositivo, e o Last Will de quem caiu enquanto ela estava fora.
- Sem broker, a API sobe do mesmo jeito: tenta reconectar a cada 5 s e guarda
  os comandos até lá. O `/api/health` mostra `"mqtt": "up" | "down" | "disabled"`.

Para ver o tráfego e mandar um comando na mão:

```bash
docker exec -it ecosense-mqtt mosquitto_sub -t 'ecosense/#' -v
docker exec -it ecosense-mqtt mosquitto_pub -t ecosense/irrigacao/cmd -m '{"action":"power","value":"on"}'
```

O broker de desenvolvimento aceita conexão sem senha. Para ligar o ESP32 de
verdade na rede, configure usuário e senha no Mosquitto e preencha
`MQTT_USERNAME`/`MQTT_PASSWORD`.

## Estrutura

```
backend/
├── src/
│   ├── server.js          bootstrap: espera o banco, sobe o HTTP, desliga limpo
│   ├── app.js             monta o Express (helmet, cors, json, /api, 404, erros)
│   ├── config/env.js      lê e valida as variáveis de ambiente
│   ├── database/
│   │   ├── pool.js        conexão (pool do pg) + transaction()
│   │   ├── migrator.js    aplica migrations/*.sql pendentes
│   │   ├── migrations/    SQL versionado: 001_initial_schema.sql, ...
│   │   └── seed.js        dados iniciais (os mesmos do mock do frontend)
│   ├── routes/            caminho + validação → controller (index.js monta tudo)
│   ├── schemas/           schemas Zod de cada rota
│   ├── controllers/       traduzem HTTP: leem req.validated, respondem JSON
│   ├── services/          regras de negócio
│   ├── repositories/      todo o SQL fica aqui
│   ├── domain/            catálogo de dispositivos e vocabulário das rotinas
│   ├── middlewares/       validate, auth, requestLogger, notFound, errorHandler
│   ├── mqtt/              ponte com o broker: publica comandos, grava status
│   └── lib/               zod (pt-BR), HttpError, senha, token, barramento
├── scripts/               db.js (migrate/seed/reset) e local-db.js (PGlite)
├── tests/                 Vitest + Supertest contra PostgreSQL e broker em memória
└── docker-compose.yml     PostgreSQL + Mosquitto (o broker vem de ../simulator)
```

O caminho de uma requisição:

```
rota → validate (Zod) → controller → service → repository → PostgreSQL
```

### Adicionando uma rota

1. Schema Zod em `src/schemas/<recurso>.schemas.js`.
2. SQL em `src/repositories/<recurso>.repository.js`.
3. Regra em `src/services/<recurso>.service.js` (lança `HttpError` quando algo
   não pode, e o `errorHandler` responde).
4. Controller fino em `src/controllers/` e rota em `src/routes/`.
5. Uma linha em `src/routes/index.js`, no grupo público ou protegido.
6. Teste em `tests/` cobrindo o caminho feliz e os erros.

## Banco de dados

| Tabela | Guarda |
|---|---|
| `users` | Quem acessa o painel (senha só como hash scrypt) |
| `devices` | Os 4 subsistemas e o estado corrente de cada um |
| `routines` | Regras SE → ENTÃO |
| `events` | Histórico exibido no dashboard |
| `schema_migrations` | Quais migrations já foram aplicadas |

Os ids dos dispositivos (`luz`, `projetor`, ...) são a chave primária: são os
mesmos do frontend e dos tópicos MQTT.

**Mudou o esquema?** Crie `src/database/migrations/002_descreva_a_mudanca.sql`
e rode `npm run db:migrate`. Nunca edite uma migration que já foi aplicada:
crie outra. Cada arquivo roda numa transação (ou entra inteiro, ou não entra).

## Testes

```bash
npm test
```

A suíte sobe um **PostgreSQL de verdade em memória** (PGlite, o Postgres
compilado para WebAssembly), aplica as migrations e reinicia os dados do seed
antes de cada teste. A API fala com ele pelo mesmo driver `pg` de produção.
Não há mock de banco: SQL errado, constraint violada ou transação mal feita
quebram o teste. A ponte MQTT é testada contra um broker em memória (aedes, o
mesmo que o simulador usa), com um cliente fazendo o papel do dispositivo. Roda
em qualquer máquina, sem Docker.

## Próximos passos

- **WebSocket `/ws`:** repassar os status ao painel em tempo real
  (`services/realtime.js` do frontend já espera `{ topic, payload }`).
- Série temporal de leituras (`readings`) para os gráficos do dashboard.
- Autenticação no broker para a rede com o ESP32 de verdade.
