import { useEffect, useState } from 'react';
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
import Dashboard from './pages/Dashboard.jsx';
import Relatorios from './pages/Relatorios.jsx';
import Caixa from './pages/Caixa.jsx';

export default function App() {
  const { usuario, carregando, admin } = useAuth();
  const [aviso, setAviso] = useState('');
  const vendedor = usuario?.perfil === 'vendedor';
  useEffect(() => {
    const ouvir = (e) => {
      setAviso(String(e.detail || ''));
      window.clearTimeout(ouvir.timer);
      ouvir.timer = window.setTimeout(() => setAviso(''), 3500);
    };
    window.addEventListener('toast', ouvir);
    return () => {
      window.removeEventListener('toast', ouvir);
      window.clearTimeout(ouvir.timer);
    };
  }, []);
  if (carregando) return <div className="centro">Carregando…</div>;
  if (!usuario) return <Login />;
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={vendedor ? <Navigate to="/pedidos" replace /> : admin ? <Dashboard /> : <PDV />} />
          <Route path="/pdv" element={admin ? <PDV /> : <Navigate to="/" replace />} />
          <Route path="/pedidos" element={admin || vendedor ? <Pedidos /> : <Navigate to="/" replace />} />
          <Route path="/vendas" element={!vendedor ? <Vendas /> : <Navigate to="/pedidos" replace />} />
          <Route path="/produtos" element={admin ? <Produtos /> : <Navigate to={vendedor ? '/pedidos' : '/'} replace />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/caixa" element={!vendedor ? <Caixa /> : <Navigate to="/pedidos" replace />} />
          <Route path="/relatorios" element={admin ? <Relatorios /> : <Navigate to={vendedor ? '/pedidos' : '/'} replace />} />
          {admin && <Route path="/configuracoes" element={<Configuracoes />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      {aviso && <div className="toast" role="status" aria-live="polite">{aviso}</div>}
    </>
  );
}
