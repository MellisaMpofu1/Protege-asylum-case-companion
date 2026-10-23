import type { Locale } from "@/lib/dates";

/** Draft legal texts. Organisational/legal details are owner decisions and are marked, never invented. */
export const LEGAL_VERSION = "2026-10-draft-1";

type Doc = { title: string; draft: string; sections: { h: string; p: string }[] };
const TBD_EN = "[Awaiting owner decision]";
const TBD_PT = "[A aguardar decisão do responsável]";

export const TERMS: Record<Locale, Doc> = {
  en: {
    title: "Terms and Conditions",
    draft: `Draft version ${LEGAL_VERSION} — awaiting legal and owner review. Not for use with real applicants.`,
    sections: [
      { h: "What Protege is", p: "Protege is a case companion that helps you and your support organisation keep track of your asylum case in Portugal. It is not AIMA or any government service. It does not make official decisions, submit applications, provide renewal services or give legal advice." },
      { h: "Information shown", p: "Dates and updates are recorded by you or your support organisation. Protege does not receive live official status. If a date is not confirmed, the app says so. Always check official letters and your adviser." },
      { h: "Your account", p: "Accounts are created by invitation only. Keep your password private. Tell your support organisation if you think someone else has accessed your account." },
      { h: "Acceptable use", p: "Only upload documents that relate to your own case. Do not upload documents belonging to other people without permission." },
      { h: "Service operator", p: `Operator name, address and contact: ${TBD_EN}.` },
      { h: "Changes", p: "If these terms change in a material way, you will be asked to accept the new version. Minor wording changes will not require acceptance again." },
    ],
  },
  "pt-PT": {
    title: "Termos e Condições",
    draft: `Versão de rascunho ${LEGAL_VERSION} — a aguardar revisão jurídica e do responsável. Não usar com requerentes reais.`,
    sections: [
      { h: "O que é o Protege", p: "O Protege é um acompanhante do processo que ajuda o utilizador e a sua organização de apoio a acompanhar o seu processo de asilo em Portugal. Não é a AIMA nem qualquer serviço público. Não toma decisões oficiais, não submete pedidos, não presta serviços de renovação nem dá aconselhamento jurídico." },
      { h: "Informação apresentada", p: "As datas e atualizações são registadas pelo utilizador ou pela organização de apoio. O Protege não recebe o estado oficial em tempo real. Se uma data não estiver confirmada, a aplicação indica-o. Confirme sempre as cartas oficiais e o seu consultor." },
      { h: "A sua conta", p: "As contas são criadas apenas por convite. Mantenha a palavra-passe privada. Informe a sua organização de apoio se achar que alguém acedeu à sua conta." },
      { h: "Utilização aceitável", p: "Carregue apenas documentos relativos ao seu próprio processo. Não carregue documentos de outras pessoas sem autorização." },
      { h: "Operador do serviço", p: `Nome, morada e contacto do operador: ${TBD_PT}.` },
      { h: "Alterações", p: "Se estes termos mudarem de forma substancial, ser-lhe-á pedido que aceite a nova versão. Pequenas alterações de redação não exigem nova aceitação." },
    ],
  },
};

export const PRIVACY: Record<Locale, Doc> = {
  en: {
    title: "Privacy Notice",
    draft: `Draft version ${LEGAL_VERSION} — awaiting legal and owner review. Items marked ${TBD_EN} must be decided before real use. This notice does not claim GDPR compliance.`,
    sections: [
      { h: "Who is responsible (controller)", p: `Controller identity, address and contact: ${TBD_EN}. Data protection officer or privacy contact: ${TBD_EN}. Processor roles (support organisation vs. Protege operator): ${TBD_EN}.` },
      { h: "Data we process", p: "Account data (email, display name, interface language, preferred language and whether you need language assistance); case workspace data recorded by you or your support organisation (stage, timeline entries, actions, appointments, renewal preparation); documents you or your organisation upload; help requests; in-app notifications; consent records; security and audit records (who changed what and when)." },
      { h: "Purposes and legal bases", p: `Providing the case companion service; keeping records secure and auditable; sending in-app reminders from confirmed dates. Legal basis for each purpose, including any special-category data: ${TBD_EN}. Optional pseudonymous usage analytics only with your consent.` },
      { h: "Who can see your data", p: "Only people your support organisation has explicitly given access to your case. Organisation membership alone does not give access. Hosting/infrastructure provider: Lovable Cloud. Other recipients: none." },
      { h: "International transfers", p: `Hosting region and any transfers outside the EU/EEA, with safeguards: ${TBD_EN}.` },
      { h: "How long we keep data", p: `Retention periods: ${TBD_EN}. Deletion requests are currently reviewed manually; nothing is deleted automatically.` },
      { h: "Your rights", p: "You can ask to access, correct, export or delete your data, object to or restrict processing, and withdraw optional consent at any time in Settings. Withdrawing consent does not affect core access to the service." },
      { h: "Complaints", p: `You can complain to the Portuguese data protection authority, Comissão Nacional de Proteção de Dados (CNPD). Organisation complaint contact: ${TBD_EN}.` },
    ],
  },
  "pt-PT": {
    title: "Aviso de Privacidade",
    draft: `Versão de rascunho ${LEGAL_VERSION} — a aguardar revisão jurídica e do responsável. Os itens marcados ${TBD_PT} têm de ser decididos antes de uso real. Este aviso não declara conformidade com o RGPD.`,
    sections: [
      { h: "Quem é o responsável pelo tratamento", p: `Identidade, morada e contacto do responsável: ${TBD_PT}. Encarregado de proteção de dados ou contacto de privacidade: ${TBD_PT}. Papéis de subcontratante (organização de apoio vs. operador do Protege): ${TBD_PT}.` },
      { h: "Dados tratados", p: "Dados da conta (email, nome a apresentar, idioma da interface, idioma preferido e necessidade de apoio linguístico); dados do processo registados por si ou pela organização de apoio (fase, cronologia, ações, marcações, preparação da renovação); documentos carregados; pedidos de ajuda; notificações na aplicação; registos de consentimento; registos de segurança e auditoria." },
      { h: "Finalidades e fundamentos jurídicos", p: `Prestar o serviço de acompanhamento do processo; manter os registos seguros e auditáveis; enviar lembretes na aplicação a partir de datas confirmadas. Fundamento jurídico de cada finalidade, incluindo dados de categorias especiais: ${TBD_PT}. Análise de utilização pseudonimizada opcional, apenas com o seu consentimento.` },
      { h: "Quem pode ver os seus dados", p: "Apenas as pessoas a quem a sua organização de apoio deu acesso explícito ao seu processo. Ser membro da organização não dá acesso. Fornecedor de alojamento: Lovable Cloud. Outros destinatários: nenhum." },
      { h: "Transferências internacionais", p: `Região de alojamento e eventuais transferências para fora da UE/EEE, com garantias: ${TBD_PT}.` },
      { h: "Prazo de conservação", p: `Prazos de conservação: ${TBD_PT}. Os pedidos de eliminação são analisados manualmente; nada é eliminado automaticamente.` },
      { h: "Os seus direitos", p: "Pode pedir acesso, retificação, portabilidade ou eliminação dos seus dados, opor-se ou limitar o tratamento, e retirar o consentimento opcional a qualquer momento nas Definições. Retirar o consentimento não afeta o acesso ao serviço." },
      { h: "Reclamações", p: `Pode apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD). Contacto de reclamações da organização: ${TBD_PT}.` },
    ],
  },
};

export const CONSENT_TEXT = {
  en: {
    heading: "Before you continue",
    intro: "Please read the Terms and Conditions and the Privacy Notice. Protege is a case companion; it does not give official AIMA decisions or renewal services.",
    terms: "I agree to the Terms and Conditions.",
    privacy: "I confirm I have been given the Privacy Notice. (This is not consent to all processing.)",
    optional: "Optional — you can say no and still use Protege",
    analytics: "Allow pseudonymous usage analytics",
    analytics_help: "Records which screens are opened and whether uploads succeed, under a random code — never your name, email, case text or document names. It helps the organisation improve the service. You can withdraw at any time in Settings.",
    continue: "Continue",
    must: "Please tick both required boxes to continue.",
    read_terms: "Read Terms and Conditions",
    read_privacy: "Read Privacy Notice",
    consents: "Terms, privacy and consent",
    history: "Your choice history",
    on: "Given", off: "Refused / withdrawn",
    accepted: "Accepted",
  },
  "pt-PT": {
    heading: "Antes de continuar",
    intro: "Leia os Termos e Condições e o Aviso de Privacidade. O Protege é um acompanhante do processo; não emite decisões oficiais da AIMA nem presta serviços de renovação.",
    terms: "Aceito os Termos e Condições.",
    privacy: "Confirmo que me foi disponibilizado o Aviso de Privacidade. (Isto não é consentimento para todo o tratamento.)",
    optional: "Opcional — pode recusar e continuar a usar o Protege",
    analytics: "Permitir análise de utilização pseudonimizada",
    analytics_help: "Regista que ecrãs são abertos e se os carregamentos têm êxito, com um código aleatório — nunca o seu nome, email, texto do processo ou nomes de documentos. Ajuda a organização a melhorar o serviço. Pode retirar a qualquer momento nas Definições.",
    continue: "Continuar",
    must: "Assinale as duas caixas obrigatórias para continuar.",
    read_terms: "Ler Termos e Condições",
    read_privacy: "Ler Aviso de Privacidade",
    consents: "Termos, privacidade e consentimento",
    history: "Histórico das suas escolhas",
    on: "Dado", off: "Recusado / retirado",
    accepted: "Aceite",
  },
} satisfies Record<Locale, Record<string, string>>;
