export function removeBrackets(str) {
    return str.replace(/^\[(.*)\]$/, '$1');
}