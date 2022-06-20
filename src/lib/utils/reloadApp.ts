export const reloadApp = (window: Window, reloadDelay: number) => {
	setTimeout(() => {
		window.location.reload();
	}, reloadDelay);
};
