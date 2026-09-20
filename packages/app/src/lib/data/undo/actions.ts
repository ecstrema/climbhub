import type { DataTree } from "$lib/types";
import type { Tags, OsmFeature, OsmNode, OsmRelation } from "osm-api";
import type { Undoable } from "./types";
import type { OsmUser } from "../network/osm.svelte";
import { snapshot } from "$lib/helpers/svelte.svelte";

/** An undoable action can be done and undone. */
export class OsmUndoable {
  osmUser: OsmUser;
  constructor(osmUser: OsmUser) {
    this.osmUser = osmUser;
  }
}

/**
 * An undoable for editing a single osm tag from an element.
 * Set the value to undefined to delete the tag.
 */
export class UndoableTagChange extends OsmUndoable implements Undoable {
  previousValue: string | undefined;
  newValue: string | undefined;
  tagKey: OsmApi.Keys["keys"];
  targetFeature: OsmFeature;
  targetFeatureSlug: string;

  constructor(
    osmUser: OsmUser,
    targetFeature: OsmFeature,
    targetFeatureSlug: string,
    tagKey: OsmApi.Keys["keys"],
    newValue: string | undefined,
  ) {
    super(osmUser);
    this.targetFeature = targetFeature;
    this.targetFeatureSlug = targetFeatureSlug;
    this.tagKey = tagKey;
    this.newValue = newValue;
    this.previousValue = targetFeature.tags?.[tagKey];
  }

  do() {
    if (this.previousValue === this.newValue) {
      console.log("Do not create undoable for tag change that does not change the value");
      return;
    }

    const featureBefore = snapshot(this.targetFeature);

    if (this.newValue === undefined) {
      delete this.targetFeature.tags?.[this.tagKey];
    } else {
      this.targetFeature.tags ??= {};
      this.targetFeature.tags[this.tagKey] = this.newValue;
    }

    this.osmUser.markAsDirty(featureBefore, this.targetFeatureSlug, this.targetFeature);
  }

  undo() {
    const featureBefore = snapshot(this.targetFeature);

    if (this.previousValue === undefined) {
      delete this.targetFeature.tags?.[this.tagKey];
    } else {
      this.targetFeature.tags ??= {};
      this.targetFeature.tags[this.tagKey] = this.previousValue;
    }

    this.osmUser.markAsDirty(featureBefore, this.targetFeatureSlug, this.targetFeature);
  }
}

/** Add a node to the parent DataTree. Extended by {@link UndoableRouteCreate} and {@link UndoableAreaCreate} */
export class UndoableNodeCreate extends OsmUndoable implements Undoable {
  parent: DataTree;
  slug: string;
  item: DataTree<OsmFeature>;

  constructor(osmUser: OsmUser, feature: OsmFeature, parent: DataTree, parentSlug: string) {
    super(osmUser);
    this.item = {
      feature: feature,
      children: {},
      childrenFetched: true,
    };
    this.parent = parent;
    this.slug = `${parentSlug}/${crypto.randomUUID()}`;
  }

  do() {
    this.parent.children ??= {};
    this.parent.children[this.slug] = this.item;

    this.osmUser.markAsDirty(undefined, this.slug, this.item.feature);
  }

  undo() {
    if (this.parent.children) {
      delete this.parent.children[this.slug];
      this.osmUser.markAsDirty(this.item.feature, this.slug, undefined);
    }
  }
}

/** Add a new route to the parent DataTree */
export class UndoableRouteCreate extends UndoableNodeCreate {
  constructor(osmUser: OsmUser, parent: DataTree, parentSlug: string) {
    const newRoute: OsmNode = {
      type: "node",
      id: -Date.now(),
      version: 0,
      tags: {
        sport: "climbing",
        climbing: "route_bottom",
      },
      changeset: 0,
      lat: 0,
      lon: 0,
      timestamp: "-1",
      uid: -1,
      user: "",
    };
    super(osmUser, newRoute, parent, parentSlug);
  }
}

/** Add a new area to the parent DataTree */
export class UndoableAreaCreate extends UndoableNodeCreate {
  constructor(osmUser: OsmUser, parent: DataTree, parentSlug: string) {
    const newArea: OsmRelation = {
      type: "relation",
      id: -Date.now(),
      version: 0,
      tags: {
        sport: "climbing",
        climbing: "area",
      },
      changeset: 0,
      members: [],
      timestamp: "-1",
      uid: -1,
      user: "",
    };
    super(osmUser, newArea, parent, parentSlug);
  }
}

/** Completely replace a feature with another */
export class UndoableFeatureSet extends OsmUndoable implements Undoable {
  item: DataTree<OsmFeature>;
  featureSlug: string;
  newFeature: OsmFeature;
  featureBefore: OsmFeature | undefined;

  constructor(
    osmUser: OsmUser,
    item: DataTree<OsmFeature>,
    featureSlug: string,
    newFeature: OsmFeature,
  ) {
    super(osmUser);
    this.item = item;
    this.featureSlug = featureSlug;
    this.newFeature = newFeature;
  }

  do() {
    this.featureBefore = this.item.feature;
    this.osmUser.markAsDirty(this.featureBefore, this.featureSlug, this.newFeature);
    this.item.feature = this.newFeature;
  }

  undo() {
    if (this.featureBefore) {
      this.osmUser.markAsDirty(this.newFeature, this.featureSlug, this.featureBefore);
      this.item.feature = this.featureBefore;
      this.featureBefore = undefined;
    }
  }
}

export class UndoableFeatureReset extends OsmUndoable implements Undoable {
  item: DataTree<OsmFeature>;
  featureSlug: string;
  constructor(osmUser: OsmUser, item: DataTree<OsmFeature>, featureSlug: string) {
    super(osmUser);
    this.featureSlug = featureSlug;
    this.item = item;
  }

  do() {
    // Get the feature as it was before any changes were made to it. We get this from the changes in osmUser
    // If the feature was never changed, then we don't do anything.
    const featureBefore = this.osmUser.changes.get(this.featureSlug);
    if (!featureBefore) {
      console.log(`Feature ${this.featureSlug} was never changed, cannot reset`);
      return;
    }

    console.warn("resetting feature undoable not implemented")
  }

  undo() {
    console.warn("undoing feature reset not implemented")
  }
}
