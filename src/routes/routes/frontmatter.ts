import { matter } from 'vfile-matter'

export function getFrontmatter() {
  return function (tree, file) {
    matter(file)
  }
}
