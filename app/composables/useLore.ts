// The game's story: the one an admin wrote (/admin/lore), or else the default
// one in the reader's language. Live, like the rest of the game state.
export function useLore() {
  const { data: game } = useGame();
  const { t } = useI18n();

  return computed(() => game.value.lore || t("lore.default"));
}
