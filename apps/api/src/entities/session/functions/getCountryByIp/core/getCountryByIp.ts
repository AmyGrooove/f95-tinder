import { isIP } from "node:net"

import geoip from "geoip-lite"

import { ECountry } from "@entities/shared/schemas/ECountry"
import { isString } from "@shared/functions/checks/isString"

const getCountryByIp = (ip: unknown): ECountry => {
  if (!isString(ip) || isIP(ip) === 0) {
    return ECountry.UNKNOWN
  }

  const country = geoip.lookup(ip)?.country.toLowerCase()

  return (
    Object.values(ECountry).find((value) => value === country) ??
    ECountry.UNKNOWN
  )
}

export { getCountryByIp }
