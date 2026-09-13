/**
 * Development-only sample data, not real client information. Safe to
 * run against a local/dev database repeatedly (uses upsert-like
 * deleteMany + create rather than accumulating duplicates).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.contactSubmission.deleteMany()
  await prisma.projectInquiry.deleteMany()
  await prisma.lead.deleteMany()

  await prisma.contactSubmission.create({
    data: {
      name: 'Sample Contact',
      email: 'sample.contact@example.com',
      company: 'Example Co',
      message: 'This is seed data for local development, not a real inquiry.',
      status: 'NEW',
    },
  })

  await prisma.projectInquiry.create({
    data: {
      name: 'Sample Prospect',
      email: 'sample.prospect@example.com',
      company: 'Example Studio',
      projectType: 'new-website',
      budgetRange: '1k-2.5k',
      message: 'This is seed data for local development, not a real inquiry.',
      status: 'NEW',
    },
  })

  await prisma.lead.create({
    data: {
      businessName: 'Example Local Business',
      website: 'https://example.com',
      source: 'seed-data',
      status: 'NEW',
      notes: 'Placeholder row so the Lead table has a shape to develop against.',
    },
  })

  console.log('Seed complete.')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
