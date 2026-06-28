import { z } from 'zod';

export const passkeyStatusSchema = z.object({
  required: z.boolean().default(false),
  authenticator_app_enabled: z.boolean().default(false),
  passkey_registered: z.boolean().default(false),
  passkey_verified: z.boolean().default(false),
  setup_required: z.boolean().default(false),
  passkey_verification_required: z.boolean().default(false),
  registered: z.boolean(),
  count: z.number(),
  credentials: z.array(z.object({
    id: z.string(),
    name: z.string(),
    created_at: z.string(),
    last_used_at: z.string().nullable().optional()
  }))
});

export const passkeyOptionsSchema = z.object({
  options: z.record(z.string(), z.unknown())
});
