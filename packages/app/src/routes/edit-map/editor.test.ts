import { describe, expect, it } from "vitest";

import { EditorStore, isPreciseCoast, walk, type EditorNode } from "./editor.svelte";
import type { Position } from "geojson";
import { countVertices, rectangleBoundary, splitBoundary } from "./geometry";
import type { DataFiles } from "./types";

const square = (x: number, y: number) => rectangleBoundary({ x0: x, x1: x + 1, y0: y, y1: y + 1 });

function find(store: EditorStore, path: string): EditorNode {
  const node = [...walk(store.root)].find((n) => {
    const segments: string[] = [];
    for (let m: EditorNode | undefined = n; m; m = m.parent) segments.unshift(m.slug);
    return segments.join("/") === path;
  });
  if (!node) throw new Error(`No ${path}`);
  return node;
}

const files: DataFiles = {
  "world/a/b.geojson": JSON.stringify(square(0, 0)),
  // Written by hand: kept as is while not modified
  "world/a/c.geojson": JSON.stringify(square(2, 0), null, 2),
};

describe("EditorStore", () => {
  it("builds the tree from the files, and has no change", () => {
    const store = new EditorStore(files, []);
    expect(find(store, "world/a").children.map((c) => c.slug)).toEqual(["b", "c"]);
    expect(store.files()).toEqual(files);
    expect(store.modifiedCount).toBe(0);
    expect(store.changes()).toEqual({ write: new Map(), delete: [] });
  });

  it("distinguishes new, modified, staged, and committed boundary states", () => {
    const store = new EditorStore(files, []);
    const [area, b, c] = [find(store, "world/a"), find(store, "world/a/b"), find(store, "world/a/c")];
    store.setGitStates({
      "world/a/b.geojson": "staged",
      "world/a/c.geojson": "committed",
    });

    expect(store.boundaryState(b)).toBe("staged");
    expect(store.boundaryState(c)).toBe("committed");

    store.setBoundary(b, square(5, 5), "Move");

    expect(store.boundaryState(b)).toBe("modified");
    expect(store.boundaryState(area)).toBe("modified");

    store.undo();

    expect(store.boundaryState(area)).toBe("staged");
  });

  it("recognizes new regions and aggregates mixed child states", () => {
    const store = new EditorStore(files, []);
    const area = find(store, "world/a");
    const fresh = store.addChild(area, "d", square(4, 0));
    store.setGitStates({ "world/a/b.geojson": "staged" });

    expect(store.boundaryState(fresh)).toBe("new");
    expect(store.boundaryState(area)).toBe("new");
  });

  it("geolocates in the leaves", () => {
    const store = new EditorStore(files, [
      { id: "n1", lon: 0.5, lat: 0.5, kind: "crag" },
      { id: "n2", lon: 2.5, lat: 0.5, kind: "crag" },
      { id: "n3", lon: 10, lat: 10, kind: "crag" },
    ]);
    expect(find(store, "world/a/b").total).toBe(1);
    expect(find(store, "world/a").total).toBe(2);
    expect(store.unassignedCount).toBe(1);
  });

  it("measures the coasts: the borders without region on the other side", async () => {
    /** A square of 1° with `n` vertices per side */
    const dense = (x: number, n: number) => {
      const ring: Position[] = [];
      for (let i = 0; i < n; i++) ring.push([x + i / n, 0]);
      for (let i = 0; i < n; i++) ring.push([x + 1, i / n]);
      for (let i = 0; i < n; i++) ring.push([x + 1 - i / n, 1]);
      for (let i = 0; i < n; i++) ring.push([x, 1 - i / n]);
      ring.push([x, 0]);
      return JSON.stringify({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    };
    const store = new EditorStore({ "world/a.geojson": dense(0, 100), "world/b.geojson": dense(1, 1) }, []);
    const [a, b] = [find(store, "world/a"), find(store, "world/b")];
    const precise = await store.findCoasts(store.root);
    // 3 sides of 111 km on the sea, the 4th is the border with b
    expect(store.coasts.get(a)!.length).toBeCloseTo(333, -1);
    expect(store.coasts.get(b)!.length).toBeCloseTo(333, -1);
    expect(precise).toEqual([a]);
    // Outdated once modified
    store.setBoundary(a, square(5, 5), "Move");
    expect(isPreciseCoast(a, store.coasts.get(a))).toBe(false);
  });

  it("simplifies coasts roughly circling into the water while keeping neighbours intact", async () => {
    const dense = (x: number, n: number) => {
      const ring: Position[] = [];
      for (let i = 0; i < n; i++) ring.push([x + i / n, 0]);
      for (let i = 0; i < n; i++) ring.push([x + 1, i / n]);
      for (let i = 0; i < n; i++) ring.push([x + 1 - i / n, 1]);
      for (let i = 0; i < n; i++) ring.push([x, 1 - i / n]);
      ring.push(ring[0]!);
      return JSON.stringify({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    };
    const store = new EditorStore({ "world/a.geojson": dense(0, 50), "world/b.geojson": dense(1, 10) }, []);
    const a = find(store, "world/a");
    const origVertices = a.vertexCount;
    const result = store.simplifiedCoasts([a], { tolerance: 0.1, offsetDegrees: 0.2 });
    expect(result).toHaveLength(1);
    const newBoundary = result[0]!.boundary;
    expect(countVertices(newBoundary)).toBeLessThan(origVertices);

    // Apply is undoable and marks dirty
    store.applyCoastSimplification(result);
    expect(a.dirty).toBe(true);
    expect(a.vertexCount).toBe(countVertices(newBoundary));
    store.undo();
    expect(a.vertexCount).toBe(origVertices);
  });

  it("renaming moves the files, and the undo moves them back", () => {
    const store = new EditorStore(files, []);
    const a = find(store, "world/a");
    store.rename(a, "z");
    const { write, delete: removed } = store.changes();
    expect([...write.keys()].sort()).toEqual(["world/z/b.geojson", "world/z/c.geojson"]);
    // The content written as is
    expect(write.get("world/z/c.geojson")).toBe(files["world/a/c.geojson"]);
    expect(removed.sort()).toEqual(["world/a/b.geojson", "world/a/c.geojson"]);
    expect(() => store.rename(find(store, "world/z/b"), "c")).toThrow("already exists");
    expect(() => store.rename(find(store, "world/z/b"), "Not a slug")).toThrow("Invalid slug");
    store.undo();
    expect(a.slug).toBe("a");
    expect(store.changes()).toEqual({ write: new Map(), delete: [] });
  });

  it("renaming changes the order of the siblings, used by the geolocation", () => {
    const store = new EditorStore(
      {
        "world/a.geojson": JSON.stringify(square(0, 0)),
        "world/b.geojson": JSON.stringify(square(0, 0)),
      },
      [{ id: "n1", lon: 0.5, lat: 0.5, kind: "crag" }],
    );
    expect(find(store, "world/a").total).toBe(1);
    store.rename(find(store, "world/a"), "c");
    expect(store.root.children.map((c) => c.slug)).toEqual(["b", "c"]);
    expect(find(store, "world/b").total).toBe(1);
  });

  it("subdividing a leaf removes its file", () => {
    const store = new EditorStore(files, []);
    const b = find(store, "world/a/b");
    store.applySubdivisions(
      b,
      new Map([
        ["x", square(0, 0)],
        ["y", square(0.5, 0)],
      ]),
    );
    const { write, delete: removed } = store.changes();
    expect([...write.keys()].sort()).toEqual(["world/a/b/x.geojson", "world/a/b/y.geojson"]);
    expect(removed).toEqual(["world/a/b.geojson"]);
    expect(store.isModified(b)).toBe(true);
    expect(store.modifiedCount).toBe(3);
  });

  it("is unchanged after saving, and undo restores the saved state", () => {
    const store = new EditorStore(files, []);
    const c = find(store, "world/a/c");
    store.setBoundary(c, square(5, 5), "Move");
    expect(store.modifiedCount).toBe(1);

    store.markSaved(store.files());
    expect(store.modifiedCount).toBe(0);

    store.undo();
    expect(store.isModified(c)).toBe(true);
    expect(store.changes().write.get("world/a/c.geojson")).toBe(files["world/a/c.geojson"]);
  });

  it("removing a region deletes its files", () => {
    const store = new EditorStore(files, []);
    store.removeNode(find(store, "world/a"));
    expect(store.changes().delete.sort()).toEqual(Object.keys(files).sort());
  });

  it("removes the linked vertices in the neighbours, and the degenerate polygons", () => {
    const store = new EditorStore(files, []);
    const b = find(store, "world/a/b");
    const neighbour = new EditorStore(
      {
        "world/a/b.geojson": JSON.stringify(square(0, 0)),
        "world/a/c.geojson": JSON.stringify(square(1, 0)),
      },
      [],
    );
    const [nb, nc] = [find(neighbour, "world/a/b"), find(neighbour, "world/a/c")];
    // (1, 0) is shared by b and c
    neighbour.removeVertices(nb, [[1, 0]]);
    expect(nb.vertexCount).toBe(3);
    expect(nc.vertexCount).toBe(3);

    store.removeVertices(b, [
      [0, 0],
      [1, 0],
    ]);
    expect(b.boundary).toBeUndefined();
    expect(store.changes().delete).toEqual(["world/a/b.geojson"]);
    store.undo();
    expect(b.vertexCount).toBe(4);
  });

  it("splits a leaf into a new sibling", () => {
    const store = new EditorStore(
      { "world/a/r.geojson": JSON.stringify(rectangleBoundary({ x0: 0, x1: 4, y0: 0, y1: 2 })) },
      [
        { id: "n1", lon: 1, lat: 1, kind: "crag" },
        { id: "n2", lon: 3, lat: 1, kind: "crag" },
      ],
    );
    const r = find(store, "world/a/r");
    store.addPolygon(r, [
      [0, 1],
      [2, 1],
      [2, 3],
      [0, 1],
    ]);
    expect(r.vertexCount).toBe(7);
    store.undo();
    expect(r.vertexCount).toBe(4);

    // With vertices in the middle of the long sides, to cut along x = 2
    const wide: Position[] = [
      [0, 0],
      [2, 0],
      [4, 0],
      [4, 2],
      [2, 2],
      [0, 2],
      [0, 0],
    ];
    store.setBoundary(
      r,
      {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [wide] } }],
      },
      "test",
    );
    const [option] = splitBoundary(r.boundary!, [2, 0], [2, 2]);
    const sibling = store.split(r, option.kept, option.part, "s");
    expect(find(store, "world/a").children.map((c) => c.slug)).toEqual(["r", "s"]);
    expect(r.total).toBe(1);
    expect(sibling.total).toBe(1);
    expect(() => store.split(r, option.kept, option.part, "s")).toThrow("already exists");
  });

  it("merges leaves into one, undoably", () => {
    const store = new EditorStore(
      {
        "world/a/b.geojson": JSON.stringify(square(0, 0)),
        "world/a/c.geojson": JSON.stringify(square(1, 0)),
        "world/d/e.geojson": JSON.stringify(square(5, 5)),
        "world/z.geojson": JSON.stringify(square(9, 9)),
      },
      [
        { id: "n1", lon: 0.5, lat: 0.5, kind: "crag" },
        { id: "n2", lon: 1.5, lat: 0.5, kind: "crag" },
        { id: "n3", lon: 5.5, lat: 5.5, kind: "crag" },
      ],
    );
    const [b, c, e] = [find(store, "world/a/b"), find(store, "world/a/c"), find(store, "world/d/e")];
    const before = store.files();
    store.selected = c;
    store.merge(b, [c, e]);

    // The shared border of b and c is dissolved, e is kept apart
    expect(b.boundary!.features).toHaveLength(1);
    expect(b.boundary!.features[0]!.geometry.type).toBe("MultiPolygon");
    expect(b.vertexCount).toBe(6 + 4);
    expect(b.total).toBe(3);
    expect(find(store, "world/a").children.map((n) => n.slug)).toEqual(["b"]);
    expect(find(store, "world/d").children).toEqual([]);
    expect(store.selected).toBe(find(store, "world/a"));
    expect(store.changes().delete.sort()).toEqual(["world/a/c.geojson", "world/d/e.geojson"]);

    // Removing another region keeps the merge undoable
    store.removeNode(find(store, "world/z"));
    expect(store.undoStack.at(-1)?.label).toBe("Merge 3 regions");
    store.undo();
    expect(store.undoStack.length).toBe(0);
    expect(find(store, "world/a").children.map((n) => n.slug)).toEqual(["b", "c"]);
    expect(find(store, "world/d").children.map((n) => n.slug)).toEqual(["e"]);
    const { "world/z.geojson": _, ...rest } = before;
    expect(store.files()).toEqual(rest);
    expect(store.modifiedCount).toBe(1);
    expect(store.nodesById.has(c.id)).toBe(true);
    expect(c.total).toBe(1);

    expect(() => store.merge(find(store, "world/a"), [b])).toThrow("Only leaves");

    // Not undoable once the slug is used again
    store.merge(b, [c]);
    store.addChild(find(store, "world/a"), "c");
    store.undo(); // Add child: the new node stays
    expect(() => store.undo()).toThrow("exists again");
    expect(store.undoStack.at(-1)?.label).toBe("Merge 2 regions");
    store.removeNode(find(store, "world/a/c"));
    store.undo();
    expect(find(store, "world/a").children.map((n) => n.slug)).toEqual(["b", "c"]);

    // Removing the parent of a merged region cannot be undone: the merge cannot be either
    store.merge(b, [e]);
    store.removeNode(find(store, "world/d"));
    expect(store.undoStack).toEqual([]);
  });

  it("merges leaves into a new region under a parent, undoably", () => {
    const store = new EditorStore(
      {
        "world/a/b.geojson": JSON.stringify(square(0, 0)),
        "world/a/c.geojson": JSON.stringify(square(1, 0)),
      },
      [
        { id: "n1", lon: 0.5, lat: 0.5, kind: "crag" },
        { id: "n2", lon: 1.5, lat: 0.5, kind: "crag" },
      ],
    );
    const a = find(store, "world/a");
    const [b, c] = [find(store, "world/a/b"), find(store, "world/a/c")];

    const merged = store.mergeIntoNew(a, "combined", [b, c], "Combined Region");
    expect(merged.slug).toBe("combined");
    expect(a.children.map((n) => n.slug)).toEqual(["combined"]);
    expect(merged.total).toBe(2);
    expect(store.selected).toBe(merged);
    expect(store.changes().delete.sort()).toEqual(["world/a/b.geojson", "world/a/c.geojson"]);
    expect(store.changes().write.has("world/a/combined.geojson")).toBe(true);

    // Undo restores b and c and removes combined
    store.undo();
    expect(a.children.map((n) => n.slug)).toEqual(["b", "c"]);
    expect(find(store, "world/a/b").total).toBe(1);
    expect(find(store, "world/a/c").total).toBe(1);
    expect(store.nodesById.has(merged.id)).toBe(false);

    expect(() => store.mergeIntoNew(a, "x", [b])).toThrow("At least two");
    expect(() => store.mergeIntoNew(a, "b", [b, c])).toThrow("already exists");
  });

  it("merges two shapes at two points, undoably", () => {
    const store = new EditorStore(
      {
        "world/a/b.geojson": JSON.stringify(square(0, 0)),
        "world/a/c.geojson": JSON.stringify(square(1, 0)),
      },
      [],
    );
    const [b, c] = [find(store, "world/a/b"), find(store, "world/a/c")];
    const merged = store.mergeAtPoints(b, c, [1, 0], [1, 1], 0, "A");
    expect(merged).toBe(b);
    expect(b.boundary!.features[0]!.geometry.type).toBe("Polygon");
    expect(countVertices(b.boundary!)).toBe(6); // 2 squares merged into 1 2x1 rectangle
    expect(find(store, "world/a").children.map((n) => n.slug)).toEqual(["b"]);

    // Undo restores c
    store.undo();
    expect(find(store, "world/a").children.map((n) => n.slug)).toEqual(["b", "c"]);
  });

  it("filters tree efficiently with matching and open nodes", () => {
    const store = new EditorStore(files, []);
    expect(store.filterTree("")).toBeUndefined();
    const res = store.filterTree("b");
    expect(res).toBeDefined();
    const b = find(store, "world/a/b");
    const a = find(store, "world/a");
    expect(res!.visible.has(b.id)).toBe(true);
    expect(res!.visible.has(a.id)).toBe(true);
    expect(res!.open.has(a.id)).toBe(true);
    expect(res!.open.has(b.id)).toBe(false);
  });

  it("tracks selected ancestor ids", () => {
    const store = new EditorStore(files, []);
    const b = find(store, "world/a/b");
    const a = find(store, "world/a");
    store.selected = b;
    expect(store.selectedAncestorIds.has(a.id)).toBe(true);
    expect(store.selectedAncestorIds.has(store.root.id)).toBe(true);
    expect(store.selectedAncestorIds.has(b.id)).toBe(false);
  });
});
