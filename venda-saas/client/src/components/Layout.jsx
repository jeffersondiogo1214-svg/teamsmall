import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Layout({ children }) {
  const { usuario, empresa, admin, sair } = useAuth();
  const vendedor = usuario.perfil === 'vendedor';
  const classe = ({ isActive }) => (isActive ? 'ativo' : '');
  return (
    <div className="app">
      <aside className="menu">
        <div className="marca">
          <strong>{empresa.nome}</strong>
        </div>
        <nav aria-label="Principal">
          {!vendedor && <NavLink to="/" end className={classe}>Caixa (PDV)</NavLink>}
          {(admin || vendedor) && <NavLink to="/pedidos" className={classe}>Pedidos</NavLink>}
          {!vendedor && <NavLink to="/vendas" className={classe}>Vendas</NavLink>}
          {admin && <NavLink to="/produtos" className={classe}>Produtos</NavLink>}
          {(admin || vendedor) && <NavLink to="/clientes" className={classe}>Clientes</NavLink>}
          {admin && <NavLink to="/configuracoes" className={classe}>Configurações</NavLink>}
        </nav>
        <div className="usuario">
          <span>{usuario.nome}</span>
          <small>{({ admin: 'Administrador', caixa: 'Caixa', vendedor: 'Vendedor' })[usuario.perfil]}</small>
          <button className="link" onClick={sair}>Sair</button>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
