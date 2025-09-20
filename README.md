### **API Data Explorer & Report Builder com Assistente de IA**

#### **1. Visão Geral e Objetivo do Produto**

O objetivo é criar uma aplicação web completa (construída com Next.js) que serve como uma interface universal para qualquer API REST. A aplicação permitirá que os usuários:

1.  **Configurem e se Conectem** a qualquer endpoint de API de forma segura.
2.  **Explorem os Dados** retornados através de uma interface de tabela dinâmica.
3.  **Utilizem um Assistente de IA** para tarefas de "tradução" e "sugestão", como renomear chaves de API para nomes legíveis ou sugerir formatos de dados.
4.  **Construam Relatórios Personalizados**, selecionando e ordenando colunas.
5.  **Exportem** esses relatórios em múltiplos formatos (JSON, CSV, PDF).

O diferencial competitivo é a **sinergia entre a automação nativa e a inteligência assistida pela IA**, otimizando para performance e minimizando custos.

#### **2. Arquitetura Funcional: O Fluxo de Trabalho Híbrido**

O processo será uma jornada de quatro etapas, onde as funções nativas fazem 90% do trabalho e a IA entra em momentos estratégicos para agregar valor.

##### **Fase 1: Configuração da Fonte de Dados (Data Source)**

Esta é a fundação. O sistema precisa saber onde buscar os dados.

1.  **Interface de Gerenciamento de Conexões (Frontend Next.js):**
    *   O usuário encontrará uma seção para "Gerenciar Fontes de Dados".
    *   Aqui, ele pode criar, editar e excluir configurações de conexão. Cada configuração pedirá:
        *   Um nome amigável (ex: "API de Clientes WordPress").
        *   A URL base do endpoint.
        *   O método de autenticação (ex: Bearer Token, Usuário/Senha de Aplicativo, Chave de API).
        *   Os campos para as credenciais necessárias.

2.  **Armazenamento e Conexão Segura (Backend - API Routes do Next.js):**
    *   As credenciais são enviadas para o backend, **criptografadas** e salvas em um banco de dados associado à conta do usuário.
    *   Uma API Route de "teste de conexão" permite validar as credenciais. A chamada real para a API externa sempre acontece no backend (atuando como um proxy seguro), nunca expondo as credenciais ao navegador.

##### **Fase 2: Execução da Consulta e Análise Assistida por IA**

Esta é a etapa onde a sinergia acontece.

1.  **Interface de Consulta (Frontend Next.js):**
    *   O usuário seleciona uma "Fonte de Dados" previamente configurada.
    *   Ele tem acesso a um construtor de consultas para adicionar parâmetros, headers e um corpo de requisição (para POST/PUT).
    *   Ele clica em "Executar Consulta".

2.  **Processamento Híbrido (Backend - API Route do Next.js):**
    *   **Passo 1 (Nativo):** A API Route recebe a requisição, anexa as credenciais e faz a chamada para a API externa. Ela recebe a resposta (geralmente um array de objetos JSON).
    *   **Passo 2 (Nativo):** O backend realiza uma **análise estrutural nativa** no JSON recebido. Ele extrai todas as chaves únicas dos objetos (`_id`, `name`, `acf_filters.nome_completo`) para entender o "schema" dos dados.
    *   **Passo 3 (IA - Otimizado e de Baixo Custo):** Agora vem a chamada inteligente ao LLM. Em vez de enviar todos os dados, o backend envia **apenas o schema extraído** (a lista de chaves) para a IA. O prompt é focado em enriquecimento:
        *   *"Você é um especialista em API e análise de dados. Dada esta lista de chaves JSON extraídas de uma API: `['_id', 'user_login', 'user_pass', 'acf_data.cpf_cliente']`. Sugira 'nomes amigáveis' e legíveis para cada chave em português (ex: `'user_login' -> 'Login do Usuário'`). Retorne um mapeamento no formato JSON: `{'chave_original': 'nome_sugerido'}`."*
    *   **Resultado:** O backend retorna ao frontend os dados brutos da API **e** o mapeamento de nomes sugerido pela IA.

##### **Fase 3: Construção do Relatório Interativo**

O usuário agora tem o controle total para montar sua visualização.

1.  **Interface da Tabela Dinâmica (Frontend Next.js):**
    *   Os dados são exibidos em uma tabela.
    *   Um botão "Gerenciar Colunas" abre o painel de customização. Este painel mostra a lista de chaves originais e, ao lado de cada uma, o **"nome amigável" sugerido pela IA** já preenchido em um campo de texto editável.
    *   O usuário pode:
        *   Usar os nomes sugeridos pela IA.
        *   Editá-los para o que fizer mais sentido para ele.
        *   Marcar/desmarcar quais colunas (chaves) quer exibir.
        *   Arrastar e soltar as colunas para reordená-las.
    *   A tabela se atualiza em tempo real, mostrando apenas as colunas selecionadas, com os nomes definidos pelo usuário e na ordem desejada. **Toda essa lógica de renderização é nativa do React**, sem custos de IA.

##### **Fase 4: Exportação Eficiente**

A etapa final transforma a visualização do usuário em um arquivo físico.

1.  **API de Geração de Relatórios (Backend - API Route do Next.js):**
    *   O usuário clica em "Exportar" e escolhe o formato (`JSON`, `CSV`, `PDF`).
    *   O frontend envia para a API Route a receita completa: os dados brutos, a lista de chaves a serem incluídas, a ordem delas e os novos nomes das colunas.
    *   **A conversão é 100% nativa:**
        *   **JSON:** O backend simplesmente filtra e renomeia as chaves dos objetos em um loop. É extremamente rápido e barato.
        *   **CSV:** Usa uma biblioteca nativa para converter o array de objetos filtrados e renomeados em uma string CSV.
        *   **PDF:** Usa uma biblioteca nativa para gerar uma tabela em PDF com os dados e cabeçalhos corretos.
    *   **Nenhuma chamada ao LLM é necessária nesta fase**, pois a "inteligência" (o mapeamento) já foi definida pelo usuário na etapa anterior. O backend apenas executa a tarefa mecânica de formatação, garantindo baixo custo e alta velocidade.