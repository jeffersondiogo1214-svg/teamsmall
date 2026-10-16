import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { brl, dataHora } from '../utils.js';

export default function Caixa() {
  const [caixa, setCaixa] = useState(null);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState('');
  const [abertura, setAbertura] = useState('');
  const [contado, setContado] = useState('');
  const [movimento, setMovimento] = useState({ tipo: 'reforco', valor: '', descricao: '' });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCaixa(await api('/caixa/atual'));
      setErro('');
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregado(true);
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const executar = async (acao, mensagem = 'Operação de caixa registrada.') => {
    setSalvando(true);
    setErro('');
    try {
      const resultado = await acao();
      await carregar();
      window.dispatchEvent(new CustomEvent('toast', {
        detail: typeof mensagem === 'function' ? mensagem(resultado) : mensagem,
      }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const abrir = (e) => {
    e.preventDefault();
    executar(async () => {
      await api('/caixa/abrir', { method: 'POST', body: { valorAbertura: Number(abertura) || 0 } });
      setAbertura('');
    }, 'Caixa aberto com sucesso.');
  };
  const registrarMovimento = (e) => {
    e.preventDefault();
    executar(async () => {
      await api('/caixa/movimentos', { method: 'POST', body: { ...movimento, valor: Number(movimento.valor) } });
      setMovimento({ tipo: 'reforco', valor: '', descricao: '' });
    }, 'Movimentação registrada com sucesso.');
  };
  const fechar = (e) => {
    e.preventDefault();
    if (!window.confirm('Fechar o caixa agora? As vendas não poderão ser registradas até abrir um novo caixa.')) return;
    executar(async () => {
      const resultado = await api('/caixa/fechar', { method: 'POST', body: { valorContado: Number(contado) || 0 } });
      setContado('');
      return resultado;
    }, (resultado) => `Caixa fechado. Diferença: ${brl(resultado.diferenca)}.`);
  };

  if (!carregado) return <div className="carregando">Carregando situação do caixa…</div>;
  return (
    <div>
      <div className="topo"><h1>Abertura e fechamento de caixa</h1></div>
      {erro && <div className="alerta espaco-abaixo">{erro}</div>}
      {!caixa ? (
        <form className="card caixa-abertura" onSubmit={abrir}>
          <h2>Abrir caixa</h2>
          <p>Informe o valor de troco inicial. É necessário manter um caixa aberto para registrar vendas e recebimentos.</p>
          <label>Troco inicial (R$)<input type="number" min="0" step="0.01" value={abertura} onChange={(e) => setAbertura(e.target.value)} required /></label>
          <button className="btn primario" disabled={salvando}>{salvando ? 'Abrindo…' : 'Abrir caixa'}</button>
        </form>
      ) : (
        <>
          <section className="metricas">
            <article className="card metrica"><span>Aberto desde</span><b className="metrica-menor">{dataHora(caixa.aberto_em)}</b></article>
            <article className="card metrica"><span>Troco inicial</span><b>{brl(caixa.valor_abertura)}</b></article>
            <article className="card metrica"><span>Saldo esperado</span><b>{brl(caixa.valor_esperado)}</b></article>
          </section>
          <form className="card form caixa-movimento" onSubmit={registrarMovimento}>
            <h2 className="full">Registrar reforço ou retirada</h2>
            <label>Operação<select value={movimento.tipo} onChange={(e) => setMovimento((s) => ({ ...s, tipo: e.target.value }))}><option value="reforco">Reforço de caixa</option><option value="retirada">Retirada / sangria</option></select></label>
            <label>Valor (R$)<input type="number" min="0.01" step="0.01" value={movimento.valor} onChange={(e) => setMovimento((s) => ({ ...s, valor: e.target.value }))} required /></label>
            <label className="full">Motivo<input value={movimento.descricao} onChange={(e) => setMovimento((s) => ({ ...s, descricao: e.target.value }))} minLength={2} required /></label>
            <div className="acoes full"><button className="btn primario" disabled={salvando}>Registrar movimentação</button></div>
          </form>
          <div className="topo espaco"><h2>Movimentações do caixa</h2></div>
          <div className="card tabela-wrap">
            <table className="tabela"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th className="dir">Valor</th></tr></thead>
              <tbody>{caixa.movimentos.map((m) => <tr key={m.id}><td>{dataHora(m.criado_em)}</td><td>{({ abertura: 'Troco inicial', reforco: 'Reforço', retirada: 'Retirada', venda: 'Venda', cobranca: 'Recebimento de fiado', devolucao: 'Reembolso' })[m.tipo]}</td><td>{m.descricao || '—'}</td><td className="dir">{brl(m.valor)}</td></tr>)}
                {!caixa.movimentos.length && <tr><td colSpan="4" className="vazio">Nenhuma movimentação registrada ainda.</td></tr>}</tbody></table>
          </div>
          <form className="card form espaco-cima" onSubmit={fechar}>
            <h2 className="full">Conferir e fechar caixa</h2>
            <label>Dinheiro contado (R$)<input type="number" min="0" step="0.01" value={contado} onChange={(e) => setContado(e.target.value)} required /></label>
            <label>Saldo esperado (R$)<input value={brl(caixa.valor_esperado)} disabled readOnly /></label>
            <div className="acoes full"><button className="btn perigo" disabled={salvando}>{salvando ? 'Fechando…' : 'Fechar caixa'}</button></div>
          </form>
        </>
      )}
    </div>
  );
}
