const CURSOR_FIXTURES = {
  search: {
    scope: [
      "space",
      20,
      [
        ["items", {}],
        ["users", {}],
      ],
    ],
    position: [20, null],
    cursor:
      "WzEsIlpzY0hqT3M1Rno1Zm1tTnBaelYtTk9vdFB0NkhnQjd4Sk1FNUVaR0pLOE0iLFsyMCxudWxsXV0",
  },
  tags: {
    scope: ["space", [], [], [], 50],
    position: 50,
    cursor:
      "WzEsInhnTHhoRXVlLXFLdVpWYi1FRk9iUktQbzJIUHphWERNSWljUkFEUnZzN0EiLDUwXQ",
  },
  unsupportedVersion:
    "WzIsInhnTHhoRXVlLXFLdVpWYi1FRk9iUktQbzJIUHphWERNSWljUkFEUnZzN0EiLDUwXQ",
  invalidPosition:
    "WzEsInhnTHhoRXVlLXFLdVpWYi1FRk9iUktQbzJIUHphWERNSWljUkFEUnZzN0EiLG51bGxd",
  errorMessage: "Некорректный курсор",
}

export { CURSOR_FIXTURES }
