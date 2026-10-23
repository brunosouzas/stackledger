/** Runtime schemas and inferred catalogue types. Imported by validator; run npm run build.
 * Backstage extensions survive, but drawing kinds and licence details reject typos.
 */
import { z } from 'zod';
export const name = z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,61}[A-Za-z0-9])?$/, 'Name must be 1–63 ASCII letters, digits, dots, underscores or hyphens, with alphanumeric ends');
const text = z.string().min(1, 'Must be a non-empty string');
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be # followed by six hexadecimal digits');
const identity = { name, namespace: z.string().optional() };
const metadata = z.looseObject({ ...identity, title: text.optional(), description: text.optional(),
  labels: z.record(z.string(), z.string()).optional(), annotations: z.record(z.string(), z.string()).optional(), tags: z.array(z.string()).optional() });
const date = z.string().refine(value => {
  if (['unknown', 'not-applicable'].includes(value)) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Must be a real YYYY-MM-DD date, not-applicable or unknown');
export const licenceDetails = z.strictObject({
  vendor: text, status: z.enum(['active', 'to-confirm', 'to-buy', 'cancelled', 'expired']),
  cycle: z.enum(['monthly', 'yearly', 'one-off', 'none', 'unknown']),
  cost: z.union([z.number().nonnegative(), z.literal('unknown')]),
  currency: z.string().regex(/^(?:[A-Z]{3}|unknown)$/, 'Must be three capital ASCII letters or unknown'),
  renewsOn: date, seats: z.number().int().min(1).optional(), paidBy: text.optional(), vaultItem: text.optional(), note: text.optional(),
});
export const componentSchema = z.looseObject({
  apiVersion: z.literal('backstage.io/v1alpha1'), kind: z.literal('Component'), metadata,
  spec: z.looseObject({ type: text, lifecycle: text, owner: text, dependsOn: z.array(text).optional() }),
});
export const licenceSchema = z.looseObject({
  apiVersion: z.literal('backstage.io/v1alpha1'), kind: z.literal('Resource'), metadata,
  spec: z.looseObject({ type: z.literal('licence'), owner: text, licence: licenceDetails }),
});
export const lineSchema = z.strictObject({
  apiVersion: z.literal('stackledger/v1alpha1'), kind: z.literal('Line'),
  metadata: z.strictObject({ ...identity, title: text.optional() }),
  spec: z.strictObject({ color, code: z.string().regex(/^[A-Za-z0-9]{1,3}$/, 'Must be one to three ASCII letters or digits').optional(), stops: z.array(text).min(2) }),
});
export const layoutSchema = z.strictObject({
  apiVersion: z.literal('stackledger/v1alpha1'), kind: z.literal('MapLayout'),
  metadata: z.strictObject(identity),
  spec: z.strictObject({ stations: z.record(z.string(), z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])),
    zones: z.array(z.strictObject({ name: text, title: text, color })).optional() }),
});
/** Licence fields a Settings document may hide from the staff view, in catalogue order. */
export const licenceFields = ['vendor', 'status', 'cycle', 'cost', 'currency', 'renewsOn', 'seats', 'paidBy', 'vaultItem', 'note'] as const;
export type LicenceField = typeof licenceFields[number];
const hide = z.array(z.enum(licenceFields)).superRefine((list, context) => list.forEach((value, index) => {
  if (list.indexOf(value) < index) context.addIssue({ code: 'custom', message: 'Field name is already listed', path: [index] });
}));
/** Site tokens spec.site.colors may replace in the light theme; each maps to a --color-<name> variable. */
export const siteColorNames = ['primary', 'accent', 'body', 'text'] as const;
export type SiteColorName = typeof siteColorNames[number];
/** A home link's URL (catalogue, Home settings): http(s) with a host and no user name or password,
 * so it can be an anchor's href without running code or carrying a credential (site-security). */
const homeUrl = z.string().max(2048, 'Must have maximum 2048 characters').superRefine((value, context) => {
  let url: URL | undefined;
  try { url = new URL(value); } catch { /* reported below */ }
  if (!url || !/^https?:$/.test(url.protocol) || !/^https?:\/\//i.test(value)) context.addIssue({ code: 'custom', message: 'Must be an http:// or https:// URL' });
  else if (!url.hostname) context.addIssue({ code: 'custom', message: 'Must have a host' });
  else if (url.username || url.password || /@/.test(value.slice(value.indexOf('//') + 2).split(/[/?#]/)[0]!)) context.addIssue({ code: 'custom', message: 'Must not hold a user name or password' });
  else if (/[\s\p{Cc}]/u.test(value)) context.addIssue({ code: 'custom', message: 'Must not hold a space or control character' });
});
const home = z.strictObject({
  text: text.max(200, 'Must have maximum 200 characters').optional(),
  links: z.array(z.strictObject({
    title: text.max(60, 'Must have maximum 60 characters'),
    url: homeUrl,
    description: text.max(200, 'Must have maximum 200 characters').optional(),
  })).min(1, 'Must list at least one link').max(20, 'Must list at most 20 links').optional(),
});
const site = z.strictObject({
  title: text.max(60, 'Must have maximum 60 characters').optional(),
  home: home.optional(),
  colors: z.strictObject(Object.fromEntries(siteColorNames.map(key => [key, color.optional()])) as Record<SiteColorName, z.ZodOptional<typeof color>>).optional(),
});
/** Sites stackledger build writes: [full] is the personal mode, [full, staff] (the default) the corporate one. */
export const siteNames = ['full', 'staff'] as const;
export type SiteName = typeof siteNames[number];
const sites = z.array(z.enum(siteNames)).superRefine((list, context) => {
  list.forEach((value, index) => {
    if (list.indexOf(value) < index) context.addIssue({ code: 'custom', message: 'Site is already listed', path: [index] });
  });
  if (!list.includes('full')) context.addIssue({ code: 'custom', message: 'Must include full: use [full] or [full, staff]' });
});
/** Most skills folders a Settings may list (catalogue spec, Skills settings). */
export const MAX_SKILLS_FOLDERS = 20;
// A configured skills folder is resolved from the catalogue folder (build-command, Skill folders), so it
// must be relative: an absolute path, `~` (no shell expands it) or a drive would tie the catalogue to one machine.
const relativeFolder = text.refine(value => !/^[/\\~]/.test(value) && !/^[A-Za-z]:/.test(value),
  'Path must be relative to the catalogue folder: no leading /, \\, ~ or drive letter');
const skillsSettings = z.strictObject({
  folders: z.array(relativeFolder).min(1, 'Must list at least one folder').max(MAX_SKILLS_FOLDERS, `Must list at most ${MAX_SKILLS_FOLDERS} folders`)
    .superRefine((list, context) => list.forEach((value, index) => {
      if (list.indexOf(value) < index) context.addIssue({ code: 'custom', message: 'Folder is already listed', path: [index] });
    })).optional(),
});
export const settingsSchema = z.strictObject({
  apiVersion: z.literal('stackledger/v1alpha1'), kind: z.literal('Settings'),
  metadata: z.strictObject({ ...identity, title: text.optional() }),
  spec: z.strictObject({ views: z.strictObject({ staff: z.strictObject({ hide: hide.optional() }).optional() }).optional(), site: site.optional(), sites: sites.optional(),
    skills: skillsSettings.optional() }),
});
export const schemas = { Component: componentSchema, Resource: licenceSchema, Line: lineSchema, MapLayout: layoutSchema, Settings: settingsSchema };
export type Component = z.infer<typeof componentSchema>;
export type Licence = z.infer<typeof licenceSchema>;
export type Line = z.infer<typeof lineSchema>;
export type MapLayout = z.infer<typeof layoutSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Entity = Component | Licence | Line | MapLayout | Settings;
