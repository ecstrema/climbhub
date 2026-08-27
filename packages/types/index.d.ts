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
        | "name"
        | "description";
    }
  }
}

export {};
