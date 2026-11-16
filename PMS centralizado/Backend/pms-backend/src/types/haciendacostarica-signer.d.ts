declare module "haciendacostarica-signer" {
  export interface VerifyResult {
    isValid: boolean;
    expiresOn?: string | Date;
  }

  export interface CrSigner {
    /** Firma el XML con XAdES-EPES y devuelve el XML firmado en base64. */
    sign(xml: string, p12Base64: string, passphrase: string): Promise<string>;
    verifySignature(p12Base64: string, passphrase: string): Promise<VerifyResult>;
  }

  const signer: CrSigner;
  export default signer;
}
