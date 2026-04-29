// Entry point for the (welcome) group. Redirects to onboarding.tsx.
// Required by Expo Router v6 for named route groups — without this file,
// any navigation targeting /(welcome) directly throws a 404.
import { Redirect } from 'expo-router'

export default function WelcomeIndex() {
  return <Redirect href="/(welcome)/onboarding" />
}
