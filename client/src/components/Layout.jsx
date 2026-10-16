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
const Icone = ({ d }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export default function Layout({ children }) {
  const { usuario, empresa, admin, sair } = useAuth();
  const { pathname } = useLocation();
  const vendedor = usuario.perfil === 'vendedor';
  const classe = ({ isActive }) => (isActive ? 'ativo' : '');
  const itens = [
    !vendedor && { to: '/', end: true, nome: 'Caixa (PDV)', ic: I.pdv, grupo: 'Operação' },
    (admin || vendedor) && { to: '/pedidos', nome: 'Pedidos', ic: I.pedidos, grupo: 'Operação' },
    !vendedor && { to: '/vendas', nome: 'Vendas', ic: I.vendas, grupo: 'Operação' },
    admin && { to: '/produtos', nome: 'Produtos', ic: I.produtos, grupo: 'Cadastros' },
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
          <div className="barra-usuario"><span className="avatar">{iniciais}</span></div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
