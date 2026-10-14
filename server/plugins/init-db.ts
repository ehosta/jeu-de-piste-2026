export default defineNitroPlugin(async () => {
  const logins = useRuntimeConfig()
    .adminLogins.split(",")
    .map((login) => login.trim());

  for (const login of logins) {
    await prisma.user.upsert({
      where: {
        intraLogin: login,
      },
      update: {
        role: "ADMIN",
      },
      create: {
        intraLogin: login,
        role: "ADMIN",
      },
    });
  }
});
