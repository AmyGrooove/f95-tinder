interface IMailDeliveryResult {
  id: string
  status: "queued" | "sent"
}

export type { IMailDeliveryResult }
