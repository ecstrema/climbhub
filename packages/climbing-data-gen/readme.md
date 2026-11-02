# Climbing data

Generate a static API for the climbing data of the whole world from Overpass queries, organized
with the worldwide boundaries from `@climbhub/reverse-geocoding-data`.

## Usage

```bash
bun install
bun run build
```

## Download

The build downloads one worldwide Overpass result containing every `sport=climbing` element with
its center. The response is cached in `src/climbing.json`, so normal builds reuse it. Failed
requests are retried up to 10 times with a constant 60-second delay. Run `bun run update` to refresh
the cache and regenerate the API on demand.

## Structure

It generates a file structure in the `build/` directory, under the regions of
`@climbhub/reverse-geocoding-data`. Each directory includes a data.json which is simply the element
data as received from Overpass. The climbing places outside of every region are skipped. The root
also includes `node-hashes.json`, mapping each unique OSM node identifier to a SHA-256 hash of its
Overpass record for change detection. Each build regenerates the reverse-geocoding hierarchy index
from the current worldwide boundaries first.
