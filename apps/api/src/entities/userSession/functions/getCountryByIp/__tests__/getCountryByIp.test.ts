import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import geoip from "geoip-lite"

import { ECountry } from "@entities/shared/schemas/ECountry"

import { getCountryByIp } from "../core/getCountryByIp"

describe("getCountryByIp", () => {
  beforeEach(() => {
    jest.spyOn(geoip, "lookup").mockReturnValue(null)
  })

  it("возвращает unknown для страны вне общего enum", () => {
    jest.spyOn(geoip, "lookup").mockReturnValue({
      country: "ZA",
      range: [0, 0],
      region: "",
      eu: "0",
      timezone: "",
      city: "",
      ll: [0, 0],
      metro: 0,
      area: 0,
    })

    expect(getCountryByIp("196.25.1.1")).toBe(ECountry.UNKNOWN)
  })

  it.each([
    ["77.88.8.8", "RU", ECountry.RUSSIA],
    ["8.8.8.8", "US", ECountry.UNITED_STATES],
    ["2001:4860:4860::8888", "US", ECountry.UNITED_STATES],
    ["::ffff:8.8.8.8", "us", ECountry.UNITED_STATES],
  ])("определяет страну IPv4 и IPv6: %s", (ip, code, country) => {
    jest.spyOn(geoip, "lookup").mockReturnValue({
      country: code,
      range: [0, 0],
      region: "",
      eu: "0",
      timezone: "",
      city: "",
      ll: [0, 0],
      metro: 0,
      area: 0,
    })

    expect(getCountryByIp(ip)).toBe(country)
    expect(geoip.lookup).toHaveBeenCalledWith(ip)
  })

  it.each([undefined, null, 123, {}, "", "invalid", "8.8.8.8, 77.88.8.8"])(
    "не обращается к GeoIP для невалидного IP: %p",
    (ip) => {
      expect(getCountryByIp(ip)).toBe(ECountry.UNKNOWN)
      expect(geoip.lookup).not.toHaveBeenCalled()
    },
  )

  it.each(["8.8.8.8", "2001:4860:4860::8888"])(
    "возвращает unknown при отсутствии IP в базе: %p",
    (ip) => {
      expect(getCountryByIp(ip)).toBe(ECountry.UNKNOWN)
      expect(geoip.lookup).toHaveBeenCalledWith(ip)
    },
  )
})
