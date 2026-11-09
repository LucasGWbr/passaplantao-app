export const fichaLabels = {
  "consciencia": "Consciência",
  "dor": "Dor",
  "local_dor": "Local da dor",
  "respiracao": "Padrão respiratório",
  "dieta": "Dieta",
  "acesso": "Acesso venoso",
  "utero": "Útero",
  "loquios": "Lóquios",
  "curativo": "Curativo",
  "local_curativo": "Local / aspecto do curativo",
  "eliminacao_vesical": "Eliminação vesical",
  "quantidade_svd": "Quantidade / irrigação",
  "eliminacao_intestinal": "Eliminação intestinal",
  "pa": "PA",
  "fc": "FC",
  "fr": "FR",
  "tax": "Temperatura",
  "sat": "Saturação",
  "hgt": "HGT",
  "rn_sexo": "Sexo do RN",
  "rn_dieta": "Dieta do RN",
  "rn_diurese": "Diurese",
  "rn_meconio": "Mecônio",
  "rn_sinais": "Sinais vitais do RN",
  "oxigenio": "Oxigênio (L/min)",
  "dieta_detalhe": "Dieta / velocidade (ml/h)",
  "acesso_detalhe": "Acesso / infusão (ml/h)",
  "abdomen": "Abdômen",
  "curativo_detalhe": "Local / aspecto do curativo",
  "dreno": "Drenos",
  "dreno_detalhe": "Secreção / quantidade",
  "eliminacao_vesical_detalhe": "Débito / detalhe",
  "clinica": "Clínica / cirúrgica",
  "obstetrica": "Obstetrícia",
  "intercorrencias": "Intercorrências"
};

// Ordem de leitura independente da ordem em que as respostas foram preenchidas.
const grupos = [
  ['Estado e conforto', ['consciencia', 'dor', 'local_dor']],
  ['Respiração', ['respiracao', 'oxigenio']],
  ['Sinais vitais', ['pa', 'fc', 'fr', 'tax', 'sat', 'hgt']],
  ['Alimentação e abdômen', ['dieta', 'dieta_detalhe', 'abdomen']],
  ['Acessos, curativos e drenos', ['acesso', 'acesso_detalhe', 'curativo', 'local_curativo', 'curativo_detalhe', 'dreno', 'dreno_detalhe']],
  ['Eliminações', ['eliminacao_vesical', 'eliminacao_vesical_detalhe', 'quantidade_svd', 'eliminacao_intestinal']],
  ['Avaliação materna', ['utero', 'loquios']],
  ['Recém-nascido', ['rn_sexo', 'rn_dieta', 'rn_diurese', 'rn_meconio', 'rn_sinais']],
  ['Intercorrências', ['intercorrencias']],
];

export function agruparFicha(ficha = {}) {
  const preenchido = (valor) => valor !== null && valor !== undefined && String(valor).trim() !== '';
  const conhecidos = new Set(grupos.flatMap(([, campos]) => campos));
  const resultado = grupos.map(([titulo, campos]) => ({
    titulo,
    campos: campos.filter((campo) => preenchido(ficha[campo])).map((campo) => ({ campo, rotulo: fichaLabels[campo] ?? campo.replaceAll('_', ' '), valor: String(ficha[campo]) })),
  })).filter((grupo) => grupo.campos.length);
  const outros = Object.entries(ficha).filter(([campo, valor]) => !conhecidos.has(campo) && preenchido(valor))
    .map(([campo, valor]) => ({ campo, rotulo: fichaLabels[campo] ?? campo.replaceAll('_', ' '), valor: String(valor) }));
  if (outros.length) resultado.push({ titulo: 'Outras informações', campos: outros });
  return resultado;
}
