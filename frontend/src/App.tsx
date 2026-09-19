import { AppProviders } from "@/app/providers"
import { AppRouter } from "@/app/router"
import { EnvironmentBanner } from "@/shared/EnvironmentBanner"

export default function App() {
  return (
    <AppProviders>
      <EnvironmentBanner />
      <AppRouter />
    </AppProviders>
  )
}
