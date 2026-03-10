import MainPage, { type MainPageProps } from './MainPage'

export default function CamerasPage(props: MainPageProps) {
  return <MainPage {...props} showOverview={false} />
}
