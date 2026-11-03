// The game's phase, whether it is paused, and its story (null: the default
// one), for everyone, logged in or not. Refetched by every page when it
// changes (realtime event "game") to show a banner.
export default defineEventHandler(async () => {
  const { phase, paused, pauseMessage, lore } = await getGame();
  return { phase, paused, pauseMessage, lore };
});
