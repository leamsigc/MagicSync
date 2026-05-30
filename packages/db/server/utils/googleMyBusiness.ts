/**
 * Google My Business API Integration Utility
 *
 * This utility provides functions to interact with the Google My Business API
 * for managing business profiles, reviews, posts, and Q&A.
 */

export interface GMBLocation {
  name: string
  locationName: string
  primaryPhone?: string
  primaryCategory?: {
    displayName: string
    categoryId: string
  }
  websiteUri?: string
  regularHours?: {
    periods: Array<{
      openDay: string
      openTime: string
      closeDay: string
      closeTime: string
    }>
  }
  latlng?: {
    latitude: number
    longitude: number
  }
  address?: {
    regionCode: string
    languageCode: string
    postalCode: string
    administrativeArea: string
    locality: string
    addressLines: string[]
  }
  profile?: {
    description?: string
  }
}

export interface GMBReview {
  name: string
  reviewId: string
  reviewer: {
    profilePhotoUrl?: string
    displayName: string
    isAnonymous: boolean
  }
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
  comment?: string
  createTime: string
  updateTime: string
  reviewReply?: {
    comment: string
    updateTime: string
  }
}

export interface GMBPost {
  name?: string
  languageCode: string
  summary: string
  event?: {
    title: string
    schedule: {
      startDate: {
        year: number
        month: number
        day: number
      }
      startTime?: {
        hours: number
        minutes: number
      }
      endDate: {
        year: number
        month: number
        day: number
      }
      endTime?: {
        hours: number
        minutes: number
      }
    }
  }
  topicType: 'STANDARD' | 'EVENT' | 'OFFER'
  media?: Array<{
    mediaFormat: 'PHOTO'
    sourceUrl: string
  }>
  callToAction?: {
    actionType: 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL'
    url?: string
  }
}

export interface GMBQuestion {
  name: string
  author: {
    displayName: string
    profilePhotoUrl?: string
    type: 'REGULAR_USER' | 'LOCAL_GUIDE'
  }
  upvoteCount: number
  text: string
  createTime: string
  updateTime: string
  topAnswers?: Array<{
    name: string
    author: {
      displayName: string
      profilePhotoUrl?: string
      type: 'REGULAR_USER' | 'LOCAL_GUIDE' | 'MERCHANT'
    }
    upvoteCount: number
    text: string
    createTime: string
    updateTime: string
  }>
}

export interface GMBAccount {
  name: string
  accountName: string
  type?: string
  state?: string
  [key: string]: unknown
}

export interface GMBAnswer {
  name: string
  text: string
  author: {
    displayName: string
    profilePhotoUrl?: string
    type: string
  }
  createTime: string
  updateTime: string
}

/**
 * Google My Business API client class
 */
export class GoogleMyBusinessAPI {
  private accessToken: string
  private baseUrl = 'https://mybusinessbusinessinformation.googleapis.com/v1'
  private accountManagementUrl = 'https://mybusinessaccountmanagement.googleapis.com/v1'

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  /**
  * Get all accounts accessible to the authenticated user
  */
  async getAccounts(): Promise<{ accounts: GMBAccount[] }> {
    try {
      // Construct the full URL for the accounts.list endpoint
      const url = `${this.accountManagementUrl}/accounts`;

      const accountsResponse = await fetch(
        url,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text()
        console.error('Failed to fetch business accounts:', {
          status: accountsResponse.status,
          statusText: accountsResponse.statusText,
          error: errorText,
        })
        throw new Error(
          `Failed to fetch business accounts: ${accountsResponse.status} ${accountsResponse.statusText}`
        )
      }

      return accountsResponse.json()

    } catch (error) {
      console.error('Error fetching GMB accounts:', error);
      // Re-throw the error so the caller can handle it
      throw error;
    }
  }

  /**
   * Get all locations for a specific account
   */
  async getLocations(accountName: string): Promise<GMBLocation[]> {
    try {
      const response = await fetch(`${this.baseUrl}/${accountName}/locations`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`GMB API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.locations || []
    } catch (error) {
      console.error('Error fetching GMB locations:', error)
      throw error
    }
  }

  /**
   * Get a specific location by name
   */
  async getLocation(locationName: string): Promise<GMBLocation> {
    try {
      const response = await fetch(`${this.baseUrl}/${locationName}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`GMB API Error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching GMB location:', error)
      throw error
    }
  }

  /**
   * Get reviews for a specific location
   */
  async getReviews(locationName: string): Promise<GMBReview[]> {
    try {
      const response = await fetch(`${this.baseUrl}/${locationName}/reviews`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`GMB API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.reviews || []
    } catch (error) {
      console.error('Error fetching GMB reviews:', error)
      throw error
    }
  }

  /**
   * Reply to a review
   */
  async replyToReview(reviewName: string, comment: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${reviewName}/reply`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment
        })
      })

      if (!response.ok) {
        throw new Error(`GMB API Error: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Error replying to GMB review:', error)
      throw error
    }
  }

  /**
   * Create a local post
   */
  async createPost(locationName: string, post: GMBPost): Promise<GMBPost> {
    try {
      const response = await fetch(`${this.baseUrl}/${locationName}/localPosts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(post)
      })

      if (!response.ok) {
        throw new Error(`GMB API Error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error creating GMB post:', error)
      throw error
    }
  }

  /**
   * Get questions for a location
   */
  async getQuestions(locationName: string): Promise<GMBQuestion[]> {
    try {
      const response = await fetch(`${this.baseUrl}/${locationName}/questions`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`GMB API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.questions || []
    } catch (error) {
      console.error('Error fetching GMB questions:', error)
      throw error
    }
  }

  /**
   * Answer a question
   */
  async answerQuestion(questionName: string, text: string): Promise<GMBAnswer> {
    try {
      const response = await fetch(`${this.baseUrl}/${questionName}/answers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text
        })
      })

      if (!response.ok) {
        throw new Error(`GMB API Error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error answering GMB question:', error)
      throw error
    }
  }
}

/**
 * Helper function to create a GMB API client instance
 */
export function createGMBClient(accessToken: string): GoogleMyBusinessAPI {
  return new GoogleMyBusinessAPI(accessToken)
}

/**
 * Helper function to convert star rating from string to number
 */
export function convertStarRating(rating: GMBReview['starRating']): number {
  const ratingMap = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5
  }
  return ratingMap[rating] || 0
}

/**
 * Helper function to format GMB location data for local storage
 */
export function formatLocationForStorage(location: GMBLocation) {
  return {
    googleBusinessId: location.name,
    name: location.locationName,
    description: location.profile?.description || '',
    address: location.address ?
      location.address.addressLines.join(', ') +
      (location.address.locality ? `, ${location.address.locality}` : '') +
      (location.address.administrativeArea ? `, ${location.address.administrativeArea}` : '') +
      (location.address.postalCode ? ` ${location.address.postalCode}` : '')
      : '',
    phone: location.primaryPhone || '',
    website: location.websiteUri || '',
    category: location.primaryCategory?.displayName || ''
  }
}

/**
 * Helper function to format GMB review data for local storage
 */
export function formatReviewForStorage(review: GMBReview, businessId: string) {
  return {
    businessId,
    platform: 'google_my_business',
    platformReviewId: review.reviewId,
    authorName: review.reviewer.displayName,
    authorImage: review.reviewer.profilePhotoUrl || null,
    rating: convertStarRating(review.starRating),
    content: review.comment || '',
    reviewDate: new Date(review.createTime),
    responseContent: review.reviewReply?.comment || null,
    responseDate: review.reviewReply ? new Date(review.reviewReply.updateTime) : null,
    isShared: false
  }
}

/**
 * Create a text post for GMB
 */
export function createTextPost(content: string, callToAction?: { type: GMBPost['callToAction']['actionType'], url?: string }): GMBPost {
  const post: GMBPost = {
    languageCode: 'en',
    summary: content,
    topicType: 'STANDARD'
  }

  if (callToAction) {
    post.callToAction = {
      actionType: callToAction.type,
      url: callToAction.url
    }
  }

  return post
}

/**
 * Create an event post for GMB
 */
export function createEventPost(
  title: string,
  content: string,
  startDate: Date,
  endDate: Date,
  startTime?: { hours: number, minutes: number },
  endTime?: { hours: number, minutes: number }
): GMBPost {
  return {
    languageCode: 'en',
    summary: content,
    topicType: 'EVENT',
    event: {
      title,
      schedule: {
        startDate: {
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1,
          day: startDate.getDate()
        },
        startTime,
        endDate: {
          year: endDate.getFullYear(),
          month: endDate.getMonth() + 1,
          day: endDate.getDate()
        },
        endTime
      }
    }
  }
}

/**
 * Create a post with images for GMB
 */
export function createImagePost(content: string, imageUrls: string[], callToAction?: { type: GMBPost['callToAction']['actionType'], url?: string }): GMBPost {
  const post: GMBPost = {
    languageCode: 'en',
    summary: content,
    topicType: 'STANDARD',
    media: imageUrls.map(url => ({
      mediaFormat: 'PHOTO',
      sourceUrl: url
    }))
  }

  if (callToAction) {
    post.callToAction = {
      actionType: callToAction.type,
      url: callToAction.url
    }
  }

  return post
}

/**
 * Generate review screenshot HTML for social sharing
 */
export function generateReviewScreenshotHTML(review: {
  authorName: string
  authorImage?: string
  rating: number
  content: string
  reviewDate: Date
  businessName: string
}): string {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating)
  const formattedDate = review.reviewDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `
    <div style="
      max-width: 500px;
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid #e1e5e9;
    ">
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        ${review.authorImage
      ? `
          <img src="${review.authorImage}" alt="${review.authorName}" style="
            width: 48px;
            height: 48px;
            border-radius: 50%;
            margin-right: 12px;
            object-fit: cover;
          ">
        `
      : `
          <div style="
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #4285f4;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 18px;
            margin-right: 12px;
          ">
            ${review.authorName.charAt(0).toUpperCase()}
          </div>
        `}
        <div>
          <div style="font-weight: 600; color: #202124; font-size: 16px;">
            ${review.authorName}
          </div>
          <div style="color: #5f6368; font-size: 14px;">
            ${formattedDate}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 12px;">
        <span style="color: #fbbc04; font-size: 20px; letter-spacing: 2px;">
          ${stars}
        </span>
      </div>

      <div style="color: #202124; font-size: 16px; line-height: 1.5; margin-bottom: 16px;">
        "${review.content}"
      </div>

      <div style="
        display: flex;
        align-items: center;
        padding-top: 16px;
        border-top: 1px solid #e8eaed;
        color: #5f6368;
        font-size: 14px;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#4285f4" style="margin-right: 8px;">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Review on Google for ${review.businessName}
      </div>
    </div>
  `
}

/**
 * Helper function to create social media post content from a review
 */
export function createSocialPostFromReview(review: {
  authorName: string
  rating: number
  content: string
  businessName: string
}): string {
  const stars = '⭐'.repeat(review.rating)

  let postContent = `${stars} Amazing review from ${review.authorName}!\n\n`
  postContent += `"${review.content}"\n\n`
  postContent += `Thank you for choosing ${review.businessName}! `
  postContent += `We're thrilled to have exceeded your expectations. 🙏\n\n`
  postContent += `#CustomerReview #FiveStars #ThankYou #${review.businessName.replace(/\s+/g, '')}`

  return postContent
}
