import * as OSM from "osm-api";
import { createContext, onMount } from "svelte";

import { asset } from "$app/paths";

if (import.meta.env.DEV) {
  OSM.configure({ apiUrl: "https://master.apis.dev.openstreetmap.org" });
}

export class OSMUser {
  loggedIn: boolean | undefined = $state();

  constructor() {
    onMount(() => {
      this.loggedIn = OSM.isLoggedIn();
    });
  }

  login() {
    OSM.login({
      mode: "popup",
      clientId: import.meta.env.DEV
        ? "53b1cGdSImpMlGu0_tuRbnlF2K4jd1E_9M_87K_JMhw"
        : "PhOrL2FCMUtJ5v3WrOAfVh5qdI5CIzQ6Wsf_YVpBNtg",
      redirectUrl: `${window.location.origin}${asset("/osm-login.html")}`,
      scopes: ["read_prefs", "write_api"],
    }).then(() => {
      this.loggedIn = OSM.isLoggedIn();
    });
  }

  logout() {
    OSM.logout();
    this.loggedIn = OSM.isLoggedIn();
  }
}

export const [getOsmUser, setOsmUser] = createContext<OSMUser>();
