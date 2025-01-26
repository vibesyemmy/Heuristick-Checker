/**
 * Extracts text content from a source element
 * @param source - The source element to extract text from
 * @returns The extracted text content
 */
export function getTextInsideSource(source: any): string {
    if (!source) return '';
    
    // If source is a string, return it directly
    if (typeof source === 'string') return source;
    
    // If source is a text node
    if (source.characters !== undefined) {
        return source.characters;
    }
    
    // If source has children (like a frame or group)
    if (source.children) {
        return source.children
            .map((child: any) => getTextInsideSource(child))
            .join(' ')
            .trim();
    }
    
    return '';
}
