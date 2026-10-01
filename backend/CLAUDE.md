# CLAUDE.md — Backend (EcoSense IoT)

Guia para trabalhar na API. Complementa o `frontend/CLAUDE.md`. Como rodar,
rotas e estrutura estão no [README](README.md); aqui ficam as regras.

## Regra central (não quebrar)

**O contrato da API é o formato dos stores do frontend**
(`frontend/src/store/useDevices.js` e `useRoutines.js`). O banco é detalhe
interno: nome de coluna não vaza para a resposta, e mudança de esquema se
resolve no repository, nunca no frontend. Comandos seguem o contrato MQTT do
simulador (`ecosense/<id>/cmd`).

## Camadas

```
rota → validate (Zod) → controller → service → repository → PostgreSQL
```

- **Rota** só declara caminho, schema e controller.
- **Controller** lê `req.validated` (nunca `req.body` cru) e responde. Nada de
  try/catch para responder erro: o Express 5 encaminha a rejeição ao `errorHandler`.
- **Service** decide e lança `HttpError`. Não conhece `req`/`res`, porque é
  reusado pela ponte MQTT (`applyStatus`).
- **Repository** é o único lugar com SQL. Recebe `db` como último parâmetro
  (pool por padrão, ou o client de `transaction()`).

## Banco

- Uma única instância de pool (`src/database/pool.js`). Não crie `new pg.Pool` em outro lugar.
- Dentro de `transaction(async (client) => ...)`, toda query usa o `client`.
  Query pelo pool ali dentro roda fora da transação, e nos testes trava.
- Sempre parâmetros (`$1`, `$2`); nunca concatene valor em SQL.
- `reading` (jsonb) é mesclado com `||`, nunca substituído.
- Esquema novo = migration nova em `src/database/migrations/NNN_nome.sql`.
  Nunca edite uma migration já aplicada.

## MQTT

- O contrato é o do simulador (`simulator/README.md`, `simulator/src/contract.ts`).
  Mudou tópico ou payload? Alinhe os dois lados.
- Comando: QoS 1 e **nunca** `retain`, porque um dispositivo que reconecta não
  pode repetir ordem velha. Só a ponte (`src/mqtt/bridge.js`) publica; os
  services usam `publishCommand` do `deviceBus`.
- Status nunca gera comando de volta (laço backend ↔ dispositivo).
- A ponte grava os status em fila, um por vez, na ordem de chegada. Não
  paralelize: heartbeat fora de ordem grava estado velho.
- Evento no histórico só para mudança real (liga/desliga, online/offline).
  Heartbeat e confirmação de comando não viram evento.
- Sensor novo: adicione em `sensors` no catálogo (`src/domain/devices.js`).
  Chave fora do catálogo é ignorada no status.
- A API não pode depender do broker para subir: sem conexão ela segue
  funcionando e o mqtt.js reconecta sozinho.

## Convenções

- JavaScript ESM, Node 22.12+. Imports relativos com extensão `.js`.
- Importe o `z` de `src/lib/zod.js`, não de `"zod"` (é onde as mensagens ficam em pt-BR).
- Mensagens de erro, comentários e logs em português.
- Erros: `{ error, details? }`, com `details` como `[{ campo, erro }]`, que é o
  formato que a tela de login lê.
- Variável de ambiente nova: schema em `src/config/env.js`, `.env.example` e README.

## Qualidade (piso)

- `npm test` e `npm run lint` verdes antes de commitar.
- Rota nova entra com teste no mesmo commit: caminho feliz, 400 e 404.
- Os testes usam PostgreSQL real em memória (PGlite). Não mocke o banco; se o
  teste precisa de um estado, crie-o com SQL ou pela própria API.
- MQTT se testa contra o broker em memória (aedes, `tests/mqtt.test.js`), sem
  Docker. Para afirmar que algo **não** foi retido, use um cliente que conecta
  depois: quem já está inscrito sempre recebe com `retain=0`.
