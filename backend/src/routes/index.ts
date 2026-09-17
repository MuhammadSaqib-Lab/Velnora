import { Router } from 'express'
import { adminRouter } from './admin.routes.js'
import { adminAuthRouter } from './adminAuth.routes.js'
import { aiChatRouter } from './aiChat.routes.js'
import { contactRouter } from './contact.routes.js'
import { projectsRouter, servicesRouter } from './content.routes.js'
import { healthRouter } from './health.routes.js'
import { leadsRouter } from './leads.routes.js'
import { projectInquiryRouter } from './projectInquiry.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/contact', contactRouter)
apiRouter.use('/project-inquiry', projectInquiryRouter)
apiRouter.use('/services', servicesRouter)
apiRouter.use('/projects', projectsRouter)
apiRouter.use('/ai', aiChatRouter)
apiRouter.use('/leads', leadsRouter)
apiRouter.use('/auth/admin', adminAuthRouter)
apiRouter.use('/admin', adminRouter)
