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
  const pendentes = dados.pendentes || { quantidade: 0, valor: 0 };
  const contasReceber = dados.contasReceber?.valor || 0;
  const estoqueBaixo = dados.estoque?.quantidade || 0;

  return (
    <div className="dashboard-page">
      <div className="dashboard-titulo">
        <div><h1>Dashboard</h1><small>Visão geral do seu negócio</small></div>
        <div className="dashboard-periodo"><button className="ativo">Hoje</button><button>7 dias</button><button>30 dias</button></div>
      </div>

      <section className="dashboard-grid">
        <article className="card painel-pendencias">
          <div className="painel-cabecalho"><h2>Pedidos pendentes</h2><b>faturamento</b></div>
          {pendentes.quantidade ? <div className="pendencia-lista"><b>{pendentes.quantidade} pedidos</b><span>{brl(pendentes.valor)}</span></div> : <div className="vazio-card">Não há pedidos pendentes neste período.</div>}
          <Link to="/pedidos" className="ver-mais">Ver mais →</Link>
        </article>

        <article className="card painel-financeiro">
          <div className="painel-cabecalho"><h2>Contas a pagar</h2></div>
          <div className="documento-linha cab"><span>Documento</span><span>Vencimento</span><span>Valor</span></div>
          <div className="vazio-card compacto">Nenhuma conta a pagar cadastrada.</div>
          <Link to="/financeiro" className="ver-mais">Ver mais →</Link>
        </article>

        <article className="card painel-alerta">
          <div className="painel-cabecalho"><h2>Estoque mínimo</h2></div>
          {estoqueBaixo ? <div className="pendencia-lista"><b>{estoqueBaixo} produtos</b><span>Precisam de reposição</span></div> : <div className="vazio-card">Não há produtos abaixo do mínimo.</div>}
          <Link to="/estoque" className="ver-mais">Ver mais →</Link>
        </article>

        <article className="card painel-indicador">
          <div className="painel-cabecalho"><h2>Clientes ativos</h2><select aria-label="Periodo" defaultValue="3"><option value="3">Últimos 3 dias</option></select></div>
          <strong className="indicador-numero">{dados.resumo.quantidade}</strong>
          <div className="mini-chart"><i /><i /><i /><i /><i /></div>
          <Link to="/clientes" className="ver-mais">Ver mais →</Link>
        </article>

        <article className="card painel-financeiro painel-receber">
          <div className="painel-cabecalho"><h2>Contas a receber</h2></div>
          <div className="documento-linha cab"><span>Documento</span><span>Parcela</span><span>Vencimento</span><span>Valor</span></div>
          {contasReceber > 0 ? <div className="documento-linha"><span>Saldo em aberto</span><span>1/1</span><span>Hoje</span><b>{brl(contasReceber)}</b></div> : <div className="vazio-card compacto">Nenhuma conta em aberto.</div>}
          <Link to="/financeiro" className="ver-mais">Ver mais →</Link>
        </article>

        <article className="card painel-alerta">
          <div className="painel-cabecalho"><h2>Reposição de produto acabado</h2></div>
          <div className="vazio-card">Não existem produtos acabados informados.</div>
          <Link to="/producao" className="ver-mais">Ver mais →</Link>
        </article>

        <article className="card painel-indicador">
          <div className="painel-cabecalho"><h2>Crescimento</h2><select aria-label="Periodo" defaultValue="3"><option value="3">Últimos 3 dias</option></select></div>
          <strong className="indicador-numero crescimento">0%</strong>
          <div className="mini-chart crescimento-chart"><i /><i /><i /><i /><i /></div>
        </article>

        <article className="card painel-producoes">
          <div className="painel-cabecalho"><h2>Ordens de produção atrasada</h2></div>
          <div className="vazio-card">Não existem ordens de produção atrasadas.</div>
          <Link to="/producao" className="ver-mais">Ver mais →</Link>
        </article>
      </section>
      <p className="suave dashboard-atualizado">Valores atualizados em {dataHora(new Date().toISOString())}.</p>
    </div>
  );
}
