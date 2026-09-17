/** Mirrors backend/prisma/schema.prisma's Lead model + the score
 * breakdown GET /api/leads/:id adds (see leadFinder.service.ts's
 * getLeadWithScoreBreakdown). Kept in this one file rather than
 * generated, matching the project's existing frontend/backend type
 * duplication convention (see CLAUDE.md). */
export interface LeadFinderLead {
  id: string
  businessName: string
  category?: string | null
  website?: string | null
  domain?: string | null
  email?: string | null
  phone?: string | null
  location?: string | null
  source?: string | null
  sourceUrl?: string | null
  opportunityTypes: string[]
  opportunityScore?: number | null
  priority?: string | null
  status: string
  analysis?: { website?: WebsiteAnalysis | null } | null
  evidence?: Record<string, { evidence: string[]; source: string }> | null
  emailSubject?: string | null
  emailBody?: string | null
  gmailDraftId?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  scoreBreakdown?: { score: number | null; priority: string | null; reasons: string[] }
}

export interface WebsiteAnalysis {
  fetched: boolean
  fetchError?: string
  finalUrl?: string
  statusCode?: number
  title?: string
  metaDescription?: string
  hasViewportMeta?: boolean
  hasCanonical?: boolean
  hasStructuredData?: boolean
  h1Count?: number
  h2Count?: number
  imgTotal?: number
  imgWithAlt?: number
  hasContactCta?: boolean
  hasChatOrBookingWidget?: boolean
  robotsTxtFound?: boolean
  sitemapFound?: boolean
  contactEmail?: string
}

/** Mirrors QualifiedLead. */
export interface ClientLead {
  id: string
  conversationId: string
  name: string
  email: string
  phone?: string | null
  company?: string | null
  website?: string | null
  service?: string | null
  requirements: string
  budget?: string | null
  timeline?: string | null
  intent: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ConversationMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: string
}

export interface ConversationDetail {
  id: string
  sessionId: string
  status: string
  messages: ConversationMessage[]
}

export interface PagedResult<T> {
  leads: T[]
  total: number
  page: number
  pageSize: number
}

export interface AdminOverview {
  totalLeads: number
  leadFinder: {
    total: number
    newCount: number
    researchedCount: number
    qualifiedCount: number
    emailDraftedCount: number
    contactedCount: number
    repliedCount: number
    convertedCount: number
    disqualifiedCount: number
    highPriorityCount: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
  }
  clientAgent: {
    total: number
    newCount: number
    inProgressCount: number
    resolvedCount: number
    archivedCount: number
    highIntentCount: number
    byStatus: Record<string, number>
    byIntent: Record<string, number>
  }
  recentActivity: {
    recentLeads: Array<Pick<LeadFinderLead, 'id' | 'businessName' | 'category' | 'opportunityScore' | 'priority' | 'status' | 'createdAt'>>
    recentConversations: Array<{ id: string; status: string; visitorName?: string | null; visitorEmail?: string | null; createdAt: string }>
    recentDiscoveries: Array<Pick<LeadFinderLead, 'id' | 'businessName' | 'source' | 'opportunityTypes' | 'createdAt'>>
    recentOutreach: Array<Pick<LeadFinderLead, 'id' | 'businessName' | 'emailSubject' | 'gmailDraftId' | 'status' | 'updatedAt'>>
  }
}
