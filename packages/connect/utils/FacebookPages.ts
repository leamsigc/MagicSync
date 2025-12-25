export interface FacebookPage {
  id: string;
  name: string;
  imageBase64?: string;
  instagram_business_account?: string;
  picture: {
    data:
    {
      height: number;
      is_silhouette: boolean;
      url: string;
      width: number
    }
  }
}
