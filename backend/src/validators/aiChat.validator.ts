import { z } from 'zod'

/**
 * sessionId is a lookup key only — a server-minted UUID the frontend
 * echoes back (see aiChat.service.ts's findOrCreateConversation). It is
 * never trusted as the identifier for a *new* row, only used to look up
 * an existing conversation, so an invalid/unrecognized value is handled
 * by simply starting a fresh conversation rather than rejected here.
 */
export const chatRequestSchema = z
  .object({
    sessionId: z.string().uuid().optional(),
    message: z
      .string()
      .trim()
      .min(1, 'Please enter a message.')
      .max(2000, 'Keep messages under 2000 characters.'),
  })
  .strict()

export type ChatRequestInput = z.infer<typeof chatRequestSchema>
