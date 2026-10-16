import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import PDV from './pages/PDV.jsx';
import Vendas from './pages/Vendas.jsx';
import Produtos from './pages/Produtos.jsx';
import Clientes from './pages/Clientes.jsx';
import Configuracoes from './pages/Configuracoes.jsx';
import Pedidos from './pages/Pedidos.jsx';

export default function App() {
  const { usuario, carregando, admin } = useAuth();
  const vendedor = usuario?.perfil === 'vendedor';
  if (carregando) return <div className="centro">Carregando…</div>;
  if (!usuario) return <Login />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={vendedor ? <Navigate to="/pedidos" replace /> : <PDV />} />
        <Route path="/pedidos" element={admin || vendedor ? <Pedidos /> : <Navigate to="/" replace />} />
        <Route path="/vendas" element={!vendedor ? <Vendas /> : <Navigate to="/pedidos" replace />} />
        <Route path="/produtos" element={admin ? <Produtos /> : <Navigate to={vendedor ? '/pedidos' : '/'} replace />} />
        <Route path="/clientes" element={<Clientes />} />
        {admin && <Route path="/configuracoes" element={<Configuracoes />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
