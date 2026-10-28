export type ActAsTarget =
  | { role: "ADMIN" }
  | { role: "PLAYER"; teamId: string }
  | { role: "NPC"; npcId: string }
  | { role: "USER"; userId: string };

// Switches what this session shows (see /api/admin/act-as), then opens the
// page that view starts on. Throws if the team, NPC or account is gone.
export function useActAs() {
  const { user, fetch: fetchSession } = useUserSession();

  async function actAs(target: ActAsTarget) {
    await $fetch("/api/admin/act-as", { method: "POST", body: target });
    await fetchSession();
    await refreshNuxtData("admin-views");

    if (target.role === "ADMIN") {
      return navigateTo("/admin");
    }

    return navigateTo(user.value?.role === "NPC" ? "/scan" : "/");
  }

  return { actAs };
}

// "PLAYER:<id>" in the dashboard switch's <select> to an act-as target.
export function parseActAsValue(value: string): ActAsTarget {
  const [role, id = ""] = value.split(":");

  switch (role) {
    case "PLAYER":
      return { role, teamId: id };
    case "NPC":
      return { role, npcId: id };
    case "USER":
      return { role, userId: id };
    default:
      return { role: "ADMIN" };
  }
}
