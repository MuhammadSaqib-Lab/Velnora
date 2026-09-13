import { prisma } from '../database/prisma.js'
import { AppError } from '../utils/AppError.js'
import type { ProjectInquiryInput } from '../validators/projectInquiry.validator.js'

export async function createProjectInquiry(input: ProjectInquiryInput) {
  try {
    return await prisma.projectInquiry.create({
      data: {
        name: input.name,
        email: input.email,
        company: input.company,
        phone: input.phone,
        projectType: input.projectType,
        budgetRange: input.budgetRange,
        message: input.message,
        repoLink: input.repoLink,
      },
      select: { id: true, createdAt: true },
    })
  } catch (error) {
    throw new AppError(
      500,
      'We could not save your project details right now. Please try again shortly.',
      undefined,
      { cause: error },
    )
  }
}
