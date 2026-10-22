import { z } from "zod";

export const limits = {
  maxIpcText: 5_000,
  maxEntryBytes: 8 * 1024 * 1024,
  maxTrustedArchiveBytes: 128 * 1024 * 1024,
  operationTimeoutMs: 10_000,
} as const;

export const safeErrorCodes = ["INVALID_REQUEST", "UNAUTHORIZED", "NOT_FOUND", "SOURCE_CHANGED", "SOURCE_UNREADABLE", "INVALID_EPUB", "UNSUPPORTED_EPUB", "QUOTA_EXCEEDED", "CANCELLED", "HELPER_FAILED", "TIMEOUT", "SERVICE_UNAVAILABLE", "MODEL_MISSING", "MODEL_UNLOADED", "MODEL_TIMEOUT", "MODEL_CANCELLED", "MODEL_OUT_OF_MEMORY", "MODEL_INTERRUPTED", "MODEL_INVALID_OUTPUT", "MODEL_LOAD_FAILED", "MODEL_SERVICE_ERROR", "MODEL_UNEXPECTED_RELOAD"] as const;
export const SafeErrorSchema = z.object({ code: z.enum(safeErrorCodes), correlationId: z.string().uuid() }).strict();
export type SafeError = z.infer<typeof SafeErrorSchema>;
export const ResultSchema = <T extends z.ZodTypeAny>(value: T) => z.union([z.object({ ok: z.literal(true), value }).strict(), z.object({ ok: z.literal(false), error: SafeErrorSchema }).strict()]);

const id = z.string().uuid();
const entryPath = z.string().min(1).max(240);

export const ReaderLocationSchema = z.object({
  href: entryPath,
  cfi: z.string().max(4_000).optional(),
  quote: z.string().max(1_000).optional(),
  quotePrefix: z.string().max(200).optional(),
  quoteSuffix: z.string().max(200).optional(),
  navId: z.string().max(200).optional(),
  navProgress: z.number().min(0).max(1).optional(),
  resourceProgress: z.number().min(0).max(1).optional(),
}).strict();
export type ReaderLocation = z.infer<typeof ReaderLocationSchema>;

export const OpenSessionSchema = z.object({ bookId: id }).strict();
export const CloseSessionSchema = z.object({ sessionId: id }).strict();
export const RemoveBookSchema = z.object({ bookId: id }).strict();
export const CommitImportSchema = z.object({ sessionId: id, title: z.string().min(1).max(500), author: z.string().min(1).max(500), packageId: z.string().min(1).max(500).optional() }).strict();
export const LibraryBookSchema = z.object({ id, title: z.string().min(1).max(500), author: z.string().min(1).max(500), progress: z.number().min(0).max(1), missing: z.boolean(), cover: z.string().max(Math.ceil(limits.maxEntryBytes * 4 / 3) + 64).optional() }).strict();
export type LibraryBook = z.infer<typeof LibraryBookSchema>;
export const CoverSchema = z.object({ mime: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().min(1).max(Math.ceil(limits.maxEntryBytes * 4 / 3)) }).strict();
export const SelectionSchema = z.object({ sessionId: id, text: z.string().min(1).max(limits.maxIpcText), rangeCfi: z.string().max(4_000).optional(), rects: z.array(z.object({ x: z.number(), y: z.number(), width: z.number().nonnegative(), height: z.number().nonnegative() }).strict()).min(1).max(40) }).strict();
export const TranslationRequestSchema = z.object({ sessionId: id, selectionId: id }).strict();
export const ReaderModeSchema = z.enum(["continuous", "paginated"]);
export const AppearanceSchema = z.object({
  theme: z.enum(["system", "light", "dark", "sepia", "custom"]),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontSize: z.number().min(12).max(36),
  margin: z.number().min(16).max(120),
  lineHeight: z.number().min(1.1).max(2.5),
  paragraphSpacing: z.number().min(0).max(4),
  fontFamily: z.string().min(1).max(100).regex(/^[A-Za-z0-9 ]+$/),
}).strict().refine(value => value.theme !== "custom" || value.backgroundColor !== undefined, { message: "Custom themes require a background color", path: ["backgroundColor"] });
export type ReaderMode = z.infer<typeof ReaderModeSchema>;
export type Appearance = z.infer<typeof AppearanceSchema>;
export const SettingsSchema = z.object({ mode: ReaderModeSchema.optional(), appearance: AppearanceSchema.optional() }).strict();
export const LinkSchema = z.object({ sessionId: id, url: z.string().url().max(2_048).refine(url => new URL(url).protocol === "https:") }).strict();

export const RendererIntents = {
  getAppUpdateStatus: z.object({}).strict(),
  checkAppUpdates: z.object({}).strict(),
  installAppUpdate: z.object({}).strict(),
  chooseBooks: z.object({}).strict(),
  listLibrary: z.object({}).strict(),
  openSession: OpenSessionSchema,
  closeSession: CloseSessionSchema,
  removeBook: RemoveBookSchema,
  commitImport: CommitImportSchema.extend({ cover: CoverSchema.optional(), resolvedLocation: ReaderLocationSchema.optional() }),
  getReplacementLocation: z.object({ packageId: z.string().min(1).max(500) }).strict(),
  saveLocator: z.object({ sessionId: id, bookId: id, location: ReaderLocationSchema }).strict(),
  saveSettings: SettingsSchema,
  getSettings: z.object({}).strict(),
  translateSelection: TranslationRequestSchema,
  copyTranslation: TranslationRequestSchema,
  registerTranslationSelection: SelectionSchema,
  clearTranslationSelection: z.object({}).strict(),
  getTranslationModelStatus: z.object({}).strict(),
  loadTranslationModel: z.object({}).strict(),
  unloadTranslationModel: z.object({}).strict(),
  downloadFont: z.object({ fontId: z.string().min(1).max(100) }).strict(),
  listFonts: z.object({}).strict(),
  getFontData: z.object({ fontId: z.string().min(1).max(100) }).strict(),
  openExternalLink: LinkSchema,
  openProofFixture: z.object({}).strict(),
} as const;
export type RendererIntentName = keyof typeof RendererIntents;
