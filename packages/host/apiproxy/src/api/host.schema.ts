/**
 * host domain zod schemas (names derived from map keys).
 */

import { z } from 'zod'
import type { DirectoryEntry, TreeEntry } from './host.ts'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'

/** host.describe request payload (empty object literal). */
export const hostDescribeRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.describe'>>>

/** host.describe response value. */
export const hostDescribeValueSchema = z.object({
  version: z.string(),
  cwd: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  attachedSessions: z.number().int().nonnegative(),
  canOpenPath: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.describe'>>>

/** host.pickDirectory request payload (empty object literal). */
export const hostPickDirectoryRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.pickDirectory'>>>

/** host.pickDirectory response value; null means the user cancelled. */
export const hostPickDirectoryValueSchema = z.object({
  path: z.string().nullable(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.pickDirectory'>>>

/** Directory row shared by listing entries and breadcrumb crumbs. */
export const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  hidden: z.boolean(),
}) satisfies z.ZodType<Wire<DirectoryEntry>>

/** host.listDirectory request payload; an absent path lists the home directory. */
export const hostListDirectoryRequestSchema = z.object({
  path: z.string().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.listDirectory'>>>

/** host.listDirectory response value. */
export const hostListDirectoryValueSchema = z.object({
  path: z.string(),
  home: z.string(),
  crumbs: z.array(directoryEntrySchema),
  entries: z.array(directoryEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.listDirectory'>>>

/** One tree row shared by the level's file and directory entries. */
export const treeEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.enum(['file', 'directory']),
  hidden: z.boolean(),
}) satisfies z.ZodType<Wire<TreeEntry>>

/** host.listTreeEntries request payload; the tree's root is caller-owned, so the path is required. */
export const hostListTreeEntriesRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.listTreeEntries'>>>

/** host.listTreeEntries response value. */
export const hostListTreeEntriesValueSchema = z.object({
  path: z.string(),
  entries: z.array(treeEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.listTreeEntries'>>>

/** host.createDirectory request payload: name must be one plain path segment. */
export const hostCreateDirectoryRequestSchema = z.object({
  path: z.string(),
  name: z.string(),
}).refine(
  payload => payload.name.trim() !== '' && payload.name !== '.' && payload.name !== '..'
    && !/[/\\]/.test(payload.name),
  { message: 'host.createDirectory requires a single non-blank path segment name' },
) satisfies z.ZodType<Wire<RequestPayload<'host.createDirectory'>>>

/** host.createDirectory response value: the created directory's absolute path. */
export const hostCreateDirectoryValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.createDirectory'>>>
/** host.openPath request payload. */
export const hostOpenPathRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.openPath'>>>

/** host.openPath response value. */
export const hostOpenPathValueSchema = z.object({
  opened: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'host.openPath'>>>

/** host.readText request payload; the file path is required. */
export const hostReadTextRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.readText'>>>

/** host.readText response value: the file's decoded UTF-8 content. */
export const hostReadTextValueSchema = z.object({
  content: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.readText'>>>
