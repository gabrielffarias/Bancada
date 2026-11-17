// Atalho para escrever passos de procedimento.
// open/close: peças que abrem/fecham NESTE passo (o estado é cumulativo entre os passos).
// highlight: peças destacadas · ghost: peças transparentes · xray: carcaça transparente
// focus: peça que a câmera enquadra · view: iso | front | rear | left | right | top
export function step(title, text, opts = {}) {
  return { title, text, ...opts };
}
