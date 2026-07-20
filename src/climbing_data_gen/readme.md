# Climbing data

Generate a static API for the climbing data from an overpass query.

## Usage

```bash
bun install
bun run build
```

## Structure

It generates a file structure in the root `static/api` directory. Each directory includes the following files:

- data.json: the data for this element and this element only.
- shallow.zip: the data.json files immediately below this directory. One directory deep.
- deep.zip: the data.json files further than 1 directory below this one.

Downloading the 3 of them gives the complete folder.

The goal of these 3 files is that a service worker can be installed to replace the fetch requests with a single zip file download. It can then respond to queries to data.json with the files it predownloaded.
