/** Tags always read with a leading `#`, whether or not the stored tag already has one. */
function formatTagLabel(tag: string): string {
  return tag.startsWith("#") ? tag : `#${tag}`;
}

export { formatTagLabel };
