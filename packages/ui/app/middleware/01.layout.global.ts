import type { NuxtLayouts } from '#app';

export default defineNuxtRouteMiddleware(async (to) => {
  const routeStart = to.path
  const isBlog = routeStart.startsWith('/blogs/');
  const isAppRoute = routeStart.includes('/app');
  const isTools = routeStart.includes('/tools');
  const isAiTools = routeStart.includes('/ai-tools');
  const isUserSettingUpFirstBusiness = to.path.startsWith('/app/business/initial');
  const userLayoutSetting = useState("dashboard-layout", () => 'dashboard-layout');

  let layout: keyof NuxtLayouts =  to.meta.layout as keyof NuxtLayouts || 'default';

  console.log(to.meta.layout);
  console.log(userLayoutSetting.value);

  if (isBlog) {
    layout = 'blog-layout';
  } else if ( isAiTools) {
    layout = 'ai-tools-layout';
  }else if (isAppRoute && !isUserSettingUpFirstBusiness && (to.meta.layout === 'default' || to.meta.layout === undefined)) {
    layout = userLayoutSetting.value as keyof NuxtLayouts || 'dashboard-layout';
  } else if (isTools) {
    layout = 'tools-layout';
  } else if (isUserSettingUpFirstBusiness) {
    layout = 'business-layout';
  }else if (to.meta.layout !== 'default' && to.meta.layout !== undefined) {
    layout = to.meta.layout as keyof NuxtLayouts || 'default';
  }


  setPageLayout(layout as any,);
});
