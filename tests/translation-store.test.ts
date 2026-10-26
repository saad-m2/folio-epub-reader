import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { LibraryRepository } from "../src/main/library";
import { TranslationStore, type TranslationEncryption } from "../src/main/translation-store";
import { CLOUD_PROVIDERS, ProviderConfigurationSchema, type ProviderConfiguration } from "../src/shared/translation";

export function encryption(): TranslationEncryption {
  const key = randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), body]);
    },
    decryptString(value) {
      const decipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8");
    },
  };
}

const repositories: LibraryRepository[] = [];
const directories: string[] = [];
function database() {
  const directory = mkdtempSync(path.join(tmpdir(), "leaf-translation-store-"));
  directories.push(directory);
  const file = path.join(directory, "library.sqlite");
  const repository = new LibraryRepository(file);
  repositories.push(repository);
  return { file, repository };
}
afterEach(() => {
  for (const repository of repositories.splice(0)) { try { repository.close(); } catch { /* already closed for restart coverage */ } }
  for (const directory of directories.splice(0)) {
    if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith("leaf-translation-store-")) throw new Error("Unexpected temporary test directory");
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("protected translation store", () => {
  it.each<ProviderConfiguration>([
    { provider: "zpk", applicationId: "private-app", apiKey: "private-key" },
    { provider: "lara", accessKeyId: "private-id", accessKeySecret: "private-secret" },
    { provider: "traduck", apiKey: "private-key" },
  ])("protects and restores $provider credentials and exhaustion across restart", configuration => {
    const { repository, file } = database();
    const cryptor = encryption();
    const store = new TranslationStore(repository, cryptor);
    store.saveConfiguration(configuration);
    store.setCurrent(configuration.provider);
    store.setAvailability(configuration.provider, { state: "exhausted" });
    expect(store.getConfiguration(configuration.provider)).toEqual(configuration);
    expect(repository.readTranslationState()).not.toContain("private-");
    expect(JSON.stringify(store.getView())).not.toContain("private-");
    expect(repository.readTranslationSecret(configuration.provider)?.includes(Buffer.from("private-"))).toBe(false);
    repository.close();
    const reopened = new LibraryRepository(file);
    repositories.push(reopened);
    const restored = new TranslationStore(reopened, cryptor);
    expect(restored.getConfiguration(configuration.provider)).toEqual(configuration);
    expect(restored.getCurrent()).toBe(configuration.provider);
    expect(restored.getAvailability(configuration.provider)).toEqual({ state: "exhausted" });
    restored.removeConfiguration(configuration.provider);
    expect(restored.getCurrent()).toBeNull();
    expect(restored.getConfiguration(configuration.provider)).toBeUndefined();
  });

  it("requires complete provider-specific credentials and rejects caller-controlled destinations", () => {
    for (const configuration of [
      { provider: "zpk", apiKey: "key" },
      { provider: "lara", apiKey: "key" },
      { provider: "lara", accessKeyId: "id" },
      { provider: "traduck", apiKey: "key", endpoint: "https://untrusted.invalid" },
      { provider: "lara", accessKeyId: "id", accessKeySecret: "bad\nsecret" },
    ]) expect(ProviderConfigurationSchema.safeParse(configuration).success).toBe(false);
  });
  it("defaults to local and keeps configured secrets out of the public view and plaintext state", () => {
    const { repository } = database();
    const store = new TranslationStore(repository, encryption());
    expect(store.getCurrent()).toBe("ollama");
    expect(store.getView().providers.map(provider => provider.provider)).toEqual(CLOUD_PROVIDERS);
    expect(store.getView().providers.every(provider => !provider.configured)).toBe(true);
    store.saveConfiguration({ provider: "microsoft", apiKey: "private-key", region: "westeurope" });
    expect(store.getCurrent()).toBe("ollama");
    expect(store.getConfiguration("microsoft")).toEqual({ provider: "microsoft", apiKey: "private-key", region: "westeurope" });
    expect(repository.readTranslationSecret("microsoft")?.includes(Buffer.from("private-key"))).toBe(false);
    expect(repository.readTranslationState()).not.toContain("private-key");
    expect(JSON.stringify(store.getView())).not.toContain("private-key");
  });

  it("persists the current provider and exhausted state across restart without changing when another recovers", () => {
    const { repository, file } = database();
    const cryptor = encryption();
    const store = new TranslationStore(repository, cryptor);
    store.saveConfiguration({ provider: "deepl", apiKey: "deepl-key" });
    store.saveConfiguration({ provider: "microsoft", apiKey: "microsoft-key" });
    store.setCurrent("microsoft");
    store.setAvailability("deepl", { state: "exhausted", resetAt: 1234 });
    repository.close();
    const reopened = new LibraryRepository(file);
    repositories.push(reopened);
    const restored = new TranslationStore(reopened, cryptor);
    expect(restored.getCurrent()).toBe("microsoft");
    expect(restored.getAvailability("deepl")).toEqual({ state: "exhausted", resetAt: 1234 });
    restored.setAvailability("deepl", { state: "available" });
    expect(restored.getCurrent()).toBe("microsoft");
  });

  it("requires explicit selection after removal of the current account and clears its metadata", () => {
    const { repository } = database();
    const store = new TranslationStore(repository, encryption());
    store.saveConfiguration({ provider: "deepl", apiKey: "key" });
    store.setCurrent("deepl");
    store.setAvailability("deepl", { state: "exhausted" });
    store.removeConfiguration("deepl");
    expect(store.getCurrent()).toBeNull();
    expect(store.getConfiguration("deepl")).toBeUndefined();
    expect(store.getAvailability("deepl")).toEqual({ state: "unknown" });
    expect(() => store.setCurrent("deepl")).toThrow("not_configured");
  });

  it("does not overwrite ciphertext or metadata if encryption fails", () => {
    const { repository } = database();
    const cryptor = encryption();
    const store = new TranslationStore(repository, cryptor);
    store.saveConfiguration({ provider: "deepl", apiKey: "original" });
    store.setAvailability("deepl", { state: "exhausted" });
    const previous = repository.readTranslationSecret("deepl");
    vi.spyOn(cryptor, "encryptString").mockImplementation(() => { throw new Error("sensitive implementation details"); });
    expect(() => store.saveConfiguration({ provider: "deepl", apiKey: "replacement" })).toThrow("storage");
    expect(repository.readTranslationSecret("deepl")).toEqual(previous);
    expect(store.getAvailability("deepl")).toEqual({ state: "exhausted" });
    expect(store.getConfiguration("deepl")).toMatchObject({ apiKey: "original" });
  });

  it("reports locked/corrupt credentials separately from missing credentials without destroying them", () => {
    const { repository } = database();
    const cryptor = encryption();
    const store = new TranslationStore(repository, cryptor);
    store.saveConfiguration({ provider: "deepl", apiKey: "key" });
    const previous = repository.readTranslationSecret("deepl");
    vi.spyOn(cryptor, "isEncryptionAvailable").mockReturnValue(false);
    expect(() => store.getConfiguration("deepl")).toThrow("storage");
    expect(store.getConfiguration("microsoft")).toBeUndefined();
    expect(store.getView().providers.find(p => p.provider === "deepl")).toMatchObject({ configured: true, credentialError: true });
    expect(() => store.saveConfiguration({ provider: "deepl", apiKey: "replacement" })).toThrow("storage");
    expect(repository.readTranslationSecret("deepl")).toEqual(previous);
    vi.mocked(cryptor.isEncryptionAvailable).mockReturnValue(true);
    vi.spyOn(cryptor, "decryptString").mockImplementation(() => { throw new Error("private details"); });
    expect(() => store.getConfiguration("deepl")).toThrow("storage");
    expect(repository.readTranslationSecret("deepl")).toEqual(previous);
  });

  it("validates versioned stored JSON, configuration identity, and bounded metadata", () => {
    const { repository } = database();
    const cryptor = encryption();
    const store = new TranslationStore(repository, cryptor);
    expect(() => store.saveConfiguration({ provider: "deepl", apiKey: "bad key" })).toThrow("invalid_request");
    expect(() => store.setAvailability("deepl", { state: "available", resetAt: Infinity })).toThrow("invalid_request");
    repository.writeTranslationState('{"version":2}');
    expect(() => store.getView()).toThrow("storage");
    repository.writeTranslationState('{"version":1,"current":"ollama","providers":{}}', { provider: "deepl", encrypted: cryptor.encryptString('{"version":1,"configuration":{"provider":"microsoft","apiKey":"key"}}') });
    expect(() => store.getConfiguration("deepl")).toThrow("storage");
  });

  it("rolls back credential replacement when the metadata transaction fails", () => {
    const { repository, file } = database();
    const store = new TranslationStore(repository, encryption());
    store.saveConfiguration({ provider: "deepl", apiKey: "original" });
    const ciphertext = repository.readTranslationSecret("deepl");
    const state = repository.readTranslationState();
    const connection = new DatabaseSync(file);
    connection.exec("CREATE TRIGGER reject_translation_state BEFORE UPDATE ON preferences WHEN NEW.key = 'translationState' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    connection.close();
    expect(() => store.saveConfiguration({ provider: "deepl", apiKey: "replacement" })).toThrow("storage");
    expect(repository.readTranslationSecret("deepl")).toEqual(ciphertext);
    expect(repository.readTranslationState()).toEqual(state);
  });
});

describe("retired-provider migration", () => {
  const legacyState = (current: "ollama" | "microsoft" | "deepl" | "aws" | null = "aws") => JSON.stringify({
    version: 1, current,
    providers: { microsoft: { state: "exhausted", resetAt: 1234 }, deepl: { state: "available" }, aws: { state: "exhausted" } },
  });

  function seed(repository: LibraryRepository, cryptor: TranslationEncryption, current: "ollama" | "microsoft" | "deepl" | "aws" | null = "aws") {
    const state = legacyState(current);
    const microsoft = cryptor.encryptString(JSON.stringify({ version: 1, configuration: { provider: "microsoft", apiKey: "microsoft-key", region: "westeurope" } }));
    const deepl = cryptor.encryptString(JSON.stringify({ version: 1, configuration: { provider: "deepl", apiKey: "deepl-key" } }));
    const retired = Buffer.from("retired credential must never be decrypted");
    repository.writeTranslationState(state, { provider: "microsoft", encrypted: microsoft });
    repository.writeTranslationState(state, { provider: "deepl", encrypted: deepl });
    repository.writeTranslationState(state, { provider: "aws", encrypted: retired });
    return { state, microsoft, deepl, retired };
  }

  it("migrates lazily, deletes the retired ciphertext without decryption, and requires explicit provider choice", () => {
    const { repository } = database();
    const cryptor = encryption();
    const original = seed(repository, cryptor);
    const decrypt = vi.spyOn(cryptor, "decryptString");
    const read = vi.spyOn(repository, "readTranslationState");
    const store = new TranslationStore(repository, cryptor);
    expect(read).not.toHaveBeenCalled();
    expect(repository.readTranslationSecret("aws")).toEqual(original.retired);
    expect(store.getCurrent()).toBeNull();
    expect(decrypt).not.toHaveBeenCalled();
    expect(repository.readTranslationSecret("aws")).toBeUndefined();
    expect(repository.readTranslationSecret("microsoft")).toEqual(original.microsoft);
    expect(repository.readTranslationSecret("deepl")).toEqual(original.deepl);
    expect(JSON.parse(repository.readTranslationState()!)).toEqual({ version: 2, current: null, providers: { microsoft: { state: "exhausted", resetAt: 1234 }, deepl: { state: "available" } } });
    expect(store.getConfiguration("microsoft")).toEqual({ provider: "microsoft", apiKey: "microsoft-key", region: "westeurope" });
    expect(store.getConfiguration("deepl")).toEqual({ provider: "deepl", apiKey: "deepl-key" });
    expect(decrypt.mock.calls.every(([ciphertext]) => !ciphertext.equals(original.retired))).toBe(true);
    expect(store.getView().providers.map(provider => provider.provider)).toEqual(CLOUD_PROVIDERS);
  });

  it.each(["ollama", "microsoft", "deepl", null] as const)("preserves a legacy current selection of %s and all supported allowance metadata", current => {
    const { repository } = database();
    const cryptor = encryption();
    seed(repository, cryptor, current);
    const store = new TranslationStore(repository, cryptor);
    expect(store.getCurrent()).toBe(current);
    expect(store.getAvailability("microsoft")).toEqual({ state: "exhausted", resetAt: 1234 });
    expect(store.getAvailability("deepl")).toEqual({ state: "available" });
    expect(repository.readTranslationSecret("aws")).toBeUndefined();
  });

  it("migrates on a configuration read and stays idempotent across repeated reads and restart", () => {
    const { repository, file } = database();
    const cryptor = encryption();
    seed(repository, cryptor, "deepl");
    const store = new TranslationStore(repository, cryptor);
    const write = vi.spyOn(repository, "writeTranslationState");
    expect(store.getConfiguration("deepl")).toEqual({ provider: "deepl", apiKey: "deepl-key" });
    expect(write).toHaveBeenCalledOnce();
    store.getView(); store.getCurrent(); store.getAvailability("microsoft");
    expect(write).toHaveBeenCalledOnce();
    const migrated = repository.readTranslationState();
    repository.close();
    const reopened = new LibraryRepository(file);
    repositories.push(reopened);
    const restartedWrite = vi.spyOn(reopened, "writeTranslationState");
    const restarted = new TranslationStore(reopened, cryptor);
    expect(restarted.getCurrent()).toBe("deepl");
    expect(restarted.getConfiguration("microsoft")).toMatchObject({ apiKey: "microsoft-key" });
    expect(reopened.readTranslationState()).toBe(migrated);
    expect(reopened.readTranslationSecret("aws")).toBeUndefined();
    expect(restartedWrite).not.toHaveBeenCalled();
  });

  it("cleans a leftover retired ciphertext from current-version state without needing encryption access", () => {
    const { repository } = database();
    const state = JSON.stringify({ version: 2, current: "deepl", providers: { deepl: { state: "exhausted" } } });
    repository.writeTranslationState(state, { provider: "aws", encrypted: Buffer.from("unopenable retired ciphertext") });
    const cryptor = encryption();
    const available = vi.spyOn(cryptor, "isEncryptionAvailable").mockReturnValue(false);
    const decrypt = vi.spyOn(cryptor, "decryptString");
    const store = new TranslationStore(repository, cryptor);
    expect(store.getCurrent()).toBe("deepl");
    expect(store.getAvailability("deepl")).toEqual({ state: "exhausted" });
    expect(repository.readTranslationSecret("aws")).toBeUndefined();
    expect(repository.readTranslationState()).toBe(state);
    expect(available).not.toHaveBeenCalled();
    expect(decrypt).not.toHaveBeenCalled();
  });

  it("rolls back both state upgrade and ciphertext removal on migration failure, then can retry", () => {
    const { repository, file } = database();
    const cryptor = encryption();
    const original = seed(repository, cryptor);
    const connection = new DatabaseSync(file);
    connection.exec("CREATE TRIGGER reject_translation_migration BEFORE UPDATE ON preferences WHEN NEW.key = 'translationState' BEGIN SELECT RAISE(ABORT, 'test migration failure'); END");
    connection.close();
    const store = new TranslationStore(repository, cryptor);
    expect(() => store.getCurrent()).toThrow("storage");
    expect(repository.readTranslationState()).toBe(original.state);
    expect(repository.readTranslationSecret("aws")).toEqual(original.retired);
    expect(repository.readTranslationSecret("microsoft")).toEqual(original.microsoft);
    expect(repository.readTranslationSecret("deepl")).toEqual(original.deepl);
    const repaired = new DatabaseSync(file);
    repaired.exec("DROP TRIGGER reject_translation_migration");
    repaired.close();
    expect(store.getCurrent()).toBeNull();
    expect(repository.readTranslationSecret("aws")).toBeUndefined();
    expect(JSON.parse(repository.readTranslationState()!).version).toBe(2);
  });

  it.each([
    "{invalid JSON",
    JSON.stringify({ version: 1, current: "aws", providers: { aws: { state: "invalid" } } }),
    JSON.stringify({ version: 1, current: "microsoft", providers: {}, extra: "unexpected" }),
    JSON.stringify({ version: 2, current: "aws", providers: {} }),
    JSON.stringify({ version: 3, current: "ollama", providers: {} }),
  ])("does not read or rewrite corrupt cloud state during construction or silently reset it on access (%s)", state => {
    const { repository } = database();
    const ciphertext = Buffer.from("retired ciphertext kept on invalid migration");
    repository.writeTranslationState(state, { provider: "aws", encrypted: ciphertext });
    const cryptor = encryption();
    const decrypt = vi.spyOn(cryptor, "decryptString");
    const read = vi.spyOn(repository, "readTranslationState");
    const store = new TranslationStore(repository, cryptor);
    expect(read).not.toHaveBeenCalled();
    expect(() => store.getView()).toThrow("storage");
    expect(repository.readTranslationState()).toBe(state);
    expect(repository.readTranslationSecret("aws")).toEqual(ciphertext);
    expect(decrypt).not.toHaveBeenCalled();
  });
});
