/**
 * Centralized Provider Help & Free API Key Configuration
 * Official provider URLs and strict compliant free-tier phrasing.
 */

export interface ProviderHelpConfig {
  id: string;
  name: string;
  freeLabel: string;
  apiKeyUrl: string;
  enabled: boolean;
  providerOrg: string;
  helpDescription: string;
}

export const PROVIDER_HELP: Record<string, ProviderHelpConfig> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    freeLabel: "Free tier available",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    enabled: true,
    providerOrg: "Google",
    helpDescription: "Create your own API key from Google AI Studio and add it to FormatAI. Free-tier availability and usage limits are controlled by Google.",
  },

  groq: {
    id: "groq",
    name: "Groq",
    freeLabel: "Free API access available",
    apiKeyUrl: "https://console.groq.com/keys",
    enabled: true,
    providerOrg: "Groq",
    helpDescription: "Create your API key from Groq Console and add it to FormatAI. Free-tier availability and usage limits are controlled by Groq.",
  },

  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    freeLabel: "Free models available",
    apiKeyUrl: "https://openrouter.ai/settings/keys",
    enabled: true,
    providerOrg: "OpenRouter",
    helpDescription: "Create your API key from OpenRouter and add it to FormatAI. Free-tier availability and usage limits are controlled by OpenRouter.",
  },

  mistral: {
    id: "mistral",
    name: "Mistral",
    freeLabel: "Free mode available",
    apiKeyUrl: "https://console.mistral.ai/api-keys/",
    enabled: true,
    providerOrg: "Mistral AI",
    helpDescription: "Create your API key from Mistral Console and add it to FormatAI. Free-tier availability and usage limits are controlled by Mistral.",
  },

  cohere: {
    id: "cohere",
    name: "Cohere",
    freeLabel: "Free evaluation API key",
    apiKeyUrl: "https://dashboard.cohere.com/api-keys",
    enabled: true,
    providerOrg: "Cohere",
    helpDescription: "Create your evaluation API key from Cohere Dashboard and add it to FormatAI. Free-tier availability and usage limits are controlled by Cohere.",
  },

  huggingface: {
    id: "huggingface",
    name: "Hugging Face",
    freeLabel: "Free credits / free access available",
    apiKeyUrl: "https://huggingface.co/settings/tokens",
    enabled: true,
    providerOrg: "Hugging Face",
    helpDescription: "Create your User Access Token from Hugging Face and add it to FormatAI. Free-tier availability and usage limits are controlled by Hugging Face.",
  },

  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    freeLabel: "Free daily allocation available",
    apiKeyUrl: "https://dash.cloudflare.com/",
    enabled: true,
    providerOrg: "Cloudflare",
    helpDescription: "Create your API token from the Cloudflare Dashboard and add it to FormatAI. Free-tier availability and usage limits are controlled by Cloudflare.",
  },

  openai: {
    id: "openai",
    name: "OpenAI",
    freeLabel: "Developer API access",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    enabled: true,
    providerOrg: "OpenAI",
    helpDescription: "Create your OpenAI API key from the OpenAI Platform dashboard and add it to FormatAI for GPT-4o, GPT-4o Mini, and o-series reasoning models.",
  },

  claude: {
    id: "claude",
    name: "Anthropic Claude",
    freeLabel: "Developer API access",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    enabled: true,
    providerOrg: "Anthropic",
    helpDescription: "Create your API key from the Anthropic Console and add it to FormatAI for Claude 3.5 Sonnet, Claude 3.5 Haiku, and Opus models.",
  },

  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    freeLabel: "Developer API access",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    enabled: true,
    providerOrg: "DeepSeek AI",
    helpDescription: "Create your API key from the DeepSeek Platform and add it to FormatAI for DeepSeek V4 and deep reasoning models.",
  },

  custom: {
    id: "custom",
    name: "Custom AI / Ollama",
    freeLabel: "Local & Private Unlimited ($0)",
    apiKeyUrl: "http://localhost:11434",
    enabled: true,
    providerOrg: "Self-Hosted / Local LLM",
    helpDescription: "Connect your local Ollama, LM Studio, vLLM, or custom OpenAI-compatible reverse proxy with zero external fees and 100% privacy.",
  },
};

/**
 * Returns helper config for a provider if supported, or null for custom / unlisted
 */
export function getProviderHelp(providerId: string): ProviderHelpConfig | null {
  return PROVIDER_HELP[providerId] || null;
}
