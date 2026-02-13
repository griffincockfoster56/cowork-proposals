const DOCS_URL = 'https://cowork-proposals.vercel.app/docs/';
const APP_URL = 'https://cowork-proposals.vercel.app/';

const prompts = {
  buildProposal: `I'm using Cowork Proposals (${APP_URL}). I want to build a proposal from an existing template. Please read the documentation at ${DOCS_URL} and walk me through the steps.`,
  createTemplate: `I'm using Cowork Proposals (${APP_URL}). I want to create and configure a new proposal template from a PDF. Please read the documentation at ${DOCS_URL} and walk me through the steps.`,
  setupTemplate: `I'm using Cowork Proposals (${APP_URL}). I'm in the template configuration screen and need help setting up page types, drawing rectangles, and configuring prices. Please read the documentation at ${DOCS_URL} and help me.`,
  buildHelp: `I'm using Cowork Proposals (${APP_URL}). I'm in the proposal builder and need help selecting pages, setting custom prices, and exporting a PDF. Please read the documentation at ${DOCS_URL} and help me.`,
  general: `I'm using Cowork Proposals (${APP_URL}). I need help using the app. Please read the documentation at ${DOCS_URL} and answer my questions.`,
};

export function getChatUrl(topic) {
  const prompt = prompts[topic] || prompts.general;
  return `https://chatgpt.com/?hints=search&q=${encodeURIComponent(prompt)}`;
}
