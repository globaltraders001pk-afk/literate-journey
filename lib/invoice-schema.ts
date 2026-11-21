// Marker returned by getInvoiceByNumber (app/actions/sales.ts) when the
// invoice query fails because the FBR v2 columns do not exist in the
// database yet — i.e. the v2 delta SQL has not been run on the live DB.
//
// This lives in a plain module (not a 'use server' file) because a
// server-action file may only export async functions — exporting a
// string constant from app/actions/sales.ts breaks the build.
export const INVOICE_SCHEMA_MISSING = 'schema-missing' as const
