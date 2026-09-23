/**
 * Local AI Settings Storage Service (FormatAI Isolation Layer)
 * 
 * Strict Local-Only Isolation:
 * All user API keys, provider ON/OFF states, selected models, priority orders,
 * fallback rules, and free-tier toggles are stored strictly in the user's
 * local browser localStorage.
 * 
 * No user settings, raw API keys, or provider configurations are ever written
 * to a shared server disk or shared across browsers/devices.
 */

import { ClientProviderConfig, ManagerConfig, TestResult } from "../types/ai";

const STORAGE_KEY_AI_CONFIG = "formatai_local_ai_config_v1";
const STORAGE_KEY_RAW_KEYS = "formatai_local_raw_api_keys_v1";

export interface StoredRawKeyItem {
  id: string;
  providerId: string;
  name: string;
  rawKey: string;
  enabled: boolean;
}

export interface LocalAISettingsPackage {
  config: ManagerConfig;
  providers: ClientProviderConfig[];
  rawKeys: StoredRawKeyItem[];
  savedAt: number;
}

export class LocalAISettingsManager {
  private static instance: LocalAISettingsManager;

  private isBrowser(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }

  public static getInstance(): LocalAISettingsManager {
    if (!LocalAISettingsManager.instance) {
      LocalAISettingsManager.instance = new LocalAISettingsManager();
    }
    return LocalAISettingsManager.instance;
  }

  /**
   * Load local raw keys from browser storage
   */
  public getLocalRawKeys(): StoredRawKeyItem[] {
    if (!this.isBrowser()) return [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_RAW_KEYS);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn("Failed to load local raw keys:", e);
      return [];
    }
  }

  /**
   * Save local raw keys to browser storage
   */
  public saveLocalRawKeys(keys: StoredRawKeyItem[]): void {
    if (!this.isBrowser()) return;
    try {
      window.localStorage.setItem(STORAGE_KEY_RAW_KEYS, JSON.stringify(keys));
    } catch (e) {
      console.error("Failed to save local raw keys to localStorage:", e);
    }
  }

  /**
   * Add a new API key to local storage
   */
  public addRawKey(
    providerId: string,
    rawKey: string,
    keyName?: string,
    enabled = true
  ): StoredRawKeyItem {
    const keys = this.getLocalRawKeys();
    const cleanKey = rawKey.trim();
    
    // Check if key already exists
    const existing = keys.find((k) => k.providerId === providerId && k.rawKey === cleanKey);
    if (existing) {
      existing.enabled = enabled;
      if (keyName) existing.name = keyName;
      this.saveLocalRawKeys(keys);
      return existing;
    }

    const keyId = `${providerId}-key-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newItem: StoredRawKeyItem = {
      id: keyId,
      providerId,
      name: keyName?.trim() || `Key ${keys.filter((k) => k.providerId === providerId).length + 1}`,
      rawKey: cleanKey,
      enabled,
    };

    keys.push(newItem);
    this.saveLocalRawKeys(keys);
    return newItem;
  }

  /**
   * Toggle raw key enabled status locally
   */
  public toggleRawKey(keyId: string, enabled: boolean): void {
    const keys = this.getLocalRawKeys();
    const target = keys.find((k) => k.id === keyId);
    if (target) {
      target.enabled = enabled;
      this.saveLocalRawKeys(keys);
    }
  }

  /**
   * Remove raw key locally
   */
  public removeRawKey(keyId: string): void {
    const keys = this.getLocalRawKeys();
    const filtered = keys.filter((k) => k.id !== keyId);
    this.saveLocalRawKeys(filtered);
  }

  /**
   * Load entire local AI configuration (config + provider overrides)
   */
  public getLocalConfig(): Partial<ManagerConfig> | null {
    if (!this.isBrowser()) return null;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_AI_CONFIG);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to load local AI config:", e);
      return null;
    }
  }

  /**
   * Save local AI configuration (config + provider overrides)
   */
  public saveLocalConfig(config: ManagerConfig, providers: ClientProviderConfig[]): void {
    if (!this.isBrowser()) return;
    try {
      const payload = {
        config,
        providers: providers.map((p) => ({
          id: p.id,
          enabled: p.enabled,
          priority: p.priority,
          selectedModel: p.selectedModel,
          selectedKeyId: p.selectedKeyId,
          customEndpoint: p.customEndpoint,
          accountId: p.accountId,
          billingMode: p.billingMode,
        })),
        updatedAt: Date.now(),
      };
      window.localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(payload));
    } catch (e) {
      console.error("Failed to save local AI configuration:", e);
    }
  }

  /**
   * Reset local storage for AI settings
   */
  public resetLocalSettings(): void {
    if (!this.isBrowser()) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY_AI_CONFIG);
      window.localStorage.removeItem(STORAGE_KEY_RAW_KEYS);
    } catch (e) {
      console.warn("Failed to clear local AI settings:", e);
    }
  }

  /**
   * Build the execution payload containing the user's isolated local configuration
   * and enabled raw keys to send with request executions (/api/preview-clean or /export).
   */
  public getExecutionSettingsPayload(config?: ManagerConfig | null, providers?: ClientProviderConfig[] | null) {
    const rawKeys = this.getLocalRawKeys();
    const localSaved = this.getLocalConfig() as any;

    return {
      config: config || localSaved?.config || null,
      providers: providers ? providers.map(p => ({
        id: p.id,
        enabled: p.enabled,
        priority: p.priority,
        selectedModel: p.selectedModel,
        selectedKeyId: p.selectedKeyId,
        customEndpoint: p.customEndpoint,
        accountId: p.accountId,
        billingMode: p.billingMode,
      })) : (localSaved?.providers || null),
      keys: rawKeys.map(k => ({
        id: k.id,
        providerId: k.providerId,
        name: k.name,
        key: k.rawKey,
        enabled: k.enabled,
      })),
    };
  }

  /**
   * Generate masked preview of raw key
   */
  public static maskKey(rawKey: string): string {
    if (!rawKey) return "";
    const clean = rawKey.trim();
    if (clean.length <= 8) return "••••••••";
    const prefix = clean.slice(0, 4);
    const suffix = clean.slice(-4);
    return `${prefix}••••••••${suffix}`;
  }
}

export const localAISettings = LocalAISettingsManager.getInstance();
