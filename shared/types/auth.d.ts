import type { Role } from "~~/prisma/generated/enums";

declare module "#auth-utils" {
  interface User {
    id: string;
    intraLogin: string;
    role: Role;
  }
}

export {};
