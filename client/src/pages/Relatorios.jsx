import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { arred, brl, hoje } from '../utils.js';

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function Relatorios() {
  const [de, setDe] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  });
  const [ate, setAte] = useState(hoje);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      setDados(await api(`/relatorios?de=${de}&ate=${ate}`));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [de, ate]);

  useEffect(() => { carregar(); }, [carregar]);

  const baixar = () => {
    const linhas = [['Grupo', 'Descrição', 'Quantidade', 'Valor', 'Percentual']];
    for (const v of dados.vendas) linhas.push(['Venda', `${v.numero} - ${v.cliente_nome || 'Consumidor final'}`, '', v.liquido, '']);
    for (const v of dados.vendedores) linhas.push(['Vendedor', v.vendedor, '', v.comissao, `${v.percentual}%`]);
    for (const p of dados.pagamentos) linhas.push(['Pagamento', p.forma, '', p.recebido, '']);
    for (const p of dados.produtos) linhas.push(['Produto', `${p.codigo} - ${p.descricao}`, p.quantidade, p.liquido, '']);
    const conteudo = `\uFEFF${linhas.map((linha) => linha.map(csvEscape).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-vendas-${de}-${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="topo"><h1>Relatórios</h1></div>
      <div className="filtros">
        <label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        <button className="btn primario alinhar-fim" onClick={carregar} disabled={carregando}>{carregando ? 'Atualizando…' : 'Aplicar período'}</button>
        {dados && <button className="btn alinhar-fim" onClick={baixar}>Baixar planilha CSV</button>}
        {dados && <button className="btn alinhar-fim" onClick={() => window.print()}>Imprimir / salvar PDF</button>}
      </div>
      {erro && <div className="alerta espaco-abaixo">{erro}</div>}
      {carregando && !dados && <div className="carregando">Carregando relatórios…</div>}
      {dados && (
        <>
          <div className="metricas">
            <article className="card metrica"><span>Vendas concluídas</span><b>{dados.vendas.length}</b></article>
            <article className="card metrica"><span>Faturamento líquido</span><b>{brl(dados.vendas.reduce((s, v) => s + Number(v.liquido), 0))}</b></article>
            <article className="card metrica"><span>Comissões calculadas</span><b>{brl(dados.vendedores.reduce((s, v) => s + Number(v.comissao), 0))}</b></article>
          </div>
          <section className="relatorios-grid">
            <div className="card tabela-wrap"><h2 className="titulo-card">Vendas por vendedor e comissão</h2>
              <table className="tabela"><thead><tr><th>Vendedor</th><th className="dir">Vendido líquido</th><th className="dir">Comissão</th></tr></thead>
                <tbody>{dados.vendedores.map((v) => <tr key={v.vendedor}><td>{v.vendedor}<small className="bloco suave">Percentual: {v.percentual}%</small></td><td className="dir">{brl(v.liquido)}</td><td className="dir"><b>{brl(v.comissao)}</b></td></tr>)}
                  {!dados.vendedores.length && <tr><td colSpan="3" className="vazio">Sem vendas neste período.</td></tr>}</tbody></table>
            </div>
            <div className="card tabela-wrap"><h2 className="titulo-card">Recebimentos por forma</h2>
              <table className="tabela"><thead><tr><th>Forma</th><th className="dir">Recebido</th></tr></thead>
                <tbody>{dados.pagamentos.map((p) => <tr key={p.forma}><td>{p.forma}</td><td className="dir">{brl(p.recebido)}</td></tr>)}
                  {!dados.pagamentos.length && <tr><td colSpan="2" className="vazio">Sem recebimentos neste período.</td></tr>}</tbody></table>
            </div>
            <div className="card tabela-wrap"><h2 className="titulo-card">Produtos vendidos</h2>
              <table className="tabela"><thead><tr><th>Produto</th><th className="dir">Quantidade</th><th className="dir">Líquido</th></tr></thead>
                <tbody>{dados.produtos.map((p) => <tr key={`${p.codigo}-${p.descricao}`}><td>{p.descricao}<small className="bloco suave">Código {p.codigo}</small></td><td className="dir">{Number(p.quantidade).toLocaleString('pt-BR')}</td><td className="dir">{brl(p.liquido)}</td></tr>)}
                  {!dados.produtos.length && <tr><td colSpan="3" className="vazio">Sem produtos vendidos neste período.</td></tr>}</tbody></table>
            </div>
            <div className="card tabela-wrap"><h2 className="titulo-card">Vendas no período</h2>
              <table className="tabela"><thead><tr><th>Nº</th><th>Cliente</th><th>Vendedor</th><th className="dir">Devolvido</th><th className="dir">Líquido</th></tr></thead>
                <tbody>{dados.vendas.map((v) => <tr key={v.id}><td>{String(v.numero).padStart(6, '0')}</td><td>{v.cliente_nome || 'Consumidor final'}</td><td>{v.vendedor_nome || v.usuario_nome}</td><td className="dir">{brl(v.devolvido)}</td><td className="dir"><b>{brl(v.liquido)}</b></td></tr>)}
                  {!dados.vendas.length && <tr><td colSpan="5" className="vazio">Sem vendas neste período.</td></tr>}</tbody></table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
