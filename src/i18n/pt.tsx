// Textos da interface em português do Brasil. Deve ter todas as chaves de
// `en.tsx` (o tipo `Dictionary` garante). Sem travessão no que o visitante lê.
import type { Dictionary } from "./index";

export const pt: Dictionary = {
  lang: "pt-BR",
  name: "Português",
  short: "PT",

  common: {
    language: "Idioma",
    pages: "Páginas",
    themeLight: "Mudar para o tema claro",
    themeDark: "Mudar para o tema escuro",
    source: "Código no GitHub",
    home: "Início do RAGui",
  },

  nav: {
    lab: "Laboratório",
  },

  home: {
    sentence: "Um sandbox para montar um RAG sobre qualquer assunto, com cada etapa do pipeline na tela.",
    open: "Abrir o laboratório",
    points: [
      {
        title: "O código recupera",
        body: "Divisão em trechos, embeddings, similaridade, ranking e contexto são funções simples que rodam no seu navegador. Mesmos documentos, mesma pergunta, mesmas configurações: mesmo contexto.",
      },
      {
        title: "O modelo escreve",
        body: "Um modelo recebe os trechos que o código escolheu e escreve a resposta, citando cada um. Ele nunca decide o que ler.",
      },
      {
        title: "Você vê tudo",
        body: "Cada execução deixa um registro das suas etapas, e a interface o reproduz. Nada se move na tela sem ter sido calculado.",
      },
    ],
  },

  lab: {
    sandbox: "Sandbox",
    sample: "exemplo",
    scaffold: {
      title: "Nada roda ainda",
      body: "Este é o esqueleto do laboratório. As etapas abaixo são o pipeline como está definido, com as configurações deste sandbox; o código de cada uma vem a seguir.",
    },
    pipeline: "Pipeline",
    groups: {
      ingest: { name: "Indexação", hint: "roda quando os documentos ou a divisão mudam" },
      query: { name: "Pergunta", hint: "roda a cada pergunta" },
    },
    documents: "Documentos",
    openDocument: (name) => `Abrir ${name} em outra aba`,
    tests: "Perguntas de teste",
    testsHint: "Cada uma tem resposta conhecida, então a recuperação é avaliada por código: passa quando um trecho recuperado contém o texto esperado.",
    expected: "esperado",
    stage: (n, total) => `Etapa ${n} de ${total}`,
    formula: "O que calcula",
    knobs: "Configurações que lê",
    noKnobs: "Esta etapa não tem configurações.",
    by: {
      code: { tag: "código", hint: "Calculada por uma função pura: a mesma entrada sempre dá a mesma saída." },
      model: { tag: "modelo", hint: "A única etapa em que o modelo participa." },
    },
    notCalibrated: "não calibrado",
  },

  presets: {
    lease: {
      name: "Contrato de locação",
      description: "O trabalho da disciplina: um contrato de locação residencial de três páginas e as quatro perguntas feitas sobre ele.",
    },
  },

  stages: {
    load: {
      name: "Carregar",
      what: "Lê o arquivo e extrai o texto. O PDF é interpretado no navegador; nada é enviado.",
    },
    clean: {
      name: "Limpar",
      what: "Normaliza o texto: quebras de linha, espaços repetidos, palavras partidas entre linhas, ligaduras e símbolos soltos deixados pelo PDF. Toda posição usada depois se refere a este texto.",
    },
    chunk: {
      name: "Dividir",
      what: "Corta o texto em trechos pequenos o bastante para gerar embeddings e para citar. Onde o corte cai decide o que pode ser encontrado.",
    },
    embed: {
      name: "Embeddings",
      what: "Transforma cada trecho em um vetor de 384 números com um modelo que roda no navegador. Trechos de sentido parecido ficam com vetores parecidos.",
    },
    index: {
      name: "Indexar",
      what: "Guarda os vetores e as estatísticas das palavras, e projeta os vetores em duas dimensões para o mapa.",
    },
    query: {
      name: "Pergunta",
      what: "Gera o embedding da pergunta com o mesmo modelo, para que ela caia no mesmo espaço dos trechos.",
    },
    dense: {
      name: "Busca densa",
      what: "Compara o vetor da pergunta com o de cada trecho e fica com os mais próximos. Encontra o sentido, mesmo com palavras diferentes.",
    },
    sparse: {
      name: "Busca por palavras",
      what: "Pontua os trechos pelas palavras em comum com a pergunta, com peso maior para as mais raras. Encontra nomes, códigos e números exatos.",
    },
    fuse: {
      name: "Fundir",
      what: "Junta os dois rankings pela posição, já que as pontuações não são comparáveis entre si.",
    },
    diversify: {
      name: "Diversificar",
      what: "Descarta trechos que repetem um já escolhido, para o contexto não ser a mesma frase várias vezes.",
    },
    gate: {
      name: "Barreira",
      what: "Se nada está perto o bastante da pergunta, a execução para aqui e o modelo não é chamado.",
    },
    assemble: {
      name: "Montar",
      what: "Encaixa os melhores trechos no prompt dentro de um limite de tokens e os numera para citação.",
    },
    generate: {
      name: "Gerar",
      what: "O modelo escreve a resposta usando apenas os trechos numerados, citando cada afirmação.",
    },
    verify: {
      name: "Verificar",
      what: "Relê a resposta: toda citação precisa apontar para um trecho que foi enviado, e frases sem citação são marcadas.",
    },
  },

  knobs: {
    strategy: "Estratégia",
    size: "Tamanho do trecho, em caracteres",
    overlap: "Sobreposição, em caracteres",
    model: "Modelo de embeddings",
    dtype: "Precisão",
    device: "Backend",
    mode: "Modo de busca",
    k: "Candidatos por busca (k)",
    k1: "k₁, saturação do termo",
    b: "b, normalização pelo tamanho",
    rrfK: "Constante da fusão (k)",
    lambda: "λ, relevância contra diversidade",
    threshold: "Limiar (τ)",
    sources: "Máximo de fontes",
    budget: "Limite, em tokens",
    order: "Ordem das fontes",
    llm: "Modelo",
    temperature: "Temperatura",
    seed: "Semente",
    maxOutputTokens: "Limite da saída, em tokens",
  },

  footer: {
    by: "por",
    course: (name, school, term) => `${name}, ${school} ${term}`,
  },

  notFound: {
    title: "Página não encontrada",
    body: "Não há nada neste endereço.",
    home: "Voltar ao início",
  },
};
