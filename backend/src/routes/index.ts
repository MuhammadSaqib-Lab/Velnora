import { Router } from 'express'
import { contactRouter } from './contact.routes.js'
import { projectsRouter, servicesRouter } from './content.routes.js'
import { healthRouter } from './health.routes.js'
import { projectInquiryRouter } from './projectInquiry.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/contact', contactRouter)
apiRouter.use('/project-inquiry', projectInquiryRouter)
apiRouter.use('/services', servicesRouter)
apiRouter.use('/projects', projectsRouter)
