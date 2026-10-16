export const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const qtd = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
export const dataHora = (s) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const arred = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const hoje = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
export const FORMAS = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito' };
