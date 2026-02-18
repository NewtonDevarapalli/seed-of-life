interface RuntimeConfig {
  youtubeApiKey?: string;
  youtubeChannelId?: string;
}

declare global {
  interface Window {
    __env?: RuntimeConfig;
  }
}

const runtimeConfig: RuntimeConfig =
  typeof window !== 'undefined' ? (window.__env ?? {}) : {};

export const youtubeConfig = {
  apiKey: runtimeConfig.youtubeApiKey || '',
  channelId: runtimeConfig.youtubeChannelId || 'UCGHnhExArgGmbPxeVcAH7EQ'
};
