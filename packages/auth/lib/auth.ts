import { admin, createAuthMiddleware, genericOAuth, organization } from 'better-auth/plugins';

const plugins = [
  admin({ ... }),
  organization({
    creatorRole: 'owner',
    memberRole: 'member',
    roles: {
      owner: { permissions: ['org:everything'] },
      admin: { permissions: ['org:manage_members', 'org:manage_posts', 'org:manage_settings', 'org:view_analytics'] },
      editor: { permissions: ['org:manage_posts', 'org:view_analytics'] },
      viewer: { permissions: ['org:view_posts', 'org:view_analytics'] },
    },
    allowUserToCreateOrganization: async (user) => {
      // Regular users: max 1 org. Admins: unlimited.
      if (user.role === 'admin') return true;
      // Count existing organizations for this user
      const db = useDrizzle();
      const existingOrgs = await db.query.organization.findMany({
        where: (org, { eq }) => eq(org.createdBy, user.id),
      });
      return (existingOrgs?.length ?? 0) < 1;
    },
  }),
  genericOAuth({ ... }),
];