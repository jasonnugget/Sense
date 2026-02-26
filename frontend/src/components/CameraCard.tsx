import { useNavigate } from 'react-router-dom'

type Props = {
  id: string
  name: string
}

export default function CameraCard({ id, name }: Props) {
  const navigate = useNavigate()

  return (
    <div className="cameraCard" role="button" tabIndex={0} onClick={() => navigate(`/camera/${id}`)}>
      {name}
    </div>
  )
}