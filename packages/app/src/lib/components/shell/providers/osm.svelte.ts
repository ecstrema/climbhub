import type { OsmFeature, OsmChange, UploadPhase, UploadResult, OsmFeatureType } from "osm-api";
import { isLoggedIn, login, logout, uploadChangeset, getFeature as getFeatureOsm } from "osm-api";
import { createContext, onMount } from "svelte";
import {
  getStaticIdentifier,
  getTypeAndIdFromStaticIdentifier,
  type OsmIdentifier,
} from "@climbhub/common";

import { asset } from "$app/paths";
import { online } from "svelte/reactivity/window";
import type { DataTree } from "$lib/types";

// A feature change is:
// - `undefined` if the feature has been deleted
// - an OsmFeature with:
//   - a negative id if the feature has been created
//   - a positive id if the feature has been modified (id hasn't changed)
export type FeatureChanges = Record<OsmIdentifier, OsmFeature | undefined>;
export type UploadProgress = {
  phase: UploadPhase | "creating_changeset";
  step: number;
  total: number;
};

export interface RefreshedFeature {
  /** If the feature has been deleted upstream, it will be undefined */
  refreshedFeature: OsmFeature | undefined;
  refreshedTimestamp: number;
}

export class OSMUser {
  loggedIn: boolean | undefined = $state();

  changes: FeatureChanges = $state({});
  submitting: false | UploadProgress = $state(false);
  changeCount = $derived(Object.keys(this.changes).length);
  hasChanges = $derived.by(() => this.changeCount > 0);

  refreshedFeatureStates: Record<OsmIdentifier, RefreshedFeature | "pending"> = $state({});

  constructor() {
    onMount(() => {
      this.loggedIn = isLoggedIn();

      // // See note on beforeunload on mdn: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event#usage_notes
      // // > In Firefox, beforeunload is not compatible with the back/forward cache (bfcache):
      // // > that is, Firefox will not place pages in the bfcache if they have beforeunload listeners, and this is bad for performance.
      // // Should we just add a beforeunload in chrome?
      // // Actually, it looks like the right answer is another event, called visibilityChange, which should be used to save the current edits
      //     const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      //       if (this.hasChanges() || this.submitting) {
      //         event.preventDefault();
      //         event.returnValue = "";
      //       }
      //     };
      //     window.addEventListener("beforeunload", warnBeforeLeaving);
      //     return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
    });
  }

  login() {
    login({
      mode: "popup",
      clientId: "PhOrL2FCMUtJ5v3WrOAfVh5qdI5CIzQ6Wsf_YVpBNtg",
      redirectUrl: `${window.location.origin}${asset("/osm-login.html")}`,
      scopes: ["read_prefs", "write_api"],
    }).then(() => {
      this.loggedIn = isLoggedIn();
    });
  }

  logout() {
    logout();
    this.loggedIn = isLoggedIn();
  }

  setTag(feature: OsmFeature, tagKey: OsmApi.Keys["keys"], newValue: string) {
    feature.tags ??= {};
    const tags = feature.tags;
    tags[tagKey] = newValue;
    feature.tags = tags;

    // Check if the feature is in the currentChanges
    const identifier = getStaticIdentifier(feature.type, feature.id);
    if (!this.changes[identifier]) {
      // if it is not, add it to the modified features. TODO: if it is reverted, it might not be modified anymore. We should track this on a more granular level
      this.changes[identifier] = feature;
    }
  }

  deleteTag(feature: OsmFeature, tagKey: OsmApi.Keys["keys"]) {
    const tags = feature.tags;
    if (!tags) {
      console.warn("attempting to delete inexisting tag", tagKey, "in feature", feature);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(tags, tagKey)) {
      delete tags[tagKey];
    } else {
      console.warn("Cannot delete key", tagKey, "from feature", feature, "since it doesn't exist");
    }
  }

  deleteFeature(feature: OsmFeature) {
    this.changes[getStaticIdentifier(feature.type, feature.id)] = undefined;
  }

  removeChange(feature: OsmFeature) {
    const identifier = getStaticIdentifier(feature.type, feature.id);
    // TODO: this should actually revert the change, not just ignore it.
    if (identifier in this.changes) {
      delete this.changes[identifier];
    } else {
      console.warn("Cannot remove change for feature", feature, "since it doesn't exist in changes", this.changes);
    }
  }

  async submitChanges(comment: string) {
    if (this.submitting || !this.loggedIn || Object.keys(this.changes).length === 0) return;

    this.submitting = { phase: "creating_changeset", step: 0, total: 1 };
    const change: OsmChange = {
      create: [],
      modify: [],
      delete: [],
    };

    // Construct the change object from the changes map
    for (const [key, feature] of Object.entries(this.changes)) {
      if (feature === undefined) {
        const { type, id } = getTypeAndIdFromStaticIdentifier(key as OsmIdentifier);
        change.delete.push({ type, id } as OsmFeature);
      } else if (feature.id < 0) {
        change.create.push(feature);
      } else {
        change.modify.push(feature);
      }
    }

    try {
      const result = await uploadChangeset(
        { comment: comment || "Edit from Climbhub", created_by: "Climbhub" },
        change,
        {
          onProgress: (progress) => {
            this.submitting = progress;
          },
        },
      );

      for (const changesetId in result) {
        const changesetDiff: UploadResult[0] = result[changesetId]!;
        for (const [featureType, featureDiff] of Object.entries(changesetDiff.diffResult)) {
          for (const oldId in featureDiff) {
            const { newId, newVersion } = featureDiff[oldId]!;
            if (Number.isInteger(oldId)) {
              const feature =
                this.changes[
                  getStaticIdentifier(featureType as OsmFeatureType, oldId as unknown as number)
                ];
              if (!feature) {
                console.warn(
                  "Could not find change associated with id",
                  oldId,
                  "in changes",
                  this.changes,
                );
                continue;
              }
              feature.id = newId;
              feature.version = newVersion;
            }
          }
        }
      }
      this.changes = {};
    } finally {
      this.submitting = false;
    }
  }

  refreshItem(item: DataTree<OsmFeature>) {
    // do not refresh if the user is offline, since we cannot fetch the feature from OSM
    if (!online.current) return;

    const feature = item.feature;
    const identifier = getStaticIdentifier(feature.type, feature.id);

    if (this.refreshedFeatureStates[identifier]) {
      const refreshedState = this.refreshedFeatureStates[identifier];
      if (refreshedState === "pending") return;

      const timeSinceLastRefresh = Date.now() - refreshedState.refreshedTimestamp;
      // If the feature has been refreshed in the last 5 minutes, we don't need to refresh it again
      if (timeSinceLastRefresh < 5 * 60 * 1000) return;
    }

    this.refreshedFeatureStates[identifier] = "pending";

    getFeatureOsm(item.feature.type, item.feature.id)
      .then(([refreshedFeature]) => {
        this.refreshedFeatureStates[identifier] = {
          refreshedFeature,
          refreshedTimestamp: Date.now(),
        };

        // If the feature has been modified locally, we don't want to overwrite it with the refreshed version from OSM.
        // TODO: check the fields that have changed upstream, and update them in the local feature if they haven't been modified locally. This is a more complex operation, but it would allow us to keep local changes while still getting updates from OSM.
        if (this.changes[identifier]) {
          return;
        }

        item.feature = refreshedFeature;
      })
      .catch((error) => {
        console.error("Error refreshing feature from OSM:", error);
        this.refreshedFeatureStates[identifier] = {
          refreshedFeature: undefined,
          refreshedTimestamp: Date.now(),
        };
      });
  }
}

export const [getOsmUser, setOsmUser] = createContext<OSMUser>();
