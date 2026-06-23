import { StaticApiGenerator } from "./static-api-generator";

const generator = new StaticApiGenerator();
generator.run().catch(console.error);
