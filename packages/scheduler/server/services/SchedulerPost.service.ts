import { ValidationError } from '#layers/BaseAssets/server/shared/assetsTypes';
import { type Post, type SocialMediaAccount as Integration, type Account, type SocialMediaAccount, type PostWithAllData } from '#layers/BaseDB/db/schema';
import { EventEmitter } from 'events';

// Simplified types based on the core requirements for SchedulerPost
export type { Integration };
export type PostResponse = {
  id: string;
  postId: string;
  releaseURL: string;
  status: 'pending' | 'published' | 'failed';
  error?: string;
};

export type PollDetails = {
  options: string[]; // Array of poll options
  duration: number; // Duration in hours for which the poll will be active
};

export type MediaContent = {
  type: 'image' | 'video';
  path: string;
  alt?: string;
  thumbnail?: string;
  thumbnailTimestamp?: number;
};

export type PostDetails<T = Record<string, unknown>> = {
  id: string;
  message: string;
  settings: T;
  media?: MediaContent[];
  poll?: PollDetails;
  comments?: PostDetails[];
};


export interface SchedulerPlugin {
  readonly pluginName: string;
  readonly exposedMethods?: readonly string[];
  [key: string]: unknown; // Allow for additional properties

  onRegister?(scheduler: SchedulerPost): void;
  onDestroy?(): void;

  validate(postDetail: Post): Promise<string[]>;
  post(
    postDetails: PostWithAllData,
    comments: PostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse>;
  update(
    postDetails: PostWithAllData,
    comments: PostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse>;
  addComment(
    postDetails: PostWithAllData,
    comments: PostDetails,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse>;
}

export interface SchedulerPluginConstructor {
  new(scheduler: SchedulerPost, options?: any): BaseSchedulerPlugin;
  pluginName: string;
}

export abstract class BaseSchedulerPlugin implements SchedulerPlugin {
  abstract readonly pluginName: string;
  public scheduler: SchedulerPost;
  public exposedMethods?: readonly (string & keyof this)[];
  [key: string]: unknown;

  // Optional methods
  onRegister?(scheduler: SchedulerPost): void;
  onDestroy?(): void;

  constructor(scheduler: SchedulerPost, options?: any) {
    this.scheduler = scheduler;
    this.init(options);
  }

  protected abstract init(options?: any): void;

  protected emit(event: string, ...args: unknown[]) {
    this.scheduler.emit(event, ...args);
  }

  abstract validate(postDetail: Post): Promise<string[]>;
  abstract post(
    postDetails: PostWithAllData,
    comments: PostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse>;
  abstract update(
    postDetails: PostWithAllData,
    comments: PostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse>;
  abstract addComment(
    postDetails: PostWithAllData,
    comments: PostDetails,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse>;
}

export class SchedulerPost extends EventEmitter {
  private post: Post | null = null;
  private accounts: Account[] | null = null;

  private plugins: Map<string, SchedulerPlugin> = new Map();
  [key: string]: unknown;

  constructor({ post, accounts }: { post?: Post, accounts?: Account[] }) {
    super();
    if (post) {
      this.post = post;
    }
    if (accounts) {
      this.accounts = accounts;
    }
  }




  use(pluginClass: SchedulerPluginConstructor, options?: any): this {
    const pluginName = pluginClass.pluginName;
    if (this.plugins.has(pluginName)) {
      throw new Error(`Plugin ${pluginName} already registered`);
    }

    const plugin = new pluginClass(this, options);
    this.plugins.set(pluginName, plugin);
    plugin.onRegister?.(this);

    const exposedMethods = plugin.exposedMethods || [];
    exposedMethods.forEach(method => {
      if (!(plugin)[method]) {
        throw new Error(`Method ${method} not found on plugin ${pluginName}`);
      }
      this[method] = (plugin[method] as Function).bind(plugin, [...arguments]);
    });

    return this;
  }

  getPlugin(name: string): SchedulerPlugin | undefined {
    return this.plugins.get(name);
  }

  destroy() {
    this.plugins.forEach(plugin => plugin.onDestroy?.());
    this.plugins.clear();
  }

  async validate(postDetails: Post): Promise<{ [pluginName: string]: string[] }> {
    const errors: { [pluginName: string]: string[] } = {};
    for (const [pluginName, plugin] of this.plugins.entries()) {
      const pluginErrors = await plugin.validate(postDetails);
      if (pluginErrors.length > 0) {
        errors[pluginName] = pluginErrors;
      }
    }
    return errors;
  }

  private async executeOnPlugins(
    action: 'post' | 'update' | 'addComment',
    params: unknown[],
    socialMediaAccount: SocialMediaAccount,
    eventPrefix: string,
    extraData: Record<string, unknown> = {}
  ): Promise<PostResponse> {
    const plugin = this.plugins.get(socialMediaAccount.platform);
    if (plugin) {
      try {
        const responses = await (plugin[action] as unknown as (...args: unknown[]) => Promise<PostResponse>)(...params, socialMediaAccount);
        this.emit(`${eventPrefix}:published`, { socialMediaAccountId: socialMediaAccount.accountId, responses, ...extraData });
        return responses;
      } catch (error: unknown) {
        this.emit(`${eventPrefix}:failed`, {
          ...extraData,
        });
        throw error;
      }
    } else {
      this.emit(`${eventPrefix}:failed`, {
        pluginName: socialMediaAccount.platform,
        error: 'Plugin not registered for this socialMediaAccount',
        socialMediaAccountId: socialMediaAccount.id,
        ...extraData,
      });
      throw new Error('Plugin not registered for this socialMediaAccount');
    }
  }

  async publish(
    postDetails: PostWithAllData,
    comments: PostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {

    const validationErrors = await this.validate(postDetails);
    if (Object.keys(validationErrors).length > 0) {
      this.emit('post:validation-failed', validationErrors);
      throw new Error('Post validation failed');
    }

    return this.executeOnPlugins('post', [postDetails, comments, socialMediaAccount], socialMediaAccount, 'post', { postDetails, comments });
  }

  async update(
    postDetails: PostWithAllData,
    comments: PostDetails[],
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    return this.executeOnPlugins('update', [postDetails, comments, socialMediaAccount], socialMediaAccount, 'post:update', { postDetails, comments });
  }

  async addComment(
    postDetails: PostWithAllData,
    comment: PostDetails,
    socialMediaAccount: SocialMediaAccount
  ): Promise<PostResponse> {
    return this.executeOnPlugins('addComment', [postDetails, comment, socialMediaAccount], socialMediaAccount, 'comment:add', { postDetails, comment });
  }
}
