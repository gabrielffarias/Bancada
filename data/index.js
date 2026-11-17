// Registro das impressoras. Para adicionar uma máquina, crie um arquivo em data/printers/ e importe aqui.
import kyocera from './printers/kyocera-ecosys-m3655idn.js';
import xerox from './printers/xerox-versalink-c405.js';
import canon from './printers/canon-iradv-4525i.js';

export const PRINTERS = [xerox, kyocera, canon];

// Aparecem na lista como "em breve"
export const UPCOMING = [
  { brand: 'Fujifilm', model: 'Apeos (série)', type: 'Aguardando modelo 3D' },
];

export const SEVERITY = {
  operador: { label: 'Operador', hint: 'O próprio usuário resolve' },
  tecnico: { label: 'Técnico', hint: 'Precisa de técnico de campo' },
  servico: { label: 'Serviço', hint: 'Troca de peça ou modo de serviço' },
};
