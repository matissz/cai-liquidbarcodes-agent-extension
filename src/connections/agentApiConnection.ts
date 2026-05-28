import { IConnectionSchema } from "@cognigy/extension-tools";

export const agentApiConnection: IConnectionSchema = {
  type: "liquid-barcodes-agent-api",
  label: "Liquid Barcodes Agent API",
  fields: [
    { fieldName: "baseUrl" },
    { fieldName: "apiKey" },
    { fieldName: "signatureSalt" },
    { fieldName: "appBaseUrl" },
    { fieldName: "appSecretKey" },
  ],
};
