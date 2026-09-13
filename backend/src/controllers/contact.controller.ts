import type { Request, Response } from 'express'
import { createContactSubmission } from '../services/contact.service.js'
import type { ContactInput } from '../validators/contact.validator.js'
import type { ApiResponse } from '../types/api.js'

export async function postContact(req: Request, res: Response) {
  const input = req.body as ContactInput
  await createContactSubmission(input)

  const response: ApiResponse = {
    success: true,
    message: 'Your message has been received. We will get back to you within one business day.',
  }
  res.status(201).json(response)
}
