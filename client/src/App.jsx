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
  if (carregando) return <div className="centro">Carregando…</div>;
  if (!usuario) return <Login />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={usuario.perfil === 'vendedor' ? <Navigate to="/pedidos" replace /> : <PDV />} />
        <Route path="/pedidos" element={admin || usuario.perfil === 'vendedor' ? <Pedidos /> : <Navigate to="/" replace />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/clientes" element={<Clientes />} />
        {admin && <Route path="/configuracoes" element={<Configuracoes />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
