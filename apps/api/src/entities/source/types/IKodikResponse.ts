interface IKodikMaterial extends Record<string, unknown> {
  id: string
  type: string

  material_data?: Record<string, unknown> | null
}

interface IKodikPage extends Record<string, unknown> {
  total: number
  results: IKodikMaterial[]

  time?: string
  next_page?: string | null
  prev_page?: string | null
}

export type { IKodikMaterial, IKodikPage }
