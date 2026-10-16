import Cadastro from '../components/Cadastro.jsx';
import { useAuth } from '../auth.jsx';
import { brl, qtd } from '../utils.js';

const campos = [
  { k: 'codigo', t: 'Código', req: true },
  { k: 'barras', t: 'Código de barras' },
  { k: 'descricao', t: 'Descrição', req: true, full: true },
  { k: 'unidade', t: 'Unidade', req: true, dica: 'UN, KG, CX…' },
  { k: 'preco', t: 'Preço de venda (R$)', tipo: 'number', step: '0.01', req: true },
  { k: 'estoque', t: 'Estoque atual', tipo: 'number', step: 'any' },
  { k: 'controla_estoque', t: 'Controlar estoque (bloqueia a venda quando acabar)', tipo: 'check' },
  { k: 'ativo', t: 'Produto ativo', tipo: 'check', soEdicao: true },
];

const colunas = [
  { k: 'codigo', t: 'Código' },
  { k: 'descricao', t: 'Descrição' },
  { k: 'preco', t: 'Preço', dir: true, f: (p) => brl(p.preco) },
  { k: 'estoque', t: 'Estoque', dir: true, f: (p) => (p.controla_estoque ? `${qtd(p.estoque)} ${p.unidade}` : 'Sem controle') },
  { k: 'ativo', t: 'Situação', f: (p) => (p.ativo ? 'Ativo' : 'Inativo') },
];

export default function Produtos() {
  const { admin } = useAuth();
  return (
    <Cadastro
      titulo="Produtos"
      singular="produto"
      rota="/produtos"
      colunas={colunas}
      campos={campos}
      vazio={{ unidade: 'UN', estoque: 0, controla_estoque: true, ativo: true }}
      podeEditar={admin}
      rotuloRemover="Inativar"
    />
  );
}
