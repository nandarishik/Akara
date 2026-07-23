import { useEffect, useState } from "react"

/**
 * useTypewriter — progressively reveals `text` at `speed` ms per character.
 * Resets and replays whenever `text` changes.
 * Used in LandingPage Section 5 "Ask anything" demo tab.
 */
export function useTypewriter(text: string, speed = 50): string {
  const [displayed, setDisplayed] = useState("")

  useEffect(() => {
    setDisplayed("")
    if (!text) return

    let i = 0
    const id = setInterval(() => {
      i += 1
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)

    return () => clearInterval(id)
  }, [text, speed])

  return displayed
}
