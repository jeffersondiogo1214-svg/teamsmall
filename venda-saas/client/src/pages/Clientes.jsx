import Cadastro from '../components/Cadastro.jsx';

const campos = [
  { k: 'nome', t: 'Nome', req: true, full: true },
  { k: 'documento', t: 'CPF ou CNPJ' },
  { k: 'telefone', t: 'Telefone' },
  { k: 'email', t: 'E-mail', tipo: 'email', full: true },
  { k: 'endereco', t: 'Endereço', full: true },
];

const colunas = [
  { k: 'nome', t: 'Nome' },
  { k: 'documento', t: 'CPF ou CNPJ' },
  { k: 'telefone', t: 'Telefone' },
  { k: 'email', t: 'E-mail' },
];

export default function Clientes() {
  return <Cadastro titulo="Clientes" singular="cliente" rota="/clientes" colunas={colunas} campos={campos} vazio={{}} podeEditar />;
}
