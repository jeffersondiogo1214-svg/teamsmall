import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { FormCadastro } from '../components/Cadastro.jsx';

const camposUsuario = [
  { k: 'nome', t: 'Nome', req: true, full: true },
  { k: 'email', t: 'E-mail', tipo: 'email', req: true, full: true, soNovo: true },
  { k: 'perfil', t: 'Perfil', tipo: 'select', full: true, opcoes: [['caixa', 'Caixa: finaliza vendas e cadastra clientes'], ['vendedor', 'Vendedor: monta pedidos para o caixa'], ['admin', 'Administrador: acesso total']] },
  { k: 'comissao_percentual', t: 'Comissão individual (%)', tipo: 'number', step: '0.01', nullable: true, dica: 'Somente vendedores. Em branco usa o percentual padrão da empresa.', mostrarSe: (f) => f.perfil === 'vendedor' },
  { k: 'senha', t: 'Senha', tipo: 'password', full: true, reqNovo: true, dica: 'Mínimo de 8 caracteres. Ao editar, deixe em branco para manter a atual.' },
  { k: 'ativo', t: 'Usuário ativo', tipo: 'check', soEdicao: true },
];

export default function Configuracoes() {
  const { empresa, setEmpresa } = useAuth();
  const [f, setF] = useState({
    nome: empresa.nome, documento: empresa.documento || '', telefone: empresa.telefone || '',
    endereco: empresa.endereco || '', comissao_percentual: empresa.comissao_percentual || 0,
  });
  const [erro, setErro] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(null);

  const carregar = useCallback(() => api('/usuarios').then(setUsuarios).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  const mudar = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      setEmpresa(await api('/empresa', { method: 'PUT', body: f }));
      window.dispatchEvent(new CustomEvent('toast', { detail: 'Dados da empresa salvos com sucesso.' }));
    } catch (err) {
      setErro(err.message);
    }
  };

  return (
    <div>
      <div className="topo"><h1>Configurações</h1></div>
      {erro && <div className="alerta">{erro}</div>}

      <form className="card form" onSubmit={salvar}>
        <h2 className="full">Dados da empresa</h2>
        <label className="full">Nome<input value={f.nome} onChange={mudar('nome')} required minLength={2} /></label>
        <label>CNPJ ou CPF<input value={f.documento} onChange={mudar('documento')} /></label>
        <label>Telefone<input value={f.telefone} onChange={mudar('telefone')} /></label>
        <label className="full">Endereço<input value={f.endereco} onChange={mudar('endereco')} /></label>
        <label>Comissão padrão dos vendedores (%)<input type="number" min="0" max="100" step="0.01" value={f.comissao_percentual} onChange={mudar('comissao_percentual')} /></label>
        <div className="acoes full"><button className="btn primario">Salvar dados</button></div>
      </form>

      <div className="topo espaco">
        <h2>Usuários</h2>
        <button className="btn primario" onClick={() => setForm({ perfil: 'caixa', ativo: true })}>Novo usuário</button>
      </div>
      <div className="card tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Comissão</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.ativo ? '' : 'inativo'}>
                <td>{u.nome}</td>
                <td>{u.email}</td>
                <td>{({ admin: 'Administrador', caixa: 'Caixa', vendedor: 'Vendedor' })[u.perfil]}</td>
                <td>{u.perfil === 'vendedor' ? `${u.comissao_percentual ?? empresa.comissao_percentual ?? 0}%` : '—'}</td>
                <td>{u.ativo ? 'Ativo' : 'Inativo'}</td>
                <td className="dir"><button className="link" onClick={() => setForm({ ...u, senha: '' })}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <FormCadastro
          titulo={form.id ? 'Editar usuário' : 'Novo usuário'}
          campos={camposUsuario}
          inicial={form}
          rota="/usuarios"
          onClose={() => setForm(null)}
          onSalvo={() => {
            setForm(null);
            carregar();
            window.dispatchEvent(new CustomEvent('toast', { detail: 'Usuário salvo com sucesso.' }));
          }}
        />
      )}
    </div>
  );
}
