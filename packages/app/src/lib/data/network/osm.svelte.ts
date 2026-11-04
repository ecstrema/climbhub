import type { Key, OsmFeature, OsmChange, UploadPhase, UploadResult, OsmFeatureType } from "osm-api";

import { isLoggedIn, login, logout, uploadChangeset, getFeature as getFeatureOsm } from "osm-api";

import { getStaticIdentifier, type OsmIdentifier } from "@climbhub/common";
import { asset } from "$app/paths";
import { online } from "svelte/reactivity/window";
import type { DataTree } from "#lib/types.js";
import { browser } from "$app/env";
import { SvelteMap } from "svelte/reactivity";
import type { TypedMap } from "#lib/helpers/types.js";

/**
 * Maps slugs to a feature diff
 *
 * A feature change is:
 * - `undefined` if the feature has been deleted
 * - an OsmFeature with:
 *   - a negative id if the feature has been created
 *   - a positive id if the feature has been modified (id hasn't changed)
 */
export type FeatureChanges = SvelteMap<string, Diff<OsmFeature | undefined>>;

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

export type Diff<T> = { initial: T; final: T };
export type FeatureDiff =
  | "deleted"
  | "created"
  | TypedMap<{
      tags?: Partial<Record<Key, Diff<string | undefined>>>;
      lat?: Diff<number | undefined>;
      lon?: Diff<number | undefined>;
      type?: Diff<OsmFeatureType>;
    }>;

/**
 * Handle the interactions with OSM.
 *
 * Provides a reactive {@linkcode loggedIn} property indicating whether we are logged in with OSM.
 *
 * Whenever a feature is added, modified or deleted, set is as modified with {@linkcode setDirty}. This provides a reactive version of the modified features, that from these features, computes what has changed in the feature so it can be shown to the user. The list of changed features is then used in {@linkcode submitChanges} to send the changes back to OSM.
 */
export class OsmUser {
  /** Whether the user is currently logged in with OSM */
  loggedIn: boolean | undefined = $state();

  /** The changes currently applied by the user. Modify via {@link markAsDirty} */
  changes: FeatureChanges = new SvelteMap();

  // TODO: we might want to stage some changes so the user can choose which changes to submit at a time.
  // #stagedChanges: Set<OsmIdentifier> = new SvelteSet();

  submitting: false | UploadProgress = $state(false);

  /** When items are refreshed, this saves the new value, or indicates that it is pending. */
  refreshedFeatureStates: Record<OsmIdentifier, RefreshedFeature | "pending"> = $state({});

  constructor() {
    // In theory, we would need to clean up the effect when the component is destroyed, but since this is a singleton it will live for the lifetime of the app, so we don't need to clean it up. If we ever make this a non-singleton, we should add a cleanup function here.
    // const cleanup = $effect,root(() => {
    $effect.root(() => {
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

  /**
   * Mark a specific feature as having been modified. This calculates whether the feature has been modified, in total since the last push to osm.
   *
   * The `featureBeforeChange` param should be provided with {@linkcode snapshot}, so we get a deep clone.
   *
   * @param featureAfterChange is only used locally, so it doesn't need to be snapshotted (deep cloned)
   */
  markAsDirty(
    featureBeforeChange: OsmFeature | undefined,
    beforeSlug: string,
    featureAfterChange: OsmFeature | undefined,
    afterSlug = beforeSlug,
  ) {
    if (featureBeforeChange === undefined && featureAfterChange === undefined) {
      console.warn("Attempting to create new feature, but new feature is undefined");
      return;
    }

    // The feature slug has changed, so it needs two entries in the changes map.
    // One indicating the deletion of the first entry, and one indicating the creation of the second entry.
    if (beforeSlug !== afterSlug) {
      this.markAsDirty(featureBeforeChange, beforeSlug, undefined);
      this.markAsDirty(undefined, afterSlug, featureAfterChange);
      return;
    }

    // We can then only process beforeSlug, since afterSlug is the same as beforeSlug
    const slug = beforeSlug;
    if (this.changes.has(slug)) {
      const original = this.changes.get(slug)!.initial;
      // Compute diff with original and new, to see if there are still changes. Else, remove the dirtyFlag
      const diff = this.#diff(original, featureAfterChange);
      if (typeof diff === "object" && diff.size === 0) {
        // no changes anymore, remove from changes
        this.changes.delete(slug);
        return;
      }

      // Keep the original initial value, but update the final value to the new one
      this.changes.set(slug, {
        initial: original,
        final: featureAfterChange,
      });
      return;
    }

    this.changes.set(slug, { initial: featureBeforeChange, final: featureAfterChange });
  }

  getDetailedChanges(): Map<string, FeatureDiff> {
    const changesMap = new Map<string, FeatureDiff>();
    for (const [slug, { initial, final }] of this.changes) {
      const diff = this.#diff(initial, final);
      if (diff) changesMap.set(slug, diff);
    }
    return changesMap;
  }

  #diff(initial: OsmFeature | undefined, final: OsmFeature | undefined): FeatureDiff | undefined {
    if (!initial) {
      if (!final) {
        console.warn("diffing osmfeatures which are both undefined");
        return undefined;
      }
      return "created";
    }

    if (!final) return "deleted";

    const res: FeatureDiff = new Map();

    if (initial.type !== final.type) res.set("type", { initial: initial.type, final: final.type });
    // @ts-expect-error This is only valid for nodes, but will work for all types
    if (initial.lat !== final.lat) res.set("lat", { initial: initial.lat, final: final.lat });
    // @ts-expect-error This is only valid for nodes, but will work for all types
    if (initial.lon !== final.lon) res.set("lon", { initial: initial.lon, final: final.lon });

    const combinedTags = new Set(Object.keys(initial.tags || {}) as Key[]).union(
      new Set(Object.keys(final.tags || {}) as Key[]),
    );
    for (const key of combinedTags) {
      const initialVal = initial.tags?.[key];
      const finalVal = final.tags?.[key];
      if (finalVal !== initialVal) {
        const tags = res.getOrInsert("tags", {});
        tags![key] = { initial: initialVal, final: finalVal };
      }
    }

    return res;
  }

  login() {
    if (!browser || this.loggedIn) return;
    login({
      mode: "popup",
      clientId: "PhOrL2FCMUtJ5v3WrOAfVh5qdI5CIzQ6Wsf_YVpBNtg",
      redirectUrl: `${window.location.origin}${asset("osm-login.html")}`,
      scopes: ["read_prefs", "write_api"],
    }).then(() => {
      this.loggedIn = isLoggedIn();
    });
  }

  logout() {
    if (!browser) return;
    logout();
    this.loggedIn = isLoggedIn();
  }

  #buildOsmChangeset(): {
    changeset: OsmChange;
    mapIdToCreatedFeature: Record<string, OsmFeature>;
  } {
    const changeset: OsmChange = {
      create: [],
      modify: [],
      delete: [],
    };

    const mapIdToCreatedFeature: Record<string, OsmFeature> = {};

    for (const { initial, final } of this.changes.values()) {
      if (final === undefined) {
        if (!initial) {
          console.warn("diffing osmfeatures which are both undefined");
          continue;
        }
        changeset.delete.push(initial);
      } else if (final.id < 0) {
        changeset.create.push(final);
        mapIdToCreatedFeature[getStaticIdentifier(final.type, final.id)] = final;
      } else {
        changeset.modify.push(final);
      }
    }
    return {
      changeset,
      mapIdToCreatedFeature,
    };
  }

  async submitChanges(comment: string) {
    if (!browser || !online.current || this.submitting || !this.loggedIn || this.changes.size === 0) {
      return;
    }

    this.submitting = { phase: "creating_changeset", step: 0, total: 1 };
    const { changeset, mapIdToCreatedFeature } = this.#buildOsmChangeset();

    try {
      console.log("Submitting changeset to OSM", changeset);
      const result = await uploadChangeset(
        { comment: comment || "Edit from Climbhub", created_by: "Climbhub" },
        changeset,
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
              const identifier = getStaticIdentifier(featureType as OsmFeatureType, oldId as unknown as number);
              const feature = mapIdToCreatedFeature[identifier];
              if (!feature) {
                console.warn(
                  "Could not find uploaded feaure to update with new id and version. This should not happen.",
                  identifier,
                  featureType,
                  oldId,
                  newId,
                  newVersion,
                );
                continue;
              }
              if (!feature) {
                console.warn("Received an id for a deleted feature during upload to osm", feature);
                return;
              }
              feature.id = newId;
              feature.version = newVersion;
            }
          }
        }
      }
      this.changes.clear();
    } finally {
      this.submitting = false;
    }
  }

  /** Integrate the final feature into initial, in a shallow fashion, so the item keeps its reactive properties. */
  #shallowIntegrateChanges(initial: OsmFeature, final: OsmFeature) {
    if (initial.type !== final.type) initial.type = final.type;
    // @ts-expect-error This is only valid for nodes, but will work for all types
    if (initial.lat !== final.lat) initial.lat = final.lat;
    // @ts-expect-error This is only valid for nodes, but will work for all types
    if (initial.lon !== final.lon) initial.lon = final.lon;

    const combinedTags = new Set(Object.keys(initial.tags || {}) as Key[]).union(
      new Set(Object.keys(final.tags || {}) as Key[]),
    );
    for (const key of combinedTags) {
      const initialVal = initial.tags?.[key];
      const finalVal = final.tags?.[key];
      if (finalVal !== initialVal) {
        initial.tags ??= {};
        if (finalVal === undefined) {
          delete initial.tags[key];
        } else {
          initial.tags[key] = finalVal;
        }
      }
    }
  }

  /** Updates local final and initial to contain the upstream changes. */
  #integrateUnconflictedChanges(
    localInitial: OsmFeature | undefined,
    localFinal: OsmFeature | undefined,
    upstream: OsmFeature,
  ) {
    if (!localFinal) {
      if (!upstream || !localInitial) return;
      this.#shallowIntegrateChanges(localInitial, upstream);
      return;
    }

    // If localInitial is undefined, the feature was created locally and won't have an upstream counterpart yet.
    if (!localInitial) return;

    const localDiff = this.#diff(localInitial, localFinal);
    const upstreamDiff = this.#diff(localInitial, upstream);

    if (upstreamDiff === "deleted") {
      console.warn("Feature has been deleted upstream, but has local changes. Not applying upstream deletion.");
      return;
    }

    if (
      !upstreamDiff ||
      upstreamDiff === "created" ||
      !localDiff ||
      localDiff === "created" ||
      localDiff === "deleted"
    ) {
      return;
    }

    const integrateProperty = (property: "lat" | "lon" | "type") => {
      const upstreamValue = upstreamDiff.get(property);
      if (upstreamValue) {
        const localValue = localDiff.get(property);
        if (!localValue || localValue.final === upstreamValue.final) {
          // @ts-expect-error This is only valid for nodes, but will work for all types
          localFinal[property] = upstreamValue.final;
        } else {
          console.warn(`Feature ${property} has changed upstream and locally. Keeping local.`);
        }
      }
    };

    integrateProperty("type");
    integrateProperty("lat");
    integrateProperty("lon");

    const upstreamTags = upstreamDiff.get("tags");

    if (upstreamTags) {
      const integrateTag = (key: Key) => {
        const upstreamChange = upstreamTags[key];
        if (upstreamChange) {
          const localChange = localDiff.get("tags")?.[key];
          if (!localChange || localChange.final === upstreamChange.final) {
            localFinal.tags ??= {};
            if (upstreamChange.final === undefined) {
              delete localFinal.tags[key];
            } else {
              localFinal.tags[key] = upstreamChange.final;
            }
          } else {
            console.warn(`Tag '${key}' modified upstream and locally. Keeping local.`);
          }
        }
      };

      for (const key of Object.keys(upstreamTags || {}) as Key[]) {
        integrateTag(key);
      }
    }

    // Advance the local base state to strictly mirror the new upstream reality.
    // This ensures that getDetailedChanges() accurately diffs against the latest OSM data.
    this.#shallowIntegrateChanges(localInitial, upstream);
  }

  /** Gets the item as it currently is in OSM, and replace the current item in place, if it has no changes. This way, even if the data has changed since it was downloaded, it will be updated in place with this. */
  async refreshItem(item: DataTree<OsmFeature>) {
    // do not refresh if the user is offline, since we cannot fetch the feature from OSM
    if (!browser || !online.current) return;

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

    let refreshedFeature: OsmFeature;
    try {
      [refreshedFeature] = await getFeatureOsm(item.feature.type, item.feature.id);
    } catch (error) {
      console.error("Error refreshing feature from OSM:", error);
      this.refreshedFeatureStates[identifier] = {
        refreshedFeature: undefined,
        refreshedTimestamp: Date.now(),
      };
      return;
    }

    this.refreshedFeatureStates[identifier] = {
      refreshedFeature,
      refreshedTimestamp: Date.now(),
    };

    // If the feature has been modified locally, we don't want to overwrite it with the refreshed version from OSM.
    // Instead, we compute the diff between the refreshed version and the current version, and integrate whatever is not in conflict with the current version.
    if (this.changes.has(identifier)) {
      const { initial, final } = this.changes.get(identifier)!;

      this.#integrateUnconflictedChanges(initial, final, refreshedFeature);
      return;
    }
    item.feature = refreshedFeature;
  }
}
