<script lang="ts">
  import type { OsmFeature } from "osm-api";
  import * as Alert from "#components/ui/alert/index.js";
  import { getStaticIdentifier } from "@climbhub/common";

  let { feature }: { feature: OsmFeature } = $props();
</script>

<Alert.Root variant="destructive" class="max-w-2xl">
  <Alert.Title>This feature has been removed</Alert.Title>
  <Alert.Description>
    OSM could not find {getStaticIdentifier(feature.type, feature.id)}. It may have been deleted or is not present on
    this server, so it cannot be edited from Climbhub.
  </Alert.Description>
</Alert.Root>
