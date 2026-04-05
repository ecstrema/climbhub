declare module '*.md' {
  export const frontmatter: Record<string, unknown>;
  export const html: string;
}
