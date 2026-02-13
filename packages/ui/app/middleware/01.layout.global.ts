import type { NuxtLayouts } from '#app';

export default defineNuxtRouteMiddleware(async (to) => {
  const routeStart = to.path
  const isBlog = routeStart.startsWith('/blogs/');
  const isAppRoute = routeStart.includes('/app');
  const isTools = routeStart.includes('/tools');
  const isUserSettingUpFirstBusiness = to.path.startsWith('/app/business/initial');
  const userLayoutSetting = useState("dashboard-layout", () => 'dashboard-layout');

  let layout = to.meta.layout || 'default';
  if (isBlog) {
    layout = 'blog-layout';
  } else if (isAppRoute && !isUserSettingUpFirstBusiness) {
    layout = userLayoutSetting.value as keyof NuxtLayouts;
  } else if (isTools) {
    layout = 'tools-layout';
  } else if (isUserSettingUpFirstBusiness) {
    layout = 'business-layout';
  } else {
    layout = to.meta.layout || 'default';
  }

  setPageLayout(layout as any,);
});
