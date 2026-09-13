import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import type { ContactInput } from '../validators/contact.validator.js'

export async function createContactSubmission(input: ContactInput) {
  try {
    return await prisma.contactSubmission.create({
      data: {
        name: input.name,
        email: input.email,
        company: input.company,
        phone: input.phone,
        projectType: input.projectType,
        budgetRange: input.budgetRange,
        message: input.message,
      },
      select: { id: true, createdAt: true },
    })
  } catch (error) {
    // Prisma errors can contain connection strings / query details.
    // The caller gets a generic AppError; the real error is preserved
    // via `cause` for server-side logging only (see errorHandler.ts).
    throw new AppError(
      500,
      'We could not save your message right now. Please try again shortly.',
      undefined,
      { cause: error },
    )
  }
}
