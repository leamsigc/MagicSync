import type { PostResponse, Integration, PluginPostDetails, PluginSocialMediaAccount, PlatformStats, GetCommentsResponse, ReplyCommentResponse, PlatformComment } from '../SchedulerPost.service';
import { BaseSchedulerPlugin, type MediaContent } from '../SchedulerPost.service';
import type { Post, PostWithAllData, SocialMediaAccount, Asset } from '#layers/BaseDB/db/schema';
import sharp from 'sharp';
import type { LinkedInSettings } from '../../../shared/platformSettings';

import { platformConfigurations } from '../../../shared/platformConstants';

export class LinkedInPlugin extends BaseSchedulerPlugin {
  static readonly pluginName = 'linkedin';
  readonly pluginName = 'linkedin';

  private normalizeContent(content: string): string {
    if (!content) return '';
    return content
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  private getPlatformData(postDetails: PluginPostDetails, platformPost?: any) {
    const platformName = this.pluginName;
    const platformPostSettings = platformPost?.platformSettings || {};
    const platformContent = platformPostSettings?.platformContent ||
      (postDetails as any).platformContent?.[platformName];
    const platformSettings = platformPostSettings ||
      (postDetails as any).platformSettings?.[platformName] as LinkedInSettings | undefined;

    const rawContent = platformContent?.content || postDetails.content;

    return {
      content: this.normalizeContent(rawContent),
      settings: platformSettings,
      postFormat: (postDetails as any).postFormat || 'post'
    };
  }

  public override exposedMethods = [
    'linkedInMaxLength',
    'getProfile',
  ] as const;
  override maxConcurrentJob = platformConfigurations.linkedin.maxConcurrentJob; // LinkedIn has professional posting limits

  linkedInMaxLength() {
    return platformConfigurations.linkedin.maxPostLength;
  }

  protected init(options?: any): void {
    console.log('LinkedIn Personal plugin initialized', options);
  }

  override async validate(post: Post): Promise<string[]> {
    const errors: string[] = [];

    if (!post.content || post.content.trim() === '') {
      errors.push('Post content cannot be empty.');
    }

    if (post.content && post.content.length > platformConfigurations.linkedin.maxPostLength) {
      errors.push(`Post content is too long (max ${platformConfigurations.linkedin.maxPostLength} characters)`);
    }

    return Promise.resolve(errors);
  }

  /**
   * Get LinkedIn user profile
   */
  async getProfile(accessToken: string): Promise<any> {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.json();
  }

  /**
   * Upload image to LinkedIn
   */
  private async uploadImage(personUrn: string, imageBuffer: Buffer, accessToken: string): Promise<string> {
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
            owner: personUrn,
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
      body: imageBuffer as any,
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
          `urn:li:person:${socialMediaAccount.accountId}`,
          imageBuffer,
          socialMediaAccount.accessToken
        );
      }

      const shareBody: any = {
        author: `urn:li:person:${socialMediaAccount.accountId}`,
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
                    text: imageAsset?.filename || 'Image',
                  },
                  media: mediaUrn,
                  title: {
                    text: imageAsset?.filename || 'Image',
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
        throw new Error(`LinkedIn API error: ${error}`);
      }

      const data = await response.json();
      const postId = data.id;

      // Extract share ID from the URN
      let shareId = postId;
      if (shareId.includes(':')) {
        const parts = shareId.split(':');
        shareId = parts[parts.length - 1];
      }

      const postResponse: PostResponse = {
        id: postDetails.id,
        postId,
        releaseURL: `https://www.linkedin.com/feed/update/urn:li:activity:${shareId}/`,
        status: 'published',
      };

      this.emit('linkedin:post:published', { postId: postResponse.postId, response: data });
      return postResponse;
    } catch (error: unknown) {

      this.logPluginEvent('LinkedIn:post-error', 'failure', `Error: ${(error as Error).message}`, postDetails.id);
      const errorResponse: PostResponse = {
        id: postDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('linkedin:post:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  override async update(
    postDetails: PluginPostDetails,
    comments: PluginPostDetails[],
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PostResponse> {
    const publishedPlatformDetails = postDetails.platformPosts.find((platform) => platform.socialAccountId === socialMediaAccount.id);
    if (!publishedPlatformDetails) {
      throw new Error('Published platform details not found');
    }

    const publishedDetails = publishedPlatformDetails.publishDetail ? JSON.parse(publishedPlatformDetails.publishDetail as string) as PostResponse : null;
    if (!publishedDetails) {
      throw new Error('Published details not found');
    }
    const publishedPostId = publishedDetails.postId;

    // LinkedIn textual edit is theoretically possible via UGC API PATCH but complex and often restricted.
    // For now, consistent with previous behavior but using correct ID retrieval.
    // If we wanted to support it, we'd need to PATCH urn:li:ugcPost:...

    throw new Error('LinkedIn does not support editing posts via API. Please delete and recreate the post instead.');
  }

  async getStatistic(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount
  ): Promise<PlatformStats> {
    // Fetch LinkedIn user profile with network stats
    const profileResponse = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreamingSymlink)),numConnections,numConnectionsCapped', {
      headers: {
        Authorization: `Bearer ${socialMediaAccount.accessToken}`,
        'LinkedIn-Version': '202401',
      },
    })
    const profile = await profileResponse.json()

    // Fetch posts for engagement aggregation
    let totalEngagement = 0
    let totalPosts = 0
    try {
      const postsResponse = await fetch('https://api.linkedin.com/v2/ugcPosts?count=50&q=authors&authors=List(~)', {
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'LinkedIn-Version': '202401',
        },
      })
      const postsData = await postsResponse.json()
      const elements = postsData.elements || []
      totalPosts = elements.length
      for (const post of elements) {
        totalEngagement += (post.totalSocialStatistics?.shareCount || 0) +
          (post.totalSocialStatistics?.likeCount || 0) +
          (post.totalSocialStatistics?.commentCount || 0)
      }
    } catch {
      // Posts fetch failed
    }

    return {
      platform: 'linkedin',
      accountId: profile.id || socialMediaAccount.accountId,
      username: `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim() || socialMediaAccount.accountName || '',
      picture: profile.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier || undefined,
      fetchedAt: new Date().toISOString(),
      followers: profile.numConnections,
      posts: totalPosts,
      engagement: {
        total: totalEngagement,
        likes: 0,
        comments: 0,
        shares: 0,
      },
      growth: undefined,
    }
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

      const personUrn = socialMediaAccount.metadata?.personUrn ||
        `urn:li:person:${socialMediaAccount.accountId}`;

      const commentData = {
        actor: personUrn,
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
        throw new Error(`LinkedIn comment failed: ${error}`);
      }

      const data = await response.json();

      const commentResponse: PostResponse = {
        id: commentDetails.id,
        postId: data.id,
        releaseURL: postDetails.releaseURL || '',
        status: 'published',
      };

      this.emit('linkedin:comment:added', { commentId: commentResponse.postId, postDetails, commentDetails });
      return commentResponse;
    } catch (error: unknown) {
      const errorResponse: PostResponse = {
        id: commentDetails.id,
        postId: '',
        releaseURL: '',
        status: 'failed',
        error: (error as Error).message,
      };
      this.emit('linkedin:comment:failed', { error: (error as Error).message });
      return errorResponse;
    }
  }

  /**
   * Transform LinkedIn social action to PlatformComment format
   */
  private transformComment(comment: any): PlatformComment {
    return {
      id: comment.id || comment.$id,
      text: comment.message?.text || comment.text || '',
      authorName: comment.actor?.name || comment.created?.actor?.name || 'Unknown',
      authorId: comment.actor?.id || comment.created?.actor?.id,
      createdAt: comment.created?.time || comment.createdAt,
      likeCount: comment.likesSummary?.totalLikes,
      replyCount: comment.commentsSummary?.totalPosts || 0,
      parentId: comment.parent || comment.inReplyTo,
    };
  }

  /**
   * Get comments for a LinkedIn post
   * LinkedIn API has limited support for fetching comments
   */
  async getComments(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    options?: { limit?: number; cursor?: string }
  ): Promise<GetCommentsResponse> {
    const platformPost = postDetails.platformPosts?.find((pp: any) => pp.socialAccountId === socialMediaAccount.id);
    const publishDetail = platformPost?.publishDetail ? JSON.parse(platformPost.publishDetail) : {};
    const externalPostId = publishDetail[socialMediaAccount.id]?.publishedId || publishDetail.postId;

    if (!externalPostId) {
      return Promise.resolve({ platform: this.pluginName, postId: '', comments: [], hasMore: false });
    }

    try {
      // LinkedIn socialActions endpoint for fetching reactions/comments
      const params = new URLSearchParams({
        q: 'socialMetadata',
        keys: externalPostId,
        types: 'COMMENTS',
        count: String(options?.limit || 50),
      });

      const response = await fetch(`https://api.linkedin.com/v2/socialActions/${externalPostId}/comments?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'LinkedIn-Version': '202401',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LinkedIn get comments failed: ${error}`);
      }

      const data = await response.json();
      const elements = data.elements || [];
      const comments: PlatformComment[] = elements.map((c: any) => this.transformComment(c));

      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments,
        hasMore: data.paging?.count > 0,
        nextCursor: data.paging?.start + data.paging?.count < data.paging?.total ? String(data.paging?.start + data.paging?.count) : undefined,
      };
    } catch (error) {
      console.error('Error fetching LinkedIn comments:', error);
      return {
        platform: this.pluginName,
        postId: externalPostId,
        comments: [],
        hasMore: false,
      };
    }
  }

  /**
   * Reply to a comment on LinkedIn
   */
  async replyToComment(
    postDetails: PluginPostDetails,
    socialMediaAccount: PluginSocialMediaAccount,
    commentId: string,
    replyText: string
  ): Promise<ReplyCommentResponse> {
    try {
      const personUrn = socialMediaAccount.metadata?.personUrn ||
        `urn:li:person:${socialMediaAccount.accountId}`;

      const replyData = {
        actor: personUrn,
        message: {
          text: replyText,
        },
        object: commentId, // Reply to the parent comment
      };

      const response = await fetch('https://api.linkedin.com/v2/socialActions/comments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${socialMediaAccount.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202401',
        },
        body: JSON.stringify(replyData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LinkedIn reply failed: ${error}`);
      }

      const data = await response.json();

      return {
        success: true,
        comment: this.transformComment(data),
      };
    } catch (error) {
      console.error('Error replying to LinkedIn comment:', error);
      return {
        success: false,
        error: (error as Error).message || 'Failed to reply to comment',
      };
    }
  }
}
