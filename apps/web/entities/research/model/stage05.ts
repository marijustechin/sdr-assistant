import { z } from 'zod';

const sourceSchema = z
  .object({
    origin: z.string(),
    method: z.string(),
    sourceUrl: z.string().nullable(),
  })
  .passthrough();

const emailSchema = z
  .object({
    value: z.string(),
    ownership: z.enum(['usable', 'partner', 'uncertain']),
    sources: z.array(sourceSchema).default([]),
    employeeName: z.string().nullable().optional(),
    employeePosition: z.string().nullable().optional(),
    employeeAssociation: z.string().nullable().optional(),
  })
  .passthrough();

const phoneSchema = z
  .object({
    normalized: z.string(),
    originalValues: z.array(z.string()).default([]),
    countries: z.array(z.string()).default([]),
    local: z.boolean().optional(),
    reliableForeign: z.boolean().optional(),
    ambiguous: z.boolean().optional(),
    sourceUrls: z.array(z.string()).default([]),
  })
  .passthrough();

const addressSchema = z
  .object({
    value: z.string(),
    structured: z.record(z.string(), z.string()).nullable().optional(),
    sourceUrls: z.array(z.string()).default([]),
  })
  .passthrough();

const registrationSchema = z
  .object({
    value: z.string(),
    kind: z.string(),
  })
  .passthrough();

export const contactDiscoverySchema = z
  .object({
    domain: z.string(),
    companyName: z.string().nullable().optional(),
    emails: z.array(emailSchema).default([]),
    phones: z.array(phoneSchema).default([]),
    addresses: z.array(addressSchema).default([]),
    registrationIdentifiers: z.array(registrationSchema).default([]),
    retained: z.boolean().optional(),
    exclusionReason: z.string().nullable().optional(),
  })
  .passthrough();

export const stage05ResultSchema = z
  .object({
    id: z.string(),
    runId: z.string(),
    decision: z.enum(['ACCEPTED', 'EXCLUDED']),
    primaryExclusionReason: z.string().nullable(),
    source: z
      .object({
        researchId: z.string(),
        sourceCompanyIndex: z.number(),
        sourceCompanyKey: z.string(),
        domain: z.string(),
        profileHash: z.string(),
        name: z.string().nullable(),
        legalName: z.string().nullable(),
        country: z.string().nullable(),
      })
      .passthrough(),
    metadata: z
      .object({
        contactDiscovery: contactDiscoverySchema.optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const stage05RunSchema = z
  .object({
    id: z.string(),
    researchId: z.string(),
    status: z.string(),
    qualificationVersion: z.string(),
    policyVersion: z.string(),
    promptVersion: z.string().nullable(),
    companyCount: z.number(),
    processedCount: z.number(),
    acceptedCount: z.number(),
    excludedCount: z.number(),
    technicalFailureCount: z.number(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    publishedAt: z.string().nullable(),
    error: z.string().nullable(),
  })
  .passthrough();

export const stage05PayloadSchema = z
  .object({
    run: stage05RunSchema,
    results: z.array(stage05ResultSchema),
  })
  .passthrough();

export type Stage05Email = z.infer<typeof emailSchema>;
export type Stage05Phone = z.infer<typeof phoneSchema>;
export type Stage05Address = z.infer<typeof addressSchema>;
export type Stage05Registration = z.infer<typeof registrationSchema>;
export type ContactDiscoveryView = z.infer<typeof contactDiscoverySchema>;
export type Stage05Result = z.infer<typeof stage05ResultSchema>;
export type Stage05Run = z.infer<typeof stage05RunSchema>;
export type Stage05Payload = z.infer<typeof stage05PayloadSchema>;
