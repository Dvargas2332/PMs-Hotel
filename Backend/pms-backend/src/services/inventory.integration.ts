export async function onEInvoicingXmlImported(_input: {
  hotelId: string;
  docType: "FE" | "TE";
  key?: string;
  consecutive?: string;
  totals?: Record<string, any>;
  lines?: Array<Record<string, any>>;
}): Promise<void> {
  return;
}

