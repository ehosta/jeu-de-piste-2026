// A 42 account no admin added to the game yet waits on /attente, and leaves it
// as soon as its profile exists.
export default defineNuxtRouteMiddleware((to) => {
  const { user } = useUserSession();
  const waiting = !!user.value && !user.value.role;

  // Keeps `?login_error=`: /attente has a login button too.
  if (waiting && to.path !== "/attente") {
    return navigateTo({ path: "/attente", query: to.query });
  }

  if (!waiting && to.path === "/attente") {
    return navigateTo("/");
  }
});
