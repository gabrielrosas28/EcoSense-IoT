# Simulador de sensores — EcoSense IoT

Faz o papel do ESP32: gera leituras falsas (umidade do solo, umidade do ar,
presença), roda a lógica automática de cada dispositivo e **responde a
comandos**, tudo pelos mesmos tópicos MQTT do contrato. O backend e o frontend
não sabem (nem precisam saber) se do outro lado está o simulador ou o hardware.

```
Backend ──publish──►  ecosense/<slug>/cmd     ──►  simulador
Backend ◄─subscribe─  ecosense/<slug>/status  ◄──  simulador
```

`<slug>` ∈ `luz | projetor | irrigacao | umidificador`.

## Como rodar

Requer **Node ≥ 22.18** (roda `.ts` direto, igual ao backend) e um broker MQTT.

```bash
cd simulator
npm install
npm run broker        # Mosquitto via Docker em localhost:1883 (opcional se já tiver um)
cp .env.example .env  # ajuste MQTT_URL se o broker estiver em outro lugar
npm start
```

Para demonstração, acelere o tempo no `.env`: `SIM_SPEED=60` (1 minuto
simulado por segundo). A física roda em passos de até 1 s simulado, então
acelerar não muda o comportamento, só a velocidade.

Para ver o tráfego:

```bash
docker exec -it ecosense-mqtt mosquitto_sub -t 'ecosense/#' -v
# mandar um comando como o backend faria:
docker exec -it ecosense-mqtt mosquitto_pub -t ecosense/irrigacao/cmd -m '{"action":"power","value":"on"}'
```

## Contrato

### Status (simulador → backend)

Tópico `ecosense/<slug>/status`, **QoS 1, retido**. O payload é o objeto do
store do frontend achatado: `{ on, mode, online, ...reading }`.

| Dispositivo | Payload de exemplo |
|---|---|
| `luz` | `{"on":true,"mode":"auto","online":true,"presenca":true,"sleepMin":10}` |
| `projetor` | `{"on":false,"mode":"manual","online":true,"fonte":"HDMI 1","autoOff":true,"autoOffMin":15}` |
| `irrigacao` | `{"on":false,"mode":"auto","online":true,"soil":45,"threshold":30,"maxPumpSec":10}` |
| `umidificador` | `{"on":true,"mode":"auto","online":true,"air":58,"threshold":80}` |

Quando publica:
- ao conectar (estado completo);
- logo depois de cada comando — **o status é a confirmação do comando**;
- quando algo muda sozinho (presença, bomba liga/desliga, etc.);
- a cada `SIM_PUBLISH_MS` (heartbeat com as leituras atualizadas).

**Online/offline:** cada dispositivo é um cliente MQTT separado com Last Will
`{"online":false}` retido. Se o processo cair (ou você usar `offline <slug>` no
console), o broker avisa o backend sozinho — igual a um ESP32 sem energia.

### Comandos (backend → simulador)

Tópico `ecosense/<slug>/cmd`, o mesmo JSON que o `api.sendCommand` do frontend
envia:

| Comando | Efeito |
|---|---|
| `{"action":"power","value":"on"}` | liga/desliga (`"on"`/`"off"` ou booleano) |
| `{"action":"mode","value":"auto"}` | `auto` ou `manual` |
| `{"action":"threshold","key":"threshold","value":25}` | ajusta um limite |
| `{"action":"config","maxPumpSec":12}` | patch de configuração |
| `{"action":"ir","key":"source:HDMI 2"}` | projetor: troca a fonte |
| `{"action":"ir","key":"vol+"}` | projetor: d-pad/OK/menu/voltar/volume (só registra) |

Chaves aceitas em `threshold`/`config`: `luz.sleepMin`, `projetor.fonte|autoOff|autoOffMin`,
`irrigacao.threshold|maxPumpSec`, `umidificador.threshold`. Chave desconhecida,
tipo errado ou JSON inválido são ignorados com aviso no log — o simulador não cai.

## Comportamento simulado

| Dispositivo | Automático | Sempre |
|---|---|---|
| Presença (sala) | — | alterna aleatoriamente (chega em ~4 min, sai em ~8 min, em média) |
| `luz` | acende com presença; apaga após `sleepMin` sem ninguém | — |
| `projetor` | — | com `autoOff`, desliga após `autoOffMin` sem presença |
| `irrigacao` | liga a bomba quando `soil < threshold` | solo seca devagar; bomba nunca passa de `maxPumpSec` (nem no manual) |
| `umidificador` | liga quando `air < threshold`; desliga em `threshold + 5` (histerese) | ar tende a 50% |

No modo **manual**, o dispositivo só obedece comandos — as leituras continuam
variando.

## Console interativo

Com o simulador rodando, digite no terminal:

```
status                         estado de todos
presenca on|off                força o sensor de presença
set irrigacao soil 20          força uma leitura (a bomba liga no próximo passo)
offline umidificador           simula queda (dispara o Last Will)
online umidificador            religa
publicar                       publica tudo agora
sair
```

## Variáveis de ambiente

| Variável | Padrão | O que faz |
|---|---|---|
| `MQTT_URL` | `mqtt://localhost:1883` | broker |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | — | credenciais, se o broker exigir |
| `SIM_TICK_MS` | `1000` | passo da simulação (tempo real) |
| `SIM_SPEED` | `1` | multiplicador do tempo |
| `SIM_PUBLISH_MS` | `5000` | intervalo do status periódico |
| `SIM_DEVICES` | todos | subconjunto, ex.: `irrigacao,umidificador` |
| `SIM_SEED` | — | semente: leituras reproduzíveis |
| `SIM_VERBOSE` | `0` | `1` loga também o status periódico |

## Estrutura

```
simulator/
├── src/
│   ├── contract.ts    # tópicos e tipos (espelha backend/src/services/deviceBus.ts)
│   ├── devices.ts     # física + comandos — lógica pura, sem MQTT
│   ├── simulator.ts   # liga o modelo ao broker (1 cliente por dispositivo, LWT)
│   ├── console.ts     # comandos digitados no terminal
│   ├── config.ts      # variáveis de ambiente
│   ├── log.ts
│   └── index.ts       # bootstrap
├── tests/
│   ├── devices.test.ts    # unidade: física e comandos
│   └── simulator.test.ts  # ponta a ponta contra broker em memória (aedes)
├── docker-compose.yml     # Mosquitto local
└── mosquitto/mosquitto.conf
```

```bash
npm test          # não precisa de Docker nem de broker externo
npm run typecheck
```

## Integração com o backend

O backend ainda não fala MQTT: `backend/src/services/deviceBus.ts` só loga o
comando. Quando ele for plugado no broker (publicar em `ecosense/<slug>/cmd` e
assinar `ecosense/+/status` → `applyIncomingStatus`), o fluxo completo
painel → backend → simulador → backend → painel passa a funcionar sem mudar
nada aqui.
