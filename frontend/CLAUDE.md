# CLAUDE.md — Frontend (EcoSense IoT)

Guia para construir a interface em **React**. Complementa o `CLAUDE.md` da raiz (arquitetura geral e contrato MQTT). Coloque este arquivo em `frontend/CLAUDE.md`.

A referência visual definitiva é o protótipo `ecosense-app.html` (login, dashboard, 4 telas de dispositivo e rotinas). Reproduza aquele visual e comportamento em React — este documento traduz o protótipo em estrutura de código.

## Regra central (não quebrar)

**O estado de cada dispositivo é único e compartilhado.** A leitura/estado de um dispositivo aparece em três lugares — o **menu lateral**, o **card no Dashboard** e a **tela de detalhe** do dispositivo. Os três leem do mesmo store. Portanto:

> Quando o estado de um dispositivo muda em qualquer lugar (o usuário liga/desliga na tela de detalhe, ou chega uma atualização do backend), o **indicador de status no menu lateral e no card do Dashboard deve mudar junto, automaticamente.**

Isso é obrigatório. Não duplique estado por tela. Toda mudança passa por uma única action no store, e todos os componentes que mostram status assinam esse store.

## Stack

| Item | Escolha |
|---|---|
| Build | Vite + React |
| Linguagem | JavaScript (ou TypeScript, se o time preferir) |
| Roteamento | React Router |
| Estado global | Zustand (simples) — ou Context + useReducer |
| Gráficos | Recharts (ou react-chartjs-2, pra bater com o protótipo) |
| Ícones | SVG inline (como no protótipo) ou lucide-react |
| Comunicação | REST (comandos) + WebSocket (status em tempo real) com o backend |

O frontend **nunca fala MQTT direto** — só conversa com o backend (ver `CLAUDE.md` da raiz). O backend traduz MQTT ↔ WebSocket/REST.

## Design tokens

Extraídos do protótipo. Defina como variáveis CSS em `src/styles/tokens.css` e use em todo lugar (nada de cor hardcoded solta).

```css
:root{
  --green-dark:#1B4332;   /* sidebar */
  --green:#2E7D32;        /* acento principal */
  --green-bright:#4CAF50; /* estado ativo, foco */
  --bg:#F5F7FA; --card:#FFFFFF; --border:#E5EAE8;
  --text:#1B1B1B; --text-2:#5F6560; --muted:#9AA0A6;
  --tint-green:#D9ECE0; --tint-gray:#EDEDEA;
  /* acento por subsistema (wayfinding) */
  --amber:#E0A423;   /* iluminação */
  --blue:#4A6FA5;    /* projetor */
  --leaf:#3E9142;    /* irrigação */
  --teal:#2A9AAE;    /* umidificador */
  --shadow:0 4px 16px rgba(15,38,26,.08);
  --radius:16px;
}
```

- Tipografia: **Poppins** (400/500/600/700), via Google Fonts.
- Cards: fundo branco, `--radius`, borda `--border` de 1px, `--shadow`.
- Cada subsistema tem um acento fixo (chip colorido nos cards e no menu).

## Estrutura de pastas

```
frontend/src/
├── main.jsx
├── App.jsx                 # rotas + layout (Sidebar + Outlet)
├── styles/tokens.css
├── store/
│   └── useDevices.js       # store global (Zustand): estado + actions
├── services/
│   ├── api.js              # REST: enviar comandos, buscar rotinas
│   └── realtime.js         # WebSocket: recebe status e atualiza o store
├── components/
│   ├── Sidebar.jsx         # menu com indicador de status por dispositivo
│   ├── StatusPill.jsx
│   ├── DeviceCard.jsx      # card do dashboard
│   ├── PowerButton.jsx
│   ├── ModeToggle.jsx      # segmentado Automático/Manual
│   ├── Switch.jsx          # toggle on/off
│   ├── ThresholdSlider.jsx
│   ├── EnergyChart.jsx
│   └── EventList.jsx
└── pages/
    ├── Login.jsx
    ├── Dashboard.jsx
    ├── Luz.jsx
    ├── Projetor.jsx
    ├── Irrigacao.jsx
    ├── Umidificador.jsx
    └── Rotinas.jsx
```

## Modelo de estado (store)

Fonte única da verdade. Todos os dispositivos num mapa por id.

```js
// store/useDevices.js (Zustand)
const devices = {
  luz:          { id:'luz',          name:'Iluminação',   accent:'var(--amber)', mode:'auto',   on:true,  online:true,
                  reading:{ presenca:true, sleepMin:10 } },
  projetor:     { id:'projetor',     name:'Projetor',     accent:'var(--blue)',  mode:'manual', on:false, online:true,
                  reading:{ fonte:'HDMI 1', autoOff:true, autoOffMin:15 } },
  irrigacao:    { id:'irrigacao',    name:'Irrigação',    accent:'var(--leaf)',  mode:'auto',   on:false, online:true,
                  reading:{ soil:45, threshold:30, maxPumpSec:10 } },
  umidificador: { id:'umidificador', name:'Umidificador', accent:'var(--teal)',  mode:'auto',   on:true,  online:true,
                  reading:{ air:58, threshold:80 } },
};

// actions (as únicas que mudam estado):
setOn(id, value)            // liga/desliga → também dispara sendCommand
setMode(id, 'auto'|'manual')
setThreshold(id, value)
setReading(id, patch)       // atualiza leitura de sensor
applyIncoming(topic, payload) // chamada pelo WebSocket (ver contrato MQTT na raiz)
```

Regra: `setOn` (e as demais) atualizam o store **e** chamam `api.sendCommand(...)`. O `applyIncoming` só atualiza o store (estado vindo do backend). Assim, comando do usuário e atualização do hardware convergem no mesmo lugar.

## Sincronização menu ↔ dashboard ↔ detalhe

- `Sidebar.jsx` mapeia os dispositivos do store e, em cada item de menu, mostra um **ponto de status** (verde = ligado, cinza = desligado; vermelho/opaco se `online === false`).
- `DeviceCard.jsx` (dashboard) e cada página de detalhe leem o mesmo dispositivo do store.
- Ligar/desligar numa página chama `setOn(id, ...)`; como Sidebar e DeviceCard assinam o store, ambos atualizam sem código extra.
- O `StatusPill` no topo da página de detalhe também deriva de `devices[id].on`.

Não guarde `on`/`mode` em `useState` local das páginas — leia sempre do store.

## Telas (rotas)

| Rota | Página | Conteúdo |
|---|---|---|
| `/login` | Login | Marca EcoSense, e-mail/senha, "Entrar" → `/` |
| `/` | Dashboard | StatusPill do sistema, 4 DeviceCard, EnergyChart (economia), EventList |
| `/luz` | Iluminação | PowerButton, presença, ModeToggle, ThresholdSlider "desligar após X min", histórico |
| `/projetor` | Projetor | PowerButton, **controle remoto** (fonte HDMI 1/2/VGA, d-pad + OK, Menu/Voltar/Vol), card de desligamento automático (Switch + "após X min sem presença") |
| `/irrigacao` | Irrigação | Medidor de umidade do solo, ModeToggle, ThresholdSlider "irrigar quando solo < X%", slider tempo máx da bomba, histórico |
| `/umidificador` | Umidificador | Medidor de umidade do ar, ModeToggle, ThresholdSlider "ligar quando ar < X%", histórico |
| `/rotinas` | Rotinas | Construtor SE→ENTÃO + lista de rotinas com Switch por item |

## Comportamentos esperados (critérios de aceite)

1. **Sync de status (o principal):** ligar/desligar um dispositivo na tela de detalhe muda, na mesma hora, o ponto de status daquele dispositivo no **menu lateral** e no **card do Dashboard**. Idem quando chega atualização pelo WebSocket.
2. **Modo Automático/Manual:** o segmentado altera `mode` no store; em Automático, o dispositivo responde às leituras/limites; em Manual, só ao usuário.
3. **Limites (sliders):** mover o slider atualiza o valor exibido ao vivo e grava `threshold`/`sleepMin`/`maxPumpSec` no store (e envia ao backend).
4. **Controle remoto do Projetor:** cada botão (power, fonte, d-pad, OK, menu, vol) envia um comando IR via `sendCommand` e mostra um feedback curto ("Enviado por IR: …"). A fonte selecionada fica destacada.
5. **Rotinas:** o construtor cria a regra no formato "Se \<sensor\> \<operador\> \<valor\> → \<ação\> \<dispositivo\>" e adiciona à lista; cada rotina tem toggle ativar/desativar. (No mock, persiste em memória; com backend, via `api`.)
6. **Tempo real:** o `EnergyChart` e o `EventList` refletem dados do backend; enquanto não houver, usam os dados de exemplo do protótipo.
7. **Login/Sair:** "Entrar" abre o app; "Sair" volta ao login.

## Integração com o backend

- **Status (entrada):** `services/realtime.js` abre um WebSocket com o backend e, a cada mensagem, chama `applyIncoming(topic, payload)`. Os tópicos e o formato do payload são os do contrato MQTT (ver `CLAUDE.md` da raiz) — o backend repassa por WebSocket.
- **Comandos (saída):** `api.sendCommand(id, action)` faz POST no backend, que publica no tópico de comando correspondente.
- **Fase 1 (mock):** a mesma UI funciona com o simulador — como tudo passa pelo store e pelo backend, o frontend não sabe (nem precisa saber) se por trás está o mock ou o ESP32 real.

## Qualidade (piso, não opcional)

- Responsivo até mobile (a sidebar colapsa; grids viram 1–2 colunas).
- Foco de teclado visível (`:focus-visible`), navegável por teclado.
- `prefers-reduced-motion` respeitado (sem animações quando pedido).
- Sem `localStorage`/`sessionStorage` como dependência de estado crítico — o store em memória + backend é a fonte da verdade.
- Nada de cor hardcoded fora dos tokens; nada de estado de dispositivo fora do store.
