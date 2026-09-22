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
};

/**
 * Returns helper config for a provider if supported, or null for custom / unlisted
 */
export function getProviderHelp(providerId: string): ProviderHelpConfig | null {
  return PROVIDER_HELP[providerId] || null;
}
