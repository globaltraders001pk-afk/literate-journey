/**
 * PKR money formatting for every user-facing price in the app.
 *
 * Global Traders is a Pakistani (PKR) business — the FBR invoice is
 * already PKR — so all display prices use "Rs" with thousands commas
 * and 2 decimals, e.g. `Rs 138,980.00`. This only formats for display;
 * stored values are untouched.
 */
export function formatPKR(value: number | string | null | undefined): string {
  const n = Number(value) || 0
  return `Rs ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
