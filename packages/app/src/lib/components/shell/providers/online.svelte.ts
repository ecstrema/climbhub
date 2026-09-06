import { browser } from "$app/environment";

export function createOnlineStatus() {
  let online = $state(browser ? navigator.onLine : true);

  if (browser) {
    $effect.root(() => {
      const updateStatus = () => {
        online = navigator.onLine;
      };

      window.addEventListener("online", updateStatus);
      window.addEventListener("offline", updateStatus);

      return () => {
        window.removeEventListener("online", updateStatus);
        window.removeEventListener("offline", updateStatus);
      };
    });
  }

  return {
    get current() {
      return online;
    },
  };
}

export const onlineStatus = createOnlineStatus();
