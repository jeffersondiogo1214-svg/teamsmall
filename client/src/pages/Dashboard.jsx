import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { brl, dataHora } from '../utils.js';

export default function Dashboard() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    const carregar = () => api('/dashboard')
      .then((r) => { if (ativo) { setDados(r); setErro(''); } })
      .catch((e) => { if (ativo) setErro(e.message); });
    carregar();
    const timer = window.setInterval(carregar, 60000);
    return () => { ativo = false; window.clearInterval(timer); };
  }, []);

  if (erro) return <div><h1>Painel do negócio</h1><div className="alerta espaco-abaixo">{erro}</div><button className="btn" onClick={() => window.location.reload()}>Tentar novamente</button></div>;
  if (!dados) return <div className="carregando">Carregando o resumo do negócio…</div>;

  const totalSemana = dados.semana.reduce((s, d) => s + Number(d.total), 0);
  const maiorDia = Math.max(1, ...dados.semana.map((d) => Number(d.total)));

  return (
    <div>
      <div className="topo">
        <div><h1>Painel do negócio</h1><small>Resumo das vendas de hoje e dos últimos 7 dias</small></div>
        <Link className="btn primario" to="/relatorios">Abrir relatórios</Link>
      </div>
      <section className="metricas">
        <article className="card metrica"><span>Vendas hoje</span><b>{dados.resumo.quantidade}</b></article>
        <article className="card metrica"><span>Faturamento líquido hoje</span><b>{brl(dados.resumo.total)}</b></article>
        <article className="card metrica"><span>Ticket médio</span><b>{brl(dados.resumo.ticket_medio)}</b></article>
        <article className="card metrica"><span>Vendas na semana</span><b>{brl(totalSemana)}</b></article>
      </section>

      <section className="dashboard-colunas">
        <div className="card">
          <h2>Vendas nos últimos 7 dias</h2>
          <div className="grafico-semana" role="img" aria-label="Gráfico de vendas dos últimos sete dias">
            {dados.semana.map((dia) => (
              <div className="grafico-dia" key={dia.dia} title={`${dia.dia}: ${brl(dia.total)}`}>
                <div className="grafico-barra-wrap"><div className="grafico-barra" style={{ height: `${Math.max(Number(dia.total) ? 4 : 0, Number(dia.total) / maiorDia * 100)}%` }} /></div>
                <b>{brl(dia.total)}</b>
                <small>{new Date(`${dia.dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Produtos mais vendidos hoje</h2>
          {dados.produtos.length ? (
            <ol className="lista-resumo">
              {dados.produtos.map((p) => <li key={p.descricao}><span>{p.descricao}<small>{Number(p.quantidade).toLocaleString('pt-BR')} un.</small></span><b>{brl(p.total)}</b></li>)}
            </ol>
          ) : <div className="vazio-card">Ainda não há vendas concluídas hoje.</div>}
        </div>
      </section>
      <div className="acoes">
        <Link className="btn" to="/caixa">Abrir ou fechar caixa</Link>
        <Link className="btn" to="/vendas">Consultar vendas</Link>
      </div>
      <p className="suave">Valores atualizados em {dataHora(new Date().toISOString())}.</p>
    </div>
  );
}
