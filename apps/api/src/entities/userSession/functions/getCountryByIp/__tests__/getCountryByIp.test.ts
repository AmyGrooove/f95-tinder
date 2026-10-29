import { describe, expect, it, jest } from "@jest/globals"
import geoip from "geoip-lite"

import { ECountry } from "@entities/shared/schemas/ECountry"

import { getCountryByIp } from "../core/getCountryByIp"

describe("getCountryByIp", () => {
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
    ["77.88.8.8", ECountry.RUSSIA],
    ["8.8.8.8", ECountry.UNITED_STATES],
    ["2001:4860:4860::8888", ECountry.UNITED_STATES],
    ["::ffff:8.8.8.8", ECountry.UNITED_STATES],
  ])("определяет страну IPv4 и IPv6: %s", (ip, country) => {
    expect(getCountryByIp(ip)).toBe(country)
  })

  it.each([
    undefined,
    null,
    123,
    {},
    "",
    "invalid",
    "8.8.8.8, 77.88.8.8",
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ])("возвращает unknown для недоступного IP: %p", (ip) => {
    expect(getCountryByIp(ip)).toBe(ECountry.UNKNOWN)
  })
})
