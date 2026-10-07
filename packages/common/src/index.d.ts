declare global {
  namespace OsmApi {
    interface Keys {
      keys:
        | "sport"
        | "climbing"
        | "climbing:grade"
        | "climbing:grade:uiaa"
        | "climbing:grade:yds"
        | "climbing:grade:french"
        | "climbing:grade:fb"
        | "climbing:grade:yds_class"
        | "climbing:grade:french_british"
        | "climbing:grade:font"
        | "climbing:grade:fontainebleau"
        | "climbing:grade:hueco"
        | "climbing:grade:vscale"
        | "climbing:length"
        | "amenity"
        | "leisure"
        | "natural" // = "cliff"
        | "name"
        | "name:en"
        | "name:fr"
        | "type"
        | "official_name"
        | "description"
        // for changesets
        | "created_by"
        | "comment";
    }
  }

  // See ./polyfills.ts for the implementation of these methods
  interface Map<K, V> {
    getOrInsert(key: K, value: V): V;
    getOrInsertComputed(key: K, callback: (key: K) => V): V;
  }
}

export {};
