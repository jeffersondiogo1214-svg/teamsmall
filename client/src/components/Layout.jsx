import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const I = {
  pdv: 'M3 6h18M3 12h18M3 18h11',
  pedidos: 'M9 5h10M9 12h10M9 19h10M4 5h.01M4 12h.01M4 19h.01',
  vendas: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  produtos: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8',
  clientes: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8',
  config: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  sair: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
};
I.dashboard = 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z';
I.relatorio = 'M4 19V5M4 19h17M8 15l3-4 3 2 5-7';
I.caixa = 'M3 6h18v13H3zM7 6V4h10v2M12 10v5M9 13h6';
I.assistente = 'M9 3h6l1 3h3v15H5V6h3l1-3zM9 10h6M9 14h6';
I.compras = 'M6 7h15l-2 8H8L6 3H3M9 20h.01M18 20h.01';
I.estoque = 'M3 6h18v13H3zM3 10h18M8 14h3';
I.custos = 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5';
I.catalogo = 'M4 6h16v12H4zM8 10h8M8 14h5';
I.faturamento = 'M6 2h9l4 4v16H6zM15 2v5h5M9 11h7M9 15h7';
I.fiscal = 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h3';
I.producao = 'M4 21V10l8-6 8 6v11M8 21v-7h8v7';
I.entrega = 'M3 6h11v11H3zM14 10h4l3 3v4h-7M7 20a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4z';
I.financeiro = 'M3 10h18M5 10v7M9 10v7M15 10v7M19 10v7M2 21h20M12 3l9 5H3l9-5z';
I.bi = 'M4 19V5M4 19h16M8 15l3-3 3 1 4-6';
I.integracoes = 'M10 13a5 5 0 007 7l3-3-5-5M14 11a5 5 0 00-7-7l-3 3 5 5';

const Icone = ({ d }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export default function Layout({ children }) {
  const { usuario, empresa, admin, sair } = useAuth();
  const { pathname } = useLocation();
  const vendedor = usuario.perfil === 'vendedor';
  const classe = ({ isActive }) => (isActive ? 'ativo' : '');
  const itens = [
    admin && { to: '/', end: true, nome: 'Dashboard', ic: I.dashboard, grupo: 'Principal' },
    admin && { to: '/assistente-ia', nome: 'Assistente IA', ic: I.assistente, grupo: 'Principal', badge: true },
    admin && { to: '/produtos', nome: 'Cadastros', ic: I.produtos, grupo: 'Cadastros' },
    admin && { to: '/compras', nome: 'Compras', ic: I.compras, grupo: 'Operação' },
    admin && { to: '/estoque', nome: 'Estoque', ic: I.estoque, grupo: 'Operação' },
    admin && { to: '/custos-tabelas', nome: 'Custos e tabelas', ic: I.custos, grupo: 'Operação' },
    admin && { to: '/catalogo', nome: 'Catálogo virtual', ic: I.catalogo, grupo: 'Operação' },
    admin && { to: '/faturamento/pedidos', nome: 'Faturamento', ic: I.faturamento, grupo: 'Operação' },
    admin && { to: '/fiscal', nome: 'Fiscal', ic: I.fiscal, grupo: 'Operação' },
    admin && { to: '/producao', nome: 'Produção', ic: I.producao, grupo: 'Operação' },
    admin && { to: '/entrega', nome: 'Entrega', ic: I.entrega, grupo: 'Operação' },
    admin && { to: '/financeiro', nome: 'Financeiro', ic: I.financeiro, grupo: 'Gestão' },
    admin && { to: '/bi', nome: 'B.I.', ic: I.bi, grupo: 'Gestão' },
    admin && { to: '/relatorios', nome: 'Relatórios', ic: I.relatorio, grupo: 'Gestão' },
    admin && { to: '/integracoes', nome: 'Integrações', ic: I.integracoes, grupo: 'Gestão' },
    !vendedor && { to: admin ? '/pdv' : '/', end: true, nome: 'PDV', ic: I.pdv, grupo: 'Operação' },
    !vendedor && { to: '/caixa', nome: 'Abertura/fechamento', ic: I.caixa, grupo: 'Operação' },
    (admin || vendedor) && { to: '/pedidos', nome: 'Pedidos', ic: I.pedidos, grupo: 'Operação' },
    !vendedor && { to: '/vendas', nome: 'Vendas', ic: I.vendas, grupo: 'Operação' },
    (admin || vendedor) && { to: '/clientes', nome: 'Clientes', ic: I.clientes, grupo: 'Cadastros' },
    admin && { to: '/configuracoes', nome: 'Configurações', ic: I.config, grupo: 'Sistema' },
  ].filter(Boolean);
  const grupos = [...new Set(itens.map((i) => i.grupo))];
  const atual = itens.find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
  const perfil = ({ admin: 'Administrador', caixa: 'Caixa', vendedor: 'Vendedor' })[usuario.perfil];
  const iniciais = usuario.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="app">
      <aside className="menu">
        <div className="marca"><strong>{empresa.nome}</strong></div>
        <nav aria-label="Principal">
          {grupos.map((g) => (
            <div className="grupo" key={g}>
              <span className="grupo-titulo">{g}</span>
              {itens.filter((i) => i.grupo === g).map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} className={classe}>
                  <Icone d={i.ic} /><span>{i.nome}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="usuario">
          <span className="avatar">{iniciais}</span>
          <div className="usuario-txt"><span>{usuario.nome}</span><small>{perfil}</small></div>
          <button className="sair" onClick={sair} title="Sair" aria-label="Sair"><Icone d={I.sair} /></button>
        </div>
      </aside>
      <div className="conteudo">
        <header className="barra">
          <div>
            <small className="barra-data">{hoje}</small>
            <div className="barra-titulo">{atual?.nome || empresa.nome}</div>
          </div>
          <div className="barra-acoes">
            <label className="barra-busca"><span>⌕</span><input placeholder="Pesquisar no menu (F1)" aria-label="Pesquisar no menu" /></label>
            <button className="barra-ajuda" title="Ajuda" aria-label="Ajuda">?</button>
            <div className="barra-usuario"><span className="avatar">{iniciais}</span></div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
