/**
 * One home for the invoice defaults (QA audit L9).
 *
 * GST 18% and payment terms 10 days used to be magic numbers
 * repeated in the invoice client, the settings form and the FBR
 * settings action — change one and the others silently disagreed.
 * Every default below must come from here (the stored org values
 * win whenever they are set; these are only the fallbacks).
 *
 * NOTE: these are display/checkout fallbacks, not the tax rule.
 * The org's stored gst_rate is what checkout charges and what the
 * invoice shows; the rate itself is a client decision (18% GST,
 * 10-day terms, prefix GT-226) recorded in the handover.
 */

/** Default GST rate in percent (Pakistan standard sales tax). */
export const DEFAULT_GST_RATE = 18

/** Default payment terms in days (invoice date + this = due date). */
export const DEFAULT_PAYMENT_TERMS_DAYS = 10

/** Default invoice serial prefix. */
export const DEFAULT_INVOICE_PREFIX = 'GT-226'
