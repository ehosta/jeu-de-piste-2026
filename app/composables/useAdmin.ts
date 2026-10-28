import type {
  AdminPatch,
  PatchIssue,
  PatchReport,
  WipeTarget,
} from "#shared/utils/admin-patch";
import type { Translate } from "./useI18n";

export type AdminState = NonNullable<
  Awaited<ReturnType<typeof useAdminState>>["data"]["value"]
>;

// Bocal see the admin pages without anything to change the game.
export function useCanEdit() {
  const { user } = useUserSession();
  return computed(() => !!user.value?.isAdmin);
}

// The data every admin page shows, fetched once and shared between them.
export function useAdminState() {
  return useFetch("/api/admin/state", { key: "admin-state" });
}

export interface AdminToast {
  tone: "success" | "error";
  text: string;
  issues?: PatchIssue[];
}

// Every admin edit goes through the same patch endpoint as the JSON import.
export function useAdminPatch() {
  const { t } = useI18n();
  const busy = useState("admin-busy", () => false);
  const toast = useState<AdminToast | null>("admin-toast", () => null);

  async function apply(
    patch: AdminPatch,
    options: { confirm?: string; success?: string; dryRun?: boolean } = {},
  ): Promise<PatchReport | null> {
    if (options.confirm && !window.confirm(options.confirm)) {
      return null;
    }

    busy.value = true;

    try {
      const report = await $fetch("/api/admin/patch", {
        method: "POST",
        body: patch,
        query: options.dryRun ? { dryRun: "1" } : undefined,
      });

      if (!options.dryRun) {
        await refreshNuxtData(["admin-state", "admin-views", "game"]);
        toast.value = {
          tone: "success",
          text: options.success ?? describeReport(report, t),
        };
      }

      return report;
    } catch (error) {
      toast.value = toastFromError(error, t);
      // Puts back the inputs that were changed optimistically (e.g. selects).
      await refreshNuxtData("admin-state");
      return null;
    } finally {
      busy.value = false;
    }
  }

  return { busy, toast, apply };
}

export function toastFromError(error: unknown, t: Translate): AdminToast {
  const data = (error as { data?: { data?: { issues?: PatchIssue[] } } }).data;
  const issues = data?.data?.issues;

  if (issues?.length) {
    return {
      tone: "error",
      text:
        issues.length === 1
          ? t("admin.toast.refusedOne")
          : t("admin.toast.refusedMany", { count: issues.length }),
      issues,
    };
  }

  return { tone: "error", text: t("common.error") };
}

export function describeIssue(issue: PatchIssue, t: Translate) {
  return t(`patch.${issue.code}`, issue.params);
}

const ENTITIES = ["teams", "users", "npcs", "quests", "progress"] as const;
const ACTIONS = ["created", "updated", "deleted"] as const;

// "2 groupes créés, 1 quête supprimée", for toasts and import previews.
export function describeReport(report: PatchReport, t: Translate) {
  const parts: string[] = [];

  for (const [target, count] of Object.entries(report.wiped)) {
    parts.push(
      t("admin.report.wiped", {
        target: t(`admin.report.targets.${target as WipeTarget}`),
        count: count ?? 0,
      }),
    );
  }

  for (const entity of ENTITIES) {
    for (const action of ACTIONS) {
      const count = report[entity][action];

      if (count) {
        parts.push(t(`admin.report.${entity}.${action}`, { count }));
      }
    }
  }

  if (report.game) {
    parts.push(t("admin.report.game"));
  }

  if (!parts.length) {
    return t("admin.report.nothing");
  }

  const text = parts.join(", ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
