import { F95_ORIGIN } from "../../../static/F95_ORIGIN"

const buildLatestUrl = (page: number) => {
  const searchParams = new URLSearchParams({
    cmd: "list",
    cat: "games",
    page: String(page),
    sort: "date",
  })

  return `${F95_ORIGIN}/sam/latest_alpha/latest_data.php?${searchParams.toString()}`
}

export { buildLatestUrl }
