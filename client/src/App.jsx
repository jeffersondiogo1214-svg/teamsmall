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
import Modulo from './pages/Modulo.jsx';

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
          <Route path="/assistente-ia" element={admin ? <Modulo nome="Assistente IA" descricao="Automacoes e respostas inteligentes para o seu negocio" tipo="assistente" /> : <Navigate to="/" replace />} />
          <Route path="/compras" element={admin ? <Modulo nome="Compras" descricao="Solicitacoes, entradas e fornecedores" tipo="compras" /> : <Navigate to="/" replace />} />
          <Route path="/estoque" element={admin ? <Produtos /> : <Navigate to="/" replace />} />
          <Route path="/custos-tabelas" element={admin ? <Modulo nome="Custos e tabelas" descricao="Custos, margens, tabelas e precos" tipo="custos" /> : <Navigate to="/" replace />} />
          <Route path="/catalogo" element={admin ? <Modulo nome="Catalogo virtual" descricao="Catalogo digital e pedidos online" tipo="catalogo" /> : <Navigate to="/" replace />} />
          <Route path="/faturamento/:secao" element={admin ? <Modulo nome="Faturamento" descricao="Documentos e pedidos de faturamento" tipo="faturamento" /> : <Navigate to="/" replace />} />
          <Route path="/fiscal" element={admin ? <Modulo nome="Fiscal" descricao="Notas, documentos fiscais e tributos" tipo="fiscal" /> : <Navigate to="/" replace />} />
          <Route path="/producao" element={admin ? <Modulo nome="Producao" descricao="Ordens, materias-primas e apontamentos" tipo="producao" /> : <Navigate to="/" replace />} />
          <Route path="/entrega" element={admin ? <Modulo nome="Entrega" descricao="Rotas, expedição e entregadores" tipo="entrega" /> : <Navigate to="/" replace />} />
          <Route path="/financeiro" element={admin ? <Modulo nome="Financeiro" descricao="Contas, caixa e conciliacao" tipo="financeiro" /> : <Navigate to="/" replace />} />
          <Route path="/bi" element={admin ? <Modulo nome="B.I." descricao="Indicadores e inteligencia de negocio" tipo="bi" /> : <Navigate to="/" replace />} />
          <Route path="/integracoes" element={admin ? <Modulo nome="Integracoes" descricao="Conectores e aplicativos" tipo="integracoes" /> : <Navigate to="/" replace />} />
          {admin && <Route path="/configuracoes" element={<Configuracoes />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      {aviso && <div className="toast" role="status" aria-live="polite">{aviso}</div>}
    </>
  );
}
