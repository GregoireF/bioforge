declare module "astro:actions" {
	type Actions = typeof import("C:/Users/grego/Desktop/TikTok Gaming - GitHub/bioforge/src/actions.ts")["server"];

	export const actions: Actions;
}