// The game's phase and whether it is paused, polled by every page to show a
// banner.
export default defineEventHandler(async () => {
  const { phase, paused, pauseMessage } = await getGame();
  return { phase, paused, pauseMessage };
});
