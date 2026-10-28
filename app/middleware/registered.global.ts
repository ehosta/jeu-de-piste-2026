// A 42 account no admin added to the game yet waits on /attente, and leaves it
// as soon as its profile exists.
export default defineNuxtRouteMiddleware((to) => {
  const { user } = useUserSession();
  const waiting = !!user.value && !user.value.role;

  if (waiting && to.path !== "/attente") {
    return navigateTo("/attente");
  }

  if (!waiting && to.path === "/attente") {
    return navigateTo("/");
  }
});
