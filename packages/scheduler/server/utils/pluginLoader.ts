import { FacebookPlugin } from '../services/plugins/facebook.plugin';
import { XPlugin } from '../services/plugins/x.plugin';
import { InstagramPlugin } from '../services/plugins/instagram.plugin';
import type { SchedulerPluginConstructor } from '../services/SchedulerPost.service';

export const getPluginForPlatform = (platform: string): SchedulerPluginConstructor | undefined => {
    const plugins: Record<string, SchedulerPluginConstructor> = {
        facebook: FacebookPlugin,
        twitter: XPlugin,
        x: XPlugin,
        instagram: InstagramPlugin,
    };

    return plugins[platform.toLowerCase()];
};
