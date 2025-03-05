import striptags from 'striptags'

/**
 * Check if a value is empty. This function will return true if the value is:
 * - undefined
 * - null
 * - an empty string
 * - an empty object
 * - an empty array
 * - a set with no values
 * - a map with no values
 * - a number with a value of 0
 * - a string with a length of 0 after trimming, and stripping html tags
 *
 * @param value any value to check if it is empty
 * @returns boolean
 */
export function isEmpty(value?: any) {
    // Check for falsy values
    if (!value) {
        return true
    }

    // Check for Date objects
    if (value instanceof Date) {
        return false
    }

    // Check for empty objects
    if (typeof value === 'object' && Object.keys(value).length === 0) {
        return true
    }

    // Check for empty arrays
    if (Array.isArray(value) && value.length === 0) {
        return true
    }

    // Check for empty strings
    if (typeof value === 'string' && value.trim() === '') {
        return true
    }

    // Check for html strings that contain no text
    if (typeof value === 'string' && striptags(value?.trim()).length === 0) {
        return true
    }

    // Check for empty sets
    if (value instanceof Set && value.size === 0) {
        return true
    }

    // Check for empty maps
    if (value instanceof Map && value.size === 0) {
        return true
    }

    // Check for zero values
    if (typeof value === 'number' && value === 0) {
        return true
    }

    return !value
}
