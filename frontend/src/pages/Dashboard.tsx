import CameraCard from '../components/CameraCard'
import AddCameraCard from '../components/AddCameraCard'

export default function Dashboard() {
  return (
    <div className="dashboard">
      <CameraCard id="parking-lot" name="Parking Lot" />
      <CameraCard id="front-door" name="Front Door" />
      <AddCameraCard />
    </div>
  )
}