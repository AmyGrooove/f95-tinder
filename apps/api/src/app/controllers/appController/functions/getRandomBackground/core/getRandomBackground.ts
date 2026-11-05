import { BACKGROUNDS } from "../../../static/BACKGROUNDS"

const getRandomBackground = (previousBackground?: string) => {
  const backgrounds = BACKGROUNDS.filter((background) => {
    return background !== previousBackground
  })

  return backgrounds[Math.floor(Math.random() * backgrounds.length)] ?? ""
}

export { getRandomBackground }
