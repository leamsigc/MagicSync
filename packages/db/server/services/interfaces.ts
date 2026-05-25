import type {
  AgentSession,
  Asset,
  BusinessProfile,
  ChatMessage,
  ChatThread,
  Document,
  DocumentChunk,
  EntityDetails,
  KnowledgeFolder,
  NewEntityDetails,
  PlatformPost,
  Post,
  PostCreateBase,
  PostWithAllData,
  Review,
  Skill,
  SkillFile,
  SocialMediaAccount,
  Subscription,
  Template,
  TemplateAsset,
  UserLlmConfig,
} from '#layers/BaseDB/db/schema'
import type { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages'
import type { GMBLocation } from '#layers/BaseDB/server/utils/googleMyBusiness'
import type { Account, User } from '#layers/BaseDB/db/auth/auth'
import type { H3Event } from 'h3'
import type {
  PaginatedResponse,
  QueryOptions,
  PostResponse,
  ServiceResponse,
} from './types'
import type {
  CreatePlatformPostData,
  UpdatePostData,
} from './post.service'
import type {
  CreateAgentSessionData,
  UpdateAgentSessionData,
} from './agent.service'
import type {
  CreateBusinessProfileData,
  UpdateBusinessProfileData,
} from './business-profile.service'
import type {
  CreateThreadData,
  CreateMessageData,
  MessagePaginationOptions,
} from './chat.service'
import type {
  CreateDocumentData,
  CreateChunkData,
} from './document.service'
import type { UpdateEntityDetailsData } from './entity-details.service'
import type {
  CreateFolderData,
  UpdateFolderData,
} from './folder.service'
import type {
  CreateReviewData,
  UpdateReviewData,
  ReviewStats,
} from './review.service'
import type {
  SearchResult,
  HybridSearchRequest,
  RerankRequest,
} from './search.service'
import type {
  CreateSkillData,
  CreateSkillFileData,
} from './skill.service'
import type {
  CreateSocialMediaAccountData,
  UpdateSocialMediaAccountData,
  TokenRefreshData,
  SocialMediaAccountFilters,
  SocialMediaPlatform,
} from './social-media-account.service'
import type {
  CreateSubscriptionData,
  UpdateSubscriptionData,
  SubscriptionLimits,
} from './subscription.service'
import type {
  CreateTemplateData,
  UpdateTemplateData,
  TemplateWithAssets,
} from './template.service'
import type {
  CreateLlmConfigData,
  UpdateLlmConfigData,
} from './user-llm-config.service'

export type PostServiceType = {
  create: (userId: string, data: PostCreateBase) => Promise<ServiceResponse<Post>>
  findById: (id: string, userId: string, includePlatforms?: boolean, includeUser?: boolean) => Promise<ServiceResponse<PostWithAllData | Post>>
  findByBusinessId: (businessId: string, userId: string, options?: QueryOptions) => Promise<PaginatedResponse<PostWithAllData>>
  findScheduledPosts: (beforeDate?: Date) => Promise<ServiceResponse<Post[]>>
  findByIdFull: (params: { postId: string }) => Promise<PostWithAllData>
  update: (id: string, userId: string, data: UpdatePostData) => Promise<ServiceResponse<Post>>
  updateStatus: (id: string, userId: string, status: 'pending' | 'published' | 'failed') => Promise<ServiceResponse<Post>>
  delete: (id: string, userId: string) => Promise<ServiceResponse<void>>
  updatePlatformPost: (id: string, data: Partial<CreatePlatformPostData>) => Promise<ServiceResponse<PlatformPost>>
  getPlatformPostsByPost: (postId: string) => Promise<ServiceResponse<PlatformPost[]>>
  retryFailedPost: (id: string, userId: string) => Promise<ServiceResponse<PostWithAllData>>
}

export type AgentServiceType = {
  create: (data: CreateAgentSessionData) => Promise<ServiceResponse<AgentSession>>
  getById: (sessionId: string, userId: string) => Promise<ServiceResponse<AgentSession>>
  listByUser: (userId: string, parentMessageId?: string) => Promise<ServiceResponse<AgentSession[]>>
  update: (sessionId: string, userId: string, data: UpdateAgentSessionData) => Promise<ServiceResponse<AgentSession>>
  delete: (sessionId: string, userId: string) => Promise<ServiceResponse<AgentSession>>
}

export type LogAuditServiceType = {
  logAuditEvent: (data: {
    userId?: string
    category: string
    action: string
    targetType?: string
    targetId?: string
    ipAddress?: string
    userAgent?: string
    status?: 'success' | 'failure' | 'pending'
    details?: string
  }) => Promise<void>
}

export type BusinessProfileServiceType = {
  create: (userId: string, data: CreateBusinessProfileData) => Promise<ServiceResponse<BusinessProfile>>
  findById: (id: string, userId: string, event?: H3Event) => Promise<ServiceResponse<BusinessProfile>>
  findByIdOnly: (id: string) => Promise<ServiceResponse<BusinessProfile>>
  findByUserId: (userId: string, options?: QueryOptions) => Promise<PaginatedResponse<BusinessProfile>>
  findAll: (userId: string) => Promise<ServiceResponse<BusinessProfile[]>>
  update: (id: string, userId: string, data: UpdateBusinessProfileData) => Promise<ServiceResponse<BusinessProfile>>
  updateRaw: (id: string, data: UpdateBusinessProfileData) => Promise<ServiceResponse<BusinessProfile>>
  delete: (id: string, userId: string) => Promise<ServiceResponse<void>>
  setActive: (userId: string, data: { id: string, isActive: boolean }) => Promise<ServiceResponse<BusinessProfile>>
  getActive: (userId: string) => Promise<ServiceResponse<BusinessProfile>>
  syncFromGMB: (userId: string, accessToken: string) => Promise<ServiceResponse<BusinessProfile[]>>
  getGMBLocationDetails: (businessId: string, userId: string, accessToken: string, business?: BusinessProfile) => Promise<ServiceResponse<GMBLocation>>
  isConnectedToGMB: (businessId: string, userId: string, business?: BusinessProfile) => Promise<ServiceResponse<boolean>>
  disconnectFromGMB: (businessId: string, userId: string, business?: BusinessProfile) => Promise<ServiceResponse<BusinessProfile>>
}

export type BusinessServiceType = {
  create: (data: Omit<BusinessProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<BusinessProfile>
  update: (id: string, data: Partial<Omit<BusinessProfile, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<BusinessProfile | null>
  delete: (id: string) => Promise<boolean>
  find: (id: string) => Promise<BusinessProfile | null>
  findAll: () => Promise<BusinessProfile[]>
  findByUserId: (userId: string) => Promise<BusinessProfile[]>
  findBySlug: (slug: string) => Promise<BusinessProfile | null>
  toggleGoogleMyBusinessConnection: (id: string) => Promise<BusinessProfile | null>
}

export type ChatServiceType = {
  createThread: (userId: string, data: CreateThreadData) => Promise<ServiceResponse<ChatThread>>
  getThreads: (userId: string) => Promise<ServiceResponse<ChatThread[]>>
  getThread: (threadId: string, userId: string) => Promise<ServiceResponse<ChatThread>>
  deleteThread: (threadId: string, userId: string) => Promise<ServiceResponse<ChatThread>>
  updateThreadTitle: (threadId: string, userId: string, title: string) => Promise<ServiceResponse<ChatThread>>
  addMessage: (data: CreateMessageData) => Promise<ServiceResponse<ChatMessage>>
  getMessages: (threadId: string, userId: string, options?: MessagePaginationOptions) => Promise<ServiceResponse<ChatMessage[]>>
}

export type DocumentServiceType = {
  create: (userId: string, data: CreateDocumentData) => Promise<ServiceResponse<Document>>
  findById: (id: string, userId: string) => Promise<ServiceResponse<Document>>
  findByUser: (userId: string, options?: QueryOptions) => Promise<PaginatedResponse<Document>>
  findByFolder: (folderId: string, userId: string, options?: QueryOptions) => Promise<PaginatedResponse<Document>>
  findUnfiled: (userId: string, options?: QueryOptions) => Promise<PaginatedResponse<Document>>
  updateStatus: (id: string, userId: string, status: Document['status'], errorMessage?: string) => Promise<ServiceResponse<Document>>
  updateChunkCount: (id: string, userId: string, chunkCount: number) => Promise<ServiceResponse<Document>>
  updateContentHash: (id: string, userId: string, contentHash: string) => Promise<ServiceResponse<Document>>
  updateMetadata: (id: string, userId: string, metadata: Record<string, any>) => Promise<ServiceResponse<Document>>
  updateFolder: (id: string, userId: string, folderId: string | null) => Promise<ServiceResponse<Document>>
  delete: (id: string, userId: string) => Promise<ServiceResponse<Document>>
  findByContentHash: (hash: string, userId: string, excludeId?: string) => Promise<ServiceResponse<Document>>
}

export type ChunkServiceType = {
  createMany: (chunks: CreateChunkData[]) => Promise<ServiceResponse<number>>
  deleteByDocument: (documentId: string) => Promise<ServiceResponse<number>>
  findByDocument: (documentId: string) => Promise<ServiceResponse<DocumentChunk[]>>
  deleteByIds: (ids: string[]) => Promise<ServiceResponse<number>>
  search: (
    userId: string,
    queryEmbedding: number[],
    limit?: number,
    filters?: { documentId?: string; metadataKey?: string; metadataValue?: string }
  ) => Promise<ServiceResponse<Array<{ content: string; documentId: string; similarity: number; metadata: Record<string, any> | null }>>>
}

export type EntityDetailsServiceType = {
  createDetails: (data: NewEntityDetails) => Promise<EntityDetails>
  createOrUpdateDetails: (params: { entityId: string; entityType: string; pages: FacebookPage[] }) => Promise<void>
  getDetailsById: (id: string) => Promise<EntityDetails>
  getDetailsByEntity: (entityId: string, entityType: string) => Promise<EntityDetails>
  updateDetails: (id: string, data: UpdateEntityDetailsData) => Promise<EntityDetails>
  deleteDetails: (id: string) => Promise<boolean>
}

export type FolderServiceType = {
  create: (userId: string, data: CreateFolderData) => Promise<ServiceResponse<KnowledgeFolder>>
  findById: (id: string, userId: string) => Promise<ServiceResponse<KnowledgeFolder>>
  findByPath: (path: string, userId: string) => Promise<ServiceResponse<KnowledgeFolder>>
  findByUser: (userId: string, parentId?: string) => Promise<ServiceResponse<KnowledgeFolder[]>>
  findChildren: (userId: string, parentId: string) => Promise<ServiceResponse<KnowledgeFolder[]>>
  getRootFolders: (userId: string) => Promise<ServiceResponse<KnowledgeFolder[]>>
  getFolderTree: (userId: string) => Promise<ServiceResponse<KnowledgeFolder[]>>
  update: (id: string, userId: string, data: UpdateFolderData) => Promise<ServiceResponse<KnowledgeFolder>>
  delete: (id: string, userId: string) => Promise<ServiceResponse<KnowledgeFolder>>
  moveDocumentsToFolder: (folderId: string | null, documentIds: string[], userId: string) => Promise<ServiceResponse<number>>
}

export type ReviewServiceType = {
  create: (data: CreateReviewData) => Promise<ServiceResponse<Review>>
  findById: (id: string, userId: string, event?: H3Event) => Promise<ServiceResponse<Review>>
  findByBusinessId: (businessId: string, userId: string, options?: QueryOptions, event?: H3Event) => Promise<PaginatedResponse<Review>>
  findByPlatformReviewId: (platform: string, platformReviewId: string) => Promise<ServiceResponse<Review>>
  update: (id: string, userId: string, data: UpdateReviewData, event?: H3Event) => Promise<ServiceResponse<Review>>
  addResponse: (id: string, userId: string, responseContent: string, event?: H3Event) => Promise<ServiceResponse<Review>>
  toggleShare: (id: string, userId: string, event?: H3Event) => Promise<ServiceResponse<Review>>
  getStats: (businessId: string, userId: string, options?: { startDate?: Date; endDate?: Date }, event?: H3Event) => Promise<ServiceResponse<ReviewStats>>
  getRecentReviews: (businessId: string, userId: string, limit?: number, event?: H3Event) => Promise<ServiceResponse<Review[]>>
  delete: (id: string, userId: string, event?: H3Event) => Promise<ServiceResponse<void>>
  syncGMBReviews: (businessId: string, googleBusinessId: string, accessToken: string) => Promise<ServiceResponse<Review[]>>
  replyToGMBReview: (reviewId: string, responseContent: string, accessToken: string) => Promise<ServiceResponse<Review>>
  generateAIResponse: (reviewId: string, businessContext?: string) => Promise<ServiceResponse<string>>
  getReviewsNeedingResponse: (businessId: string, platform?: string) => Promise<ServiceResponse<Review[]>>
  getFiveStarReviewsForSharing: (businessId: string, limit?: number) => Promise<ServiceResponse<Review[]>>
  markAsShared: (reviewId: string, userId: string, event?: H3Event) => Promise<ServiceResponse<Review>>
  getResponseTemplates: (rating: number) => string[]
}

export type SearchServiceType = {
  keywordSearch: (userId: string, query: string, limit?: number, documentId?: string) => Promise<ServiceResponse<SearchResult[]>>
  vectorSearch: (
    userId: string,
    queryEmbedding: number[],
    limit?: number,
    filters?: { documentId?: string; folderId?: string; metadataKey?: string; metadataValue?: string }
  ) => Promise<ServiceResponse<SearchResult[]>>
  reciprocalRankFusion: (keywordResults: SearchResult[], vectorResults: SearchResult[], k?: number, limit?: number) => SearchResult[]
  hybridSearch: (request: HybridSearchRequest) => Promise<ServiceResponse<SearchResult[]>>
  rerank: (request: RerankRequest) => Promise<ServiceResponse<SearchResult[]>>
}

export type SkillServiceType = {
  create: (userId: string, data: CreateSkillData) => Promise<ServiceResponse<Skill>>
  findById: (id: string, userId: string) => Promise<ServiceResponse<Skill>>
  findByUser: (userId: string, options?: QueryOptions) => Promise<ServiceResponse<Skill[]>>
  getCatalog: (userId: string) => Promise<ServiceResponse<Array<{ name: string; description: string }>>>
  update: (id: string, userId: string, data: Partial<CreateSkillData>) => Promise<ServiceResponse<Skill>>
  delete: (id: string, userId: string) => Promise<ServiceResponse<Skill>>
}

export type SkillFileServiceType = {
  create: (userId: string, data: CreateSkillFileData) => Promise<ServiceResponse<SkillFile>>
  findBySkill: (skillId: string) => Promise<ServiceResponse<SkillFile[]>>
}

export type SocialMediaAccountServiceType = {
  getUserByAccountId: (id: string) => Promise<User | undefined>
  getActualAccountByAccountId: (id: string) => Promise<SocialMediaAccount | undefined>
  getUserAccountsCompleteDetails: (id: string) => Promise<Array<Account & Partial<EntityDetails>>>
  createAccount: (data: CreateSocialMediaAccountData) => Promise<SocialMediaAccount>
  getAccountById: (id: string, userId?: string) => Promise<SocialMediaAccount | undefined>
  getAccounts: (filters?: SocialMediaAccountFilters) => Promise<SocialMediaAccount[]>
  getAccountsByUserId: (userId: string) => Promise<SocialMediaAccount[]>
  getAccountsByBusinessId: (businessId: string) => Promise<SocialMediaAccount[]>
  getAccountsForPlatform: (platform: string, userId: string) => Promise<Account[]>
  getAccountByPlatformAndAccountId: (userId: string, platform: SocialMediaPlatform, accountId: string) => Promise<SocialMediaAccount | null>
  updateAccount: (id: string, data: UpdateSocialMediaAccountData, userId?: string) => Promise<SocialMediaAccount | null>
  createOrUpdateAccount: (params: {
    id: string
    name: string
    access_token: string
    picture: string
    username: string
    user: User
    businessId: string
    platformId: SocialMediaPlatform
  }) => Promise<SocialMediaAccount | null>
  createOrUpdateAccountFromAuth: (params: {
    id: string
    name: string
    access_token: string
    picture: string
    username: string
    platformId: SocialMediaPlatform
    user: User
  }) => Promise<SocialMediaAccount | null>
  getAccountByAccountId: (id: string, userId?: string) => Promise<SocialMediaAccount | undefined>
  refreshTokens: (id: string, tokenData: TokenRefreshData, userId?: string) => Promise<SocialMediaAccount | null>
  deactivateAccount: (id: string, userId?: string) => Promise<SocialMediaAccount | null>
  deleteAccount: (id: string, userId?: string) => Promise<boolean>
  isTokenExpired: (account: SocialMediaAccount) => boolean
  getDecryptedTokens: (account: SocialMediaAccount) => Promise<{ accessToken: string | null; refreshToken: string | null }>
  getAccountsNeedingRefresh: () => Promise<SocialMediaAccount[]>
  validateAccountConnection: (id: string, userId?: string) => Promise<{ isValid: boolean; needsRefresh: boolean }>
}

export type SubscriptionServiceType = {
  create: (userId: string, data: CreateSubscriptionData) => Promise<ServiceResponse<Subscription>>
  findById: (id: string, userId: string) => Promise<ServiceResponse<Subscription>>
  findByUserId: (userId: string) => Promise<ServiceResponse<Subscription>>
  findByStripeId: (stripeSubscriptionId: string) => Promise<ServiceResponse<Subscription>>
  update: (id: string, userId: string, data: UpdateSubscriptionData) => Promise<ServiceResponse<Subscription>>
  updateByUserId: (userId: string, data: UpdateSubscriptionData) => Promise<ServiceResponse<Subscription>>
  cancel: (userId: string) => Promise<ServiceResponse<Subscription>>
  reactivate: (userId: string) => Promise<ServiceResponse<Subscription>>
  getExpiringSoon: (daysThreshold?: number) => Promise<ServiceResponse<Subscription[]>>
  getTrialsEndingSoon: (daysThreshold?: number) => Promise<ServiceResponse<Subscription[]>>
  getLimits: (tier: string) => SubscriptionLimits
  checkLimit: (userId: string, limitType: keyof SubscriptionLimits) => Promise<ServiceResponse<{ allowed: boolean; current: number; limit: number }>>
  delete: (id: string, userId: string) => Promise<ServiceResponse<void>>
}

export type TemplateServiceType = {
  create: (userId: string, data: CreateTemplateData) => Promise<ServiceResponse<TemplateWithAssets>>
  findById: (id: string, userId: string) => Promise<ServiceResponse<TemplateWithAssets>>
  findByOwner: (ownerId: string, options?: QueryOptions) => Promise<PaginatedResponse<Template>>
  findPublic: (options?: QueryOptions) => Promise<PaginatedResponse<Template>>
  update: (id: string, userId: string, data: UpdateTemplateData) => Promise<ServiceResponse<Template>>
  delete: (id: string, userId: string) => Promise<ServiceResponse<Template>>
  addAsset: (templateId: string, userId: string, name: string, url: string) => Promise<ServiceResponse<TemplateAsset>>
  removeAsset: (templateId: string, assetId: string, userId: string) => Promise<ServiceResponse<TemplateAsset>>
}

export type PostStatsServiceType = {
  countPosts: (filters: {
    userId: string
    businessId?: string
    startDate?: string
    endDate?: string
  }) => Promise<number>
  getPostStats: (businessId: string, userId: string, filters?: { startDate?: string; endDate?: string; timezone?: string }) => Promise<ServiceResponse<Record<string, any>>>
}

export type PostBatchServiceType = {
  getPostsToProcessNow: () => Promise<PostWithAllData[]>
  scheduleRetry: (postId: string, currentRetryCount: number, error: string) => Promise<ServiceResponse<Post>>
  updatePostBaseOnResponse: (post: PostWithAllData, response: PostResponse, socialPlatform: PlatformPost) => Promise<void>
}

export type UserLlmConfigServiceType = {
  getConfigs: (userId: string) => Promise<ServiceResponse<UserLlmConfig[]>>
  getDefaultConfig: (userId: string) => Promise<ServiceResponse<UserLlmConfig>>
  createConfig: (userId: string, data: CreateLlmConfigData) => Promise<ServiceResponse<UserLlmConfig>>
  updateConfig: (userId: string, configId: string, data: UpdateLlmConfigData) => Promise<ServiceResponse<UserLlmConfig>>
  deleteConfig: (userId: string, configId: string) => Promise<ServiceResponse<UserLlmConfig>>
  setDefault: (userId: string, configId: string) => Promise<ServiceResponse<UserLlmConfig>>
}
