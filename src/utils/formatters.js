// Utilitários de formatação e validação para dados do paciente e equipe

export const NIVEIS_DEPENDENCIA = [
  {
    valor: 'Cuidados Mínimos',
    rotulo: 'Mínimos',
    descricao: 'Estável clinicamente e autossuficiente para atender necessidades básicas (higiene, alimentação, deambulação).',
    cor: '#10B981',
    fundo: '#DCFCE7',
    borda: '#86EFAC',
  },
  {
    valor: 'Cuidados Intermediários',
    rotulo: 'Intermediários',
    descricao: 'Estável clinicamente, com dependência parcial de enfermagem para higiene, alimentação ou locomoção.',
    cor: '#2563EB',
    fundo: '#DBEAFE',
    borda: '#93C5FD',
  },
  {
    valor: 'Alta Dependência',
    rotulo: 'Alta Dependência',
    descricao: 'Clinicamente estável, porém totalmente dependente da equipe de enfermagem para necessidades vitais.',
    cor: '#D97706',
    fundo: '#FEF3C7',
    borda: '#FDE68A',
  },
  {
    valor: 'Cuidados Semi-intensivos',
    rotulo: 'Semi-intensivos',
    descricao: 'Risco potencial de instabilidade das funções vitais; requer assistência de enfermagem contínua e monitorização.',
    cor: '#EA580C',
    fundo: '#FFEDD5',
    borda: '#FDBA74',
  },
  {
    valor: 'Cuidados Intensivos',
    rotulo: 'Intensivos',
    descricao: 'Paciente grave com risco iminente de morte; requer suporte ventilatório/hemodinâmico e vigilância constante.',
    cor: '#DC2626',
    fundo: '#FEE2E2',
    borda: '#FCA5A5',
  },
];

export function getDependenciaInfo(valor) {
  if (!valor) return null;
  const encontrado = NIVEIS_DEPENDENCIA.find(
    (n) => n.valor.toLowerCase() === valor.toLowerCase() || n.rotulo.toLowerCase() === valor.toLowerCase()
  );
  if (encontrado) return encontrado;
  return {
    valor,
    rotulo: valor,
    descricao: '',
    cor: '#64748B',
    fundo: '#F1F5F9',
    borda: '#CBD5E1',
  };
}

export function formatarCPF(valor) {
  if (!valor) return '';
  const numeros = valor.replace(/\D/g, '').slice(0, 11);
  if (numeros.length <= 3) return numeros;
  if (numeros.length <= 6) return `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
  if (numeros.length <= 9) return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6)}`;
  return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9, 11)}`;
}

export function limparMascara(valor) {
  if (!valor) return '';
  return valor.replace(/\D/g, '');
}

export function formatarCNS(valor) {
  if (!valor) return '';
  const numeros = valor.replace(/\D/g, '').slice(0, 15);
  if (numeros.length <= 3) return numeros;
  if (numeros.length <= 7) return `${numeros.slice(0, 3)} ${numeros.slice(3)}`;
  if (numeros.length <= 11) return `${numeros.slice(0, 3)} ${numeros.slice(3, 7)} ${numeros.slice(7)}`;
  return `${numeros.slice(0, 3)} ${numeros.slice(3, 7)} ${numeros.slice(7, 11)} ${numeros.slice(11, 15)}`;
}

export function formatarDataDigitada(valor) {
  if (!valor) return '';
  const numeros = valor.replace(/\D/g, '').slice(0, 8);
  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 4) return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4, 8)}`;
}

export function dataBrParaIso(dataBr) {
  if (!dataBr) return null;
  const limpa = dataBr.trim();
  const partes = limpa.split('/');
  if (partes.length === 3 && partes[2].length === 4) {
    const dia = partes[0].padStart(2, '0');
    const mes = partes[1].padStart(2, '0');
    const ano = partes[2];
    return `${ano}-${mes}-${dia}`;
  }
  return null;
}

export function dataIsoParaBr(dataIso) {
  if (!dataIso) return '';
  const partes = dataIso.split('-');
  if (partes.length === 3) {
    return `${partes[2].slice(0, 2)}/${partes[1]}/${partes[0]}`;
  }
  return dataIso;
}

export function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  let data;
  if (dataNascimento.includes('/')) {
    const iso = dataBrParaIso(dataNascimento);
    if (!iso) return null;
    data = new Date(iso + 'T00:00:00');
  } else {
    data = new Date(dataNascimento.split('T')[0] + 'T00:00:00');
  }

  if (isNaN(data.getTime())) return null;

  const hoje = new Date();
  let anos = hoje.getFullYear() - data.getFullYear();
  const mesAtual = hoje.getMonth();
  const mesNasc = data.getMonth();

  if (mesAtual < mesNasc || (mesAtual === mesNasc && hoje.getDate() < data.getDate())) {
    anos--;
  }

  if (anos < 0) return null;

  if (anos === 0) {
    let meses = hoje.getMonth() - data.getMonth();
    if (hoje.getDate() < data.getDate()) meses--;
    if (meses <= 0) {
      const diffTime = Math.abs(hoje.getTime() - data.getTime());
      const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
    }
    return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  }

  return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}

export function validarCPF(cpf) {
  if (!cpf) return true; // campo opcional
  const str = cpf.replace(/\D/g, '');
  if (str.length !== 11) return false;
  if (/^(\d)\1+$/.test(str)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(str.charAt(i), 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(str.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(str.charAt(i), 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(str.charAt(10), 10)) return false;

  return true;
}

