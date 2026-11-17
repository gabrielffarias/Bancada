# Bancada

**Guia 3D de manutenção de impressoras.** O técnico digita o código de erro que aparece no painel e a Bancada abre a máquina em 3D, passo a passo: qual tampa abrir, onde está o problema e qual peça sai.

Feito com [Three.js](https://threejs.org), sem build: é HTML + ES modules puros.

> ⚠️ **Protótipo de demonstração.** Os modelos 3D são simplificados e originais, **não são o CAD dos fabricantes**. Os procedimentos são resumidos: confirme sempre no service manual oficial do equipamento.

## O que já tem

| Equipamento | Códigos |
|---|---|
| Xerox VersaLink C405 | 092-318, 071-101, 077-909, 062-380, 116-321, 016-910 |
| Kyocera ECOSYS M3655idn | C6000, C6020, C6030, C3100, MK (kit de manutenção) |
| Canon imageRUNNER ADVANCE 4525i | E000-0001, E001-0000, E003-0000, E202, E010 |
| Fujifilm Apeos | em breve |

Recursos:
- busca por código em todas as marcas
- passo a passo animado (abrir tampas, puxar gavetas, retirar fusor, toner, tambor…)
- parafusos Phillips com rosca que giram e saem um por um antes de cada tampa ou peça
- tela do painel da impressora mostra o código de erro selecionado
- iluminação de estúdio (environment map), plástico texturizado, metal com reflexo
- destaque da peça, rótulo com nome e part number
- Raio-X (carcaça transparente) e vista explodida
- toque/clique em qualquer peça para ver o nome
- link direto para um código: `#kyocera-m3655idn--c6000` (pronto pra integrar com sistema de chamados/bilhetagem)
- responsivo (feito para o celular do técnico na frente da máquina)

## Rodando local

Qualquer servidor estático serve (também roda direto no GitHub Pages: Settings → Pages → branch `main`):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Estrutura

```
index.html              página + importmap do Three.js (CDN)
src/
  main.js               interface, busca, navegação por hash
  viewer.js             cena Three.js, câmera, animações, raio-X, rótulos
  model-builder.js      transforma a lista de peças em objetos 3D
  lib/mfp.js            gerador de multifuncional genérica (modelos simplificados)
  styles.css
data/
  index.js              registro das impressoras
  step.js               helper para escrever passos
  printers/*.js         uma impressora por arquivo: peças + códigos de erro
models/                 (futuro) arquivos glTF vindos do CAD dos fabricantes
```

## Como adicionar uma impressora

1. Crie `data/printers/marca-modelo.js`
2. Gere as peças com `mfp({...})` ajustando medidas (em decímetros), cores e acesso ao fusor
3. Escreva os códigos de erro e os passos
4. Importe no `data/index.js`

Formato de um código:

```js
{
  code: 'C6000',
  title: 'Aquecedor do fusor não esquenta',
  system: 'Fusão',
  severity: 'servico',            // operador | tecnico | servico
  description: '...',
  causes: ['...'],
  parts: ['fuser', 'heater'],     // ids das peças envolvidas
  clear: 'como limpar o erro',    // opcional
  source: { label: '...', url: '...' },
  steps: [
    step('Abra a tampa traseira', 'texto do passo', {
      open: ['rearCover'],        // abre neste passo (estado acumula)
      close: [],                  // fecha neste passo
      highlight: ['rearCover'],   // destaca
      ghost: ['fuser'],           // deixa transparente
      xray: false,                // carcaça transparente
      focus: 'rearCover',         // câmera enquadra esta peça
      view: 'rear',               // iso | front | rear | left | right | top
    }),
  ],
}
```

Formato de uma peça (o que o `mfp()` gera, ou o que você escreve na mão):

```js
{
  id: 'fuser', name: 'Unidade fusora', pn: 'MK-3302', kind: 'internal', // shell | internal | detail
  parent: null,                   // peça pai (filhos se movem junto)
  meshes: [{ shape: 'box', size: [w, h, d], at: [x, y, z], color: '#333' }],
  motion: { type: 'slide', to: [0, 0.25, -4] },      // ou { type: 'hinge', axis: 'x', angle: -1.45 }
}
```

## Roteiro: do protótipo ao CAD real

O formato de dados já separa **geometria** de **comportamento** (movimentos, nomes, part numbers, passos). Quando chegar o CAD de um fabricante:

1. Converter STEP/JT → glTF (CAD Exchanger, pythonOCC ou Blender em linha de comando)
2. Simplificar: tirar parafusos e detalhes internos irrelevantes, reduzir polígonos, comprimir com Draco
3. Nomear os nós do glTF com os mesmos `id` das peças (`fuser`, `rearCover`…) e o part number do catálogo
4. Carregar com `GLTFLoader` no lugar do `mfp()`: movimentos e passos continuam iguais

Próximos passos:
- [ ] loader glTF com mapeamento por nome de nó
- [ ] editor visual de passos (gravar a sequência clicando nas peças)
- [ ] base de códigos em JSON/API, alimentada a partir dos service manuals
- [ ] modo offline (PWA) para o técnico em campo
- [ ] integração com sistema de chamados: impressora reporta o erro → link direto pro guia

## Fontes dos códigos

Cada código tem a fonte linkada na interface (Xerox Support, listas públicas de códigos Kyocera e Canon). Os textos foram reescritos e resumidos; nenhum trecho de service manual foi copiado.

## Licença

[MIT](LICENSE). Xerox, VersaLink, Kyocera, ECOSYS, Canon, imageRUNNER, Fujifilm e Apeos são marcas de seus respectivos donos. Este projeto não tem vínculo com os fabricantes.
