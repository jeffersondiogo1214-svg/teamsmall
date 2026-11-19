import { useState } from 'react';
import { useParams } from 'react-router-dom';

const dados = {
  compras: ['Pedidos de compra', 'Entradas', 'Fornecedores', 'Cotações'],
  custos: ['Tabela de custos', 'Custo médio', 'Margem por produto', 'Promoções'],
  catalogo: ['Produtos publicados', 'Categorias', 'Páginas', 'Pedidos online'],
  faturamento: ['Orçamento', 'Pedido de venda', 'Pedido de representante', 'Pedidos pendentes faturamento', 'Conferência de pedidos', 'Meta de vendas', 'Fatura', 'Consignado', 'Devolução de produtos', 'Vendas online'],
  fiscal: ['Notas fiscais', 'Documentos autorizados', 'Rejeições', 'Configuração tributária'],
  producao: ['Ordens de produção', 'Apontamentos', 'Materiais', 'Produtos acabados'],
  entrega: ['Entregas abertas', 'Rotas', 'Motoristas', 'Comprovantes'],
  financeiro: ['Contas a pagar', 'Contas a receber', 'Fluxo de caixa', 'Conciliação'],
  bi: ['Visão geral', 'Vendas', 'Clientes', 'Produtos', 'Margens'],
  integracoes: ['Marketplace', 'Entrega', 'E-commerce', 'APIs'],
  assistente: ['Perguntar ao assistente', 'Resumo do dia', 'Análise de vendas', 'Sugestões'],
};

export default function Modulo({ nome, descricao, tipo }) {
  const params = useParams();
  const opcoes = dados[tipo] || [];
  const [aba, setAba] = useState(params.secao ? params.secao.replaceAll('-', ' ') : opcoes[0]);

  return (
    <div className="pagina-modulo">
      <div className="topo">
        <div><h1>{nome}</h1><small>{descricao}</small></div>
        {tipo !== 'assistente' && <button className="btn primario" onClick={() => window.dispatchEvent(new CustomEvent('toast', { detail: 'Novo registro preparado.' }))}>Novo registro</button>}
      </div>
      {tipo === 'assistente' ? (
        <section className="ia-painel card">
          <div className="ia-cabecalho"><span className="ia-avatar">IA</span><div><b>Assistente de negócios</b><small className="bloco">Analise dados e receba recomendações</small></div></div>
          <div className="ia-conversa">
            <div className="mensagem ia">Olá! Posso analisar suas vendas, estoque, clientes e metas. O que você deseja consultar?</div>
            {['Resumo das vendas de hoje', 'Produtos com estoque baixo', 'Como estão minhas metas'].map((x) => <button className="sugestao-ia" key={x} onClick={() => window.dispatchEvent(new CustomEvent('toast', { detail: `Consulta enviada: ${x}` }))}>{x}</button>)}
          </div>
          <form className="ia-entrada" onSubmit={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('toast', { detail: 'Sua pergunta foi enviada ao assistente.' })); e.currentTarget.reset(); }}><input aria-label="Pergunte ao assistente" placeholder="Pergunte sobre seu negócio..." /><button className="btn primario">Enviar</button></form>
        </section>
      ) : (
        <>
          <div className="abas-modulo">{opcoes.map((item) => <button key={item} className={aba === item ? 'ativa' : ''} onClick={() => setAba(item)}>{item}</button>)}</div>
          <section className="modulo-grid">
            {['Itens disponíveis', 'Em andamento', 'Pendências'].map((titulo, index) => (
              <article className="card modulo-card" key={titulo}>
                <div className="modulo-card-cab"><h2>{titulo}</h2><b>{[opcoes.length, 3, index === 2 ? 0 : 1][index]}</b></div>
                {index === 2 ? <div className="vazio-card">Nenhuma pendência no momento.</div> : opcoes.slice(index * 2, index * 2 + 3).map((item) => <button className="modulo-item" key={item} onClick={() => setAba(item)}><span>{item}</span><small>Gerenciar</small></button>)}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
