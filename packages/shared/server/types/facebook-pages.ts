// Facebook page data type
// Originally in connect/utils/FacebookPages.ts
// Extracted so db plugins and other layers can import without connect dependency.
export interface FacebookPage {
  id: string
  name: string
  imageBase64?: string
  platformType?: string
  instagram_business_account?: {
    id: string
  }
  picture: {
    data: {
      height: number
      is_silhouette: boolean
      url: string
      width: number
    }
  }
}
