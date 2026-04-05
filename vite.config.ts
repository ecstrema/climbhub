import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkFrontmatter from 'remark-frontmatter';
import { matter } from 'vfile-matter'
import { defineConfig, type Plugin } from 'vitest/config';

import { DevTools } from '@vitejs/devtools'



function getFrontmatter() {
	return function (tree, file) {
		matter(file)
	}
}

const markdownPlugin: () => Plugin = () => {
	return {
		name: 'vite-plugin-markdown-data',
		async transform(code, id) {
			if (!id.endsWith('.md')) return null;

			const parsedFile = await unified()
				.use(remarkParse)
				.use(remarkFrontmatter)
				.use(getFrontmatter)
				.use(remarkRehype)
				.use(rehypeStringify)
				.process(code);

			const matter = parsedFile.data.matter || {};
			const html = String(parsedFile);

			// 3. Export as a JS object
			return {
				code: `export const html = ${JSON.stringify(String(html))};
export const frontmatter = ${JSON.stringify(matter)};`,
				map: null
			};
		},

		configureServer(server) {
			server.watcher.addListener('change', (file) => {
				if (file.endsWith('.md')) {
					// Send a custom message to the client to reload
					server.ws.send({
						type: 'full-reload',
						path: '*'
					});
				}
			})
		},
	};
};

export default defineConfig({
	plugins: [sveltekit(), devtoolsJson(), markdownPlugin(), DevTools()],
	test: { include: ['src/**/*.{test,spec}.{js,ts}'] },
	devtools: {
		enabled: true,
	}
});
