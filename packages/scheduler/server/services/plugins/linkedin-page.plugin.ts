import { getPublicUrlForAsset } from './../../utils/ScheduleUtils';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import sharp from 'sharp';
import type { LinkedInSettings } from '#layers/BaseScheduler/shared/platformSettings';
import { platformConfigurations } from '#layers/BaseScheduler/shared/platformConstants';
import { BaseSchedulerPlugin, type PluginPostDetails, type PluginSocialMediaAccount, type PostResponse } from '../SchedulerPost.service';
import type { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages';

/**
 * LinkedIn Page Plugin - Posts on behalf of LinkedIn Organization/Company pages
 * Requires w_organization_social scope and organization admin/content admin role
 */

export class LinkedInPagePlugin extends BaseSchedulerPlugin {
  override getStatistic(postDetails: PluginPostDetails, socialMediaAccount: PluginSocialMediaAccount): Promise<any> {
    throw new Error('Method not implemented.');
  }
  static readonly pluginName = 'linkedin-page';
  readonly pluginName = 'linkedin-page';

  private getPlatformData(postDetails: PluginPostDetails) {
    const platformName = this.pluginName;
    const platformContent = (postDetails as any).platformContent?.[platformName];
    const platformSettings = (postDetails as any).platformSettings?.[platformName] as LinkedInSettings | undefined;
    return {
      content: platformContent?.content || postDetails.content,
      settings: platformSettings,
      postFormat: (postDetails as any).postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'linkedInMaxLength',
    'pages',
    'fetchPageInformation',
  ] as const;
  override maxConcurrentJob = platformConfigurations['linkedin-page'].maxConcurrentJob;

  linkedInMaxLength() {
    return platformConfigurations['linkedin-page'].maxPostLength;
  }

  protected init(options?: any): void {
    console.log('LinkedIn Page plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];

    if (!post.content || post.content.trim() === '') {
      errors.push('Post content cannot be empty.');
    }

    if (post.content && post.content.length > platformConfigurations['linkedin-page'].maxPostLength) {
      errors.push(`Post content is too long (max ${platformConfigurations['linkedin-page'].maxPostLength} characters)`);
    }

    return Promise.resolve(errors);
  }

  /**
   * Get organization information
   */
  async pages(_: any, accessToken: string): Promise<FacebookPage[]> {
    const { elements, ...all } = await (
      await fetch(
        'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~(localizedName,vanityName,logoV2(original~:playableStreams))))',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202501',
          },
        }
      )
    ).json();
    const imagePromises = await Promise.all(
      (elements || []).map((e: any) => {
        const url = e['organizationalTarget~'].logoV2?.['original~']?.elements?.[0]?.identifiers?.[0]?.identifier;
        if (!url) {
          return null;
        }
        return fetchedImageBase64(url);
      }));
    const imageBase64s = await Promise.all(imagePromises);

    const pages: FacebookPage[] = (elements || []).map((e: any, index: number) => ({
      imageBase64: imageBase64s[index],
      id: e.organizationalTarget.split(':').pop(),
      page: e.organizationalTarget.split(':').pop(),
      username: e['organizationalTarget~'].vanityName,
      name: e['organizationalTarget~'].localizedName,
      picture: {
        data: {
          url: e['organizationalTarget~'].logoV2?.['original~']?.elements?.[0]?.identifiers?.[0]?.identifier || '',
        },
      }
    }));

    return pages;
  }
  async fetchPageInformation(_: LinkedInPagePlugin, pageId: string, accessToken: string, params: { page: string }): Promise<{
    id: string;
    name: string;
    access_token: string;
    picture: string;
    username: string;
  }> {

    const data = await (
      await fetch(
        `https://api.linkedin.com/v2/organizations/${pageId}?projection=(id,localizedName,vanityName,logoV2(original~:playableStreams))`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
    ).json();



    if (!data) {
      throw new Error('Page not found');
    }
    const imageUrl = data?.logoV2?.['original~']?.elements?.[0]?.identifiers?.[0].identifier;
    const imageBase64 = imageUrl ? await fetchedImageBase64(imageUrl) : '';


    return {
      id: data.id,
      name: data.localizedName,
      picture: imageBase64,
      username: data.vanityName,
      access_token: accessToken,
    };
  }

  /**
   * Upload image to LinkedIn (same as personal profile)
   */
  private async uploadImage(organizationUrn: string, imageBuffer: Buffer, accessToken: string): Promise<string> {
    // Step 1: Register upload
    const registerResponse = await fetch(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202401',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: organizationUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        }),
      }
    );

    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value.uploadMechanism[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ].uploadUrl;
    const asset = registerData.value.asset;

    // Step 2: Upload the image
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer as unknown as BodyInit,
    });

    return asset;
  }

  override async post(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      const { content } = this.getPlatformData(postDetails);

      const author = socialMediaAccount.metadata?.organizationUrn ||
        `urn:li:organization:${socialMediaAccount.accountId.replace('.0', '')}`;

      // Check for media
      const imageAsset = postDetails.assets?.find(
        (asset) => asset.mimeType.includes('image')
      );

      let mediaUrn = '';

      if (imageAsset) {
        // Fetch image buffer
        const path = getFileFromAsset(imageAsset);
        const arrayBuffer = await reduceImageBySize(path, 8 * 1024 * 1024);
        const imageBuffer = Buffer.from(arrayBuffer.buffer);

        // Upload image
        mediaUrn = await this.uploadImage(
          author,
          imageBuffer,
          socialMediaAccount.accessToken
        );
      }

      const shareBody: any = {
        author: author,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: mediaUrn ? 'IMAGE' : 'NONE',
            media: mediaUrn
              ? [
                {
                  status: 'READY',
                  description: {
                    text: 'Image',
                  },
                  media: mediaUrn,
                  title: {
                    text: 'Image',
                  },
                },
              ]
              : [],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202401',
        },
        body: JSON.stringify(shareBody),
      });


      if (!response.ok) {
        const error = await response.text();
        await this.logPluginEvent('post-error:response', 'failure', `Error: ${error}, Context: ${JSON.stringify(shareBody)}`);

        throw new Error(`LinkedIn Page API error: ${error}`);

      }

      const data = await response.json();
      const postId = data.id;

      // Extract share ID from the URN
      const shareId = postId.replace('urn:li:share:', '').replace('urn:li:ugcPost:', '');

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId,
        releaseURL: `https://www.linkedin.com/feed/update/${shareId}/`,
        status: 'published',
      };

      this.emit('linkedin-page:post:published', { postId: postResponse.postId, response: data });
      return postResponse;
    } catch (error: unknown) {

      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      await this.logPluginEvent('post-error:response', 'failure', `Error: ${error}, Context: ${JSON.stringify(errorResponse)}`);
      this.emit('linkedin-page:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    // LinkedIn doesn't support editing posts via API
    const errorResponse: PostResponse = {
      id: postDetails.id,
      postId: postDetails.postId || '',
      releaseURL: '',
      status: 'failed',
      error: 'LinkedIn does not support editing organization posts via API.',
    };
    this.emit('linkedin-page:post:update:failed', {
      error: 'LinkedIn API does not support post editing'
    });
    return Promise.resolve(errorResponse);
  }

  override async addComment(
    postDetails: PluginPostDetails,
    commentDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    try {
      if (!postDetails.postId) {
        throw new Error('Post ID is required for commenting');
      }

      const organizationUrn = socialMediaAccount.metadata?.organizationUrn ||
        `urn:li:organization:${socialMediaAccount.accountId}`;

      const commentData = {
        actor: organizationUrn,
        message: {
          text: commentDetails.content,
        },
        object: postDetails.postId,
      };

      const response = await fetch('https://api.linkedin.com/v2/socialActions/comments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202401',
        },
        body: JSON.stringify(commentData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LinkedIn Page comment failed: ${error}`);
      }

      const data = await response.json();

      const commentResponse: PostResponse = {
        id: commentDetails.id,
        postId: data.id,
        releaseURL: postDetails.releaseURL || '',
        status: 'published',
      };

      this.emit('linkedin-page:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
      return commentResponse;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('linkedin-page:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }
}
