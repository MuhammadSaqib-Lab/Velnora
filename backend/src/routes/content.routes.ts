import { Router } from 'express'
import { getProjects, getServices } from '../controllers/content.controller.js'

export const servicesRouter = Router()
servicesRouter.get('/', getServices)

export const projectsRouter = Router()
projectsRouter.get('/', getProjects)
